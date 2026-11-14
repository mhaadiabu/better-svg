import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveMarkup, resolveSource, type ResolveOptions } from "./resolve";
import { clearSvgCache, getCachedMarkup } from "./cache";

const deferred = <Value>() => {
  let resolve!: (value: Value) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const publicSvg = (markup = "<svg/>") =>
  new Response(markup, { headers: { "Cache-Control": "public, max-age=3600" } });

const makeOptions = (overrides: Partial<ResolveOptions> = {}): ResolveOptions => ({
  signal: new AbortController().signal,
  cache: false,
  ...overrides,
});

describe("resolveMarkup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearSvgCache();
  });

  it("returns inline svg markup without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await resolveMarkup("<svg/>", makeOptions());
    expect(result).toBe("<svg/>");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("decodes a plain data: URL without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await resolveMarkup("data:image/svg+xml,<svg/>", makeOptions());
    expect(result).toBe("<svg/>");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("decodes a base64 data: URL without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await resolveMarkup("data:image/svg+xml;base64,PHN2Zy8+", makeOptions());
    expect(result).toBe("<svg/>");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches a remote url with an Accept: image/svg+xml header", async () => {
    const fetchMock = vi.fn(async () => new Response("<svg/>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await resolveMarkup("https://example.com/x.svg", makeOptions());
    expect(result).toBe("<svg/>");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/x.svg",
      expect.objectContaining({}),
    );
    const callArg = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = callArg?.headers as Headers | undefined;
    expect(headers?.get("Accept")).toBe("image/svg+xml");
  });

  it("rejects when the response is not ok", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(resolveMarkup("https://example.com/missing.svg", makeOptions())).rejects.toThrow(
      /Failed to fetch SVG: 404/,
    );
  });

  it("rejects when the source is empty", async () => {
    await expect(resolveMarkup("   ", makeOptions())).rejects.toThrow("SVG src is required.");
  });

  it("shares concurrent public responses and reuses completed markup", async () => {
    const response = deferred<Response>();
    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(response.promise);
    vi.stubGlobal("fetch", fetchMock);
    const source = "https://example.com/shared.svg";
    const first = resolveMarkup(source, makeOptions({ cache: true }));
    const second = resolveMarkup(source, makeOptions({ cache: true }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    response.resolve(publicSvg());
    expect(await Promise.all([first, second])).toEqual(["<svg/>", "<svg/>"]);
    expect(await resolveMarkup(source, makeOptions({ cache: true }))).toBe("<svg/>");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["owner", "joined"])(
    "keeps other consumers alive when the %s cancels",
    async (caller) => {
      const response = deferred<Response>();
      const fetchMock = vi.fn<typeof fetch>().mockReturnValue(response.promise);
      vi.stubGlobal("fetch", fetchMock);
      const owner = new AbortController();
      const joined = new AbortController();
      const source = "https://example.com/cancel.svg";
      const first = resolveMarkup(source, makeOptions({ cache: true, signal: owner.signal }));
      const second = resolveMarkup(source, makeOptions({ cache: true, signal: joined.signal }));
      const cancelled = caller === "owner" ? first : second;
      const remaining = caller === "owner" ? second : first;
      const rejection = expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
      (caller === "owner" ? owner : joined).abort();
      await rejection;
      expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
      response.resolve(publicSvg());
      expect(await remaining).toBe("<svg/>");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(getCachedMarkup(source)).toBe("<svg/>");
    },
  );

  it("aborts abandoned requests and keeps late responses out of a replacement's cache", async () => {
    const abandoned = deferred<Response>();
    const replacement = deferred<Response>();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(abandoned.promise)
      .mockReturnValueOnce(replacement.promise);
    vi.stubGlobal("fetch", fetchMock);
    const firstController = new AbortController();
    const secondController = new AbortController();
    const source = "https://example.com/replaced.svg";
    const first = resolveMarkup(
      source,
      makeOptions({ cache: true, signal: firstController.signal }),
    );
    const second = resolveMarkup(
      source,
      makeOptions({ cache: true, signal: secondController.signal }),
    );
    const rejections = Promise.all([
      expect(first).rejects.toMatchObject({ name: "AbortError" }),
      expect(second).rejects.toMatchObject({ name: "AbortError" }),
    ]);
    firstController.abort();
    secondController.abort();
    await rejections;
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    const third = resolveMarkup(source, makeOptions({ cache: true }));
    abandoned.resolve(publicSvg("<svg id='old'/>"));
    replacement.resolve(publicSvg("<svg id='new'/>"));
    expect(await third).toBe("<svg id='new'/>");
    expect(getCachedMarkup(source)).toBe("<svg id='new'/>");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    undefined,
    "private",
    "no-store",
    "no-cache",
    "public, private",
    "PUBLIC, No-Store",
    "public, no-cache",
  ])("does not share or cache responses with Cache-Control %s", async (policy) => {
    const response = deferred<Response>();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(response.promise)
      .mockResolvedValueOnce(new Response("<svg id='second'/>"))
      .mockResolvedValueOnce(new Response("<svg id='third'/>"));
    vi.stubGlobal("fetch", fetchMock);
    const source = "https://example.com/private.svg";
    const first = resolveMarkup(source, makeOptions({ cache: true }));
    const second = resolveMarkup(source, makeOptions({ cache: true }));
    response.resolve(
      new Response("<svg id='first'/>", {
        headers: policy ? { "Cache-Control": policy } : {},
      }),
    );
    expect(await first).toBe("<svg id='first'/>");
    expect(await second).toBe("<svg id='second'/>");
    expect(getCachedMarkup(source)).toBeUndefined();
    expect(await resolveMarkup(source, makeOptions({ cache: true }))).toBe("<svg id='third'/>");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("starts independent private loads at headers without waiting for the first body", async () => {
    const body = deferred<string>();
    const firstResponse = new Response("", { headers: { "Cache-Control": "private" } });
    vi.spyOn(firstResponse, "text").mockReturnValue(body.promise);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(new Response("<svg id='second'/>"));
    vi.stubGlobal("fetch", fetchMock);
    const source = "https://example.com/slow-private.svg";
    const first = resolveMarkup(source, makeOptions({ cache: true }));
    const second = resolveMarkup(source, makeOptions({ cache: true }));
    expect(await second).toBe("<svg id='second'/>");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    body.resolve("<svg id='first'/>");
    expect(await first).toBe("<svg id='first'/>");
    expect(getCachedMarkup(source)).toBeUndefined();
  });

  it.each(["cache", "fetchOptions"])(
    "bypasses reuse with %s disabled or customized",
    async (bypass) => {
      const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => publicSvg());
      vi.stubGlobal("fetch", fetchMock);
      const source = "https://example.com/custom.svg";
      await resolveMarkup(source, makeOptions({ cache: true }));
      const options = makeOptions(
        bypass === "cache" ? { cache: false } : { cache: true, fetchOptions: {} },
      );
      await Promise.all([resolveMarkup(source, options), resolveMarkup(source, options)]);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    },
  );

  it("keeps requests and cache entries separate by redirect policy", async () => {
    const response = deferred<Response>();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(response.promise)
      .mockRejectedValueOnce(new TypeError("Redirect is not allowed"));
    vi.stubGlobal("fetch", fetchMock);
    const source = "https://example.com/redirect.svg";
    const following = resolveMarkup(source, makeOptions({ cache: true }));
    const strict = resolveMarkup(source, makeOptions({ cache: true, redirect: "error" }));
    await expect(strict).rejects.toThrow("Redirect is not allowed");
    response.resolve(publicSvg());
    expect(await following).toBe("<svg/>");
    fetchMock.mockRejectedValueOnce(new TypeError("Redirect is not allowed"));
    await expect(
      resolveMarkup(source, makeOptions({ cache: true, redirect: "error" })),
    ).rejects.toThrow("Redirect is not allowed");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getCachedMarkup(source, "error")).toBeUndefined();
  });

  it("releases failed requests so callers can retry", async () => {
    const response = deferred<Response>();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(response.promise)
      .mockImplementationOnce(async () => publicSvg());
    vi.stubGlobal("fetch", fetchMock);
    const source = "https://example.com/retry.svg";
    const first = resolveMarkup(source, makeOptions({ cache: true }));
    const second = resolveMarkup(source, makeOptions({ cache: true }));
    const rejections = Promise.all([
      expect(first).rejects.toThrow("Offline"),
      expect(second).rejects.toThrow("Offline"),
    ]);
    response.reject(new Error("Offline"));
    await rejections;
    expect(await resolveMarkup(source, makeOptions({ cache: true }))).toBe("<svg/>");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not fetch or join a request for an already aborted caller", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    controller.abort();
    await expect(
      resolveMarkup(
        "https://example.com/aborted.svg",
        makeOptions({
          cache: true,
          signal: controller.signal,
        }),
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("resolveSource", () => {
  it("returns the src when a name is not provided", () => {
    expect(resolveSource("url", undefined)).toBe("url");
  });

  it("resolves through the local registry when a name is provided", () => {
    const result = resolveSource(undefined, "some-name");
    expect(result).toBe("/assets/svg/some-name.svg");
  });

  it("returns undefined when neither src nor name is provided", () => {
    expect(resolveSource(undefined, undefined)).toBeUndefined();
  });
});
