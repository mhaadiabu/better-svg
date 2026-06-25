import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { SVG } from "./svg";
import * as sanitize from "./core/sanitize";
import { clearSvgCache } from "./core/cache";

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  clearSvgCache();
});

const SVG_MARKUP =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="10" height="10"/></svg>';

describe("SVG cache", () => {
  it("caches resolved markup so a second mount does not refetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(SVG_MARKUP, {
        status: 200,
        headers: { "Content-Type": "image/svg+xml" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const url = "https://example.com/cached.svg";
    const { unmount } = render(<SVG src={url} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    unmount();

    render(<SVG src={url} />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("does not cache when cache={false}", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(SVG_MARKUP, {
        status: 200,
        headers: { "Content-Type": "image/svg+xml" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const url = "https://example.com/no-cache.svg";
    const { unmount } = render(<SVG src={url} cache={false} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    unmount();

    render(<SVG src={url} cache={false} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

describe("SVG effect stability", () => {
  it("does not refetch when onSvgLoad is inline (new identity each render)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(SVG_MARKUP, {
        status: 200,
        headers: { "Content-Type": "image/svg+xml" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const url = "https://example.com/stable.svg";
    const onLoad = vi.fn();
    const { rerender } = render(<SVG src={url} onSvgLoad={onLoad} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1));

    const onLoad2 = vi.fn();
    rerender(<SVG src={url} onSvgLoad={onLoad2} />);

    await new Promise((r) => setTimeout(r, 10));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onLoad2).not.toHaveBeenCalled();
  });
});

describe("SVG parsed-cache", () => {
  it("does not re-parse cached SVG on second mount of the same URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(SVG_MARKUP, {
        status: 200,
        headers: { "Content-Type": "image/svg+xml" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const parseSpy = vi.spyOn(sanitize, "parseInlineSvg");
    const url = "https://example.com/parse-skip.svg";

    const { unmount } = render(<SVG src={url} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(parseSpy).toHaveBeenCalledTimes(1));
    unmount();

    render(<SVG src={url} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 10));
    expect(parseSpy).toHaveBeenCalledTimes(1);

    parseSpy.mockRestore();
  });
});
