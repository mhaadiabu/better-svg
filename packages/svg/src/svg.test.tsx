import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { SVG } from "./svg";

afterEach(() => {
  vi.unstubAllGlobals();
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
