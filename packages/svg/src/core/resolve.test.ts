import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveMarkup, resolveSource, type ResolveOptions } from "./resolve";

const makeOptions = (overrides: Partial<ResolveOptions> = {}): ResolveOptions => ({
  signal: new AbortController().signal,
  cache: false,
  ...overrides,
});

describe("resolveMarkup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
