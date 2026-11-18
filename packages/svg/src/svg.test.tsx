import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { Profiler, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { SVG } from "./svg";
import * as sanitize from "./core/sanitize";
import { cacheMarkup, clearSvgCache, getCachedParsedSvg } from "./core/cache";
import { registerLocalSvgs } from "./core/local";

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
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" },
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
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" },
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
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" },
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

describe("SVG color overrides", () => {
  it("rewrites hardcoded descendant fill when fill is provided", async () => {
    const markup =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="black" d="M0 0h10v10H0z"/><path fill="none" d="M0 0h1"/></svg>';
    const { container } = render(<SVG src={markup} fill="currentColor" />);
    await waitFor(() => {
      expect(container.querySelector("svg")).not.toBeNull();
    });
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("fill")).toBe("currentColor");
    expect(svg?.innerHTML).toContain('fill="currentColor"');
    expect(svg?.innerHTML).not.toContain('fill="black"');
    expect(svg?.innerHTML).toContain('fill="none"');
  });

  it("leaves descendants untouched when fill and stroke are omitted", async () => {
    const markup =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="black" d="M0 0h10v10H0z"/></svg>';
    const { container } = render(<SVG src={markup} />);
    await waitFor(() => {
      expect(container.querySelector("svg")).not.toBeNull();
    });
    expect(container.querySelector("svg")?.innerHTML).toContain('fill="black"');
  });
});

describe("SVG parsed-cache", () => {
  it("does not re-parse cached SVG on second mount of the same URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(SVG_MARKUP, {
        status: 200,
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" },
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

describe("SVG immediate rendering", () => {
  it.each([
    ["inline", SVG_MARKUP],
    ["data URL", `data:image/svg+xml,${encodeURIComponent(SVG_MARKUP)}`],
    ["base64 data URL", `data:image/svg+xml;base64,${btoa(SVG_MARKUP)}`],
  ] as const)(
    "renders %s markup in one commit and notifies after commit",
    async (_label, source) => {
      const onRender = vi.fn();
      const onLoad = vi.fn(() => expect(container.querySelector("svg")).not.toBeNull());
      const { container } = render(
        <Profiler id="svg" onRender={onRender}>
          <SVG src={source} loading={<span>Loading</span>} onSvgLoad={onLoad} />
        </Profiler>,
      );
      expect(container.querySelector("svg")).not.toBeNull();
      expect(container.textContent).not.toContain("Loading");
      expect(onLoad).not.toHaveBeenCalled();
      await waitFor(() => expect(onLoad).toHaveBeenCalledWith(SVG_MARKUP));
      expect(onRender).toHaveBeenCalledTimes(1);
    },
  );

  it("renders registered names and cached URL markup immediately", () => {
    registerLocalSvgs({ "immediate-icon.svg": SVG_MARKUP });
    const local = render(<SVG name="immediate-icon" />);
    expect(local.container.querySelector("svg")).not.toBeNull();
    cacheMarkup("/public-icon.svg", SVG_MARKUP);
    const cached = render(<SVG src="/public-icon.svg" />);
    expect(cached.container.querySelector("svg")).not.toBeNull();
  });

  it("preserves child elements when only root props change", async () => {
    const onLoad = vi.fn();
    const { container, rerender } = render(<SVG src={SVG_MARKUP} onSvgLoad={onLoad} />);
    const child = container.querySelector("rect");
    expect(child).not.toBeNull();
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1));
    rerender(
      <SVG src={SVG_MARKUP} width={36} opacity={0.5} className="updated" onSvgLoad={onLoad} />,
    );
    expect(container.querySelector("rect")).toBe(child);
    expect(container.querySelector("svg")?.getAttribute("width")).toBe("36");
    expect(container.querySelector("svg")?.getAttribute("opacity")).toBe("0.5");
    expect(container.querySelector("svg")?.getAttribute("class")).toBe("updated");
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it("updates paints and accessible labels without changing the cached tree", () => {
    const markup = '<svg><path fill="black" d="M0 0h1"/></svg>';
    const { container, rerender } = render(<SVG src={markup} fill="red" title="First" />);
    expect(container.querySelector("path")?.getAttribute("fill")).toBe("red");
    rerender(<SVG src={markup} fill="blue" title="Second" desc="Description" id="caller-root" />);
    expect(container.querySelector("path")?.getAttribute("fill")).toBe("blue");
    expect(container.querySelector("title")?.textContent).toBe("Second");
    expect(container.querySelector("desc")?.textContent).toBe("Description");
    const svg = container.querySelector("svg")!;
    expect(svg.id).toBe("caller-root");
    for (const label of svg.getAttribute("aria-labelledby")!.split(" ")) {
      expect(svg.querySelector(`[id="${label}"]`)).not.toBeNull();
    }
    expect(getCachedParsedSvg(markup, true)?.innerHTML).toContain('fill="black"');
    expect(getCachedParsedSvg(markup, true)?.innerHTML).not.toContain("Second");
  });

  it("sanitizes immediate sources and keeps per-instance references independent", () => {
    const markup =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>throw 1</script><defs><linearGradient id="paint"/></defs><path onclick="bad()" fill="url(#paint)"/></svg>';
    const { container, rerender } = render(
      <>
        <SVG src={markup} />
        <SVG src={markup} />
      </>,
    );
    const roots = [...container.querySelectorAll("svg")];
    const ids = roots.map((root) => root.querySelector("linearGradient")!.id);
    expect(new Set(ids).size).toBe(2);
    for (const [index, root] of roots.entries()) {
      expect(root.querySelector("script")).toBeNull();
      expect(root.querySelector("path")?.getAttribute("onclick")).toBeNull();
      expect(root.querySelector("path")?.getAttribute("fill")).toBe(`url(#${ids[index]})`);
    }
    const unsafe = markup.replace("<script>throw 1</script>", "");
    rerender(<SVG src={unsafe} />);
    expect(container.querySelector("path")?.getAttribute("onclick")).toBeNull();
    rerender(<SVG src={unsafe} sanitize={false} uniqueIds={false} />);
    expect(container.querySelector("linearGradient")?.id).toBe("paint");
    expect(container.querySelector("path")?.getAttribute("onclick")).toBe("bad()");
  });

  it("bypasses immediate URL cache reads for custom fetch options and cache=false", async () => {
    cacheMarkup("/auth.svg", SVG_MARKUP);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(SVG_MARKUP));
    vi.stubGlobal("fetch", fetchMock);
    const first = render(
      <SVG
        src="/auth.svg"
        fetchOptions={{ headers: { Authorization: "Bearer test" } }}
        loading={<span>Loading</span>}
      />,
    );
    const second = render(<SVG src="/auth.svg" cache={false} loading={<span>Loading</span>} />);
    expect(first.container.querySelector("svg")).toBeNull();
    expect(second.container.querySelector("svg")).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(first.container.querySelector("svg")).not.toBeNull());
    await waitFor(() => expect(second.container.querySelector("svg")).not.toBeNull());
  });

  it("does not reuse parsed inline content with cache=false", () => {
    const parseSpy = vi.spyOn(sanitize, "parseInlineSvg");
    try {
      const { unmount } = render(<SVG src={SVG_MARKUP} cache={false} />);
      unmount();
      render(<SVG src={SVG_MARKUP} cache={false} />);
      expect(parseSpy).toHaveBeenCalledTimes(2);
      expect(getCachedParsedSvg(SVG_MARKUP, true)).toBeNull();
    } finally {
      parseSpy.mockRestore();
    }
  });

  it("shows a fallback for invalid inline markup and notifies once", async () => {
    const onError = vi.fn();
    const { container } = render(
      <SVG
        src='<?xml version="1.0"?><not-svg/>'
        fallback={<span>Invalid</span>}
        onSvgError={onError}
      />,
    );
    expect(container.textContent).toBe("Invalid");
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });

  it("keeps server and hydration placeholders consistent", async () => {
    const onError = vi.fn();
    const onLoad = vi.fn();
    const element = <SVG src={SVG_MARKUP} loading={<span>Loading</span>} onSvgLoad={onLoad} />;
    const container = document.createElement("div");
    container.innerHTML = renderToString(element);
    document.body.append(container);
    expect(container.textContent).toBe("Loading");
    expect(container.querySelector("svg")).toBeNull();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, element, { onRecoverableError: onError });
      });
      expect(container.querySelector("svg")).not.toBeNull();
      expect(onError).not.toHaveBeenCalled();
      expect(onLoad).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });

  it("notifies once under Strict Mode and ignores a replaced immediate source", async () => {
    const onLoad = vi.fn();
    const { rerender } = render(
      <StrictMode>
        <SVG src={SVG_MARKUP} onSvgLoad={onLoad} />
      </StrictMode>,
    );
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1));
    const obsolete = vi.fn();
    rerender(
      <StrictMode>
        <SVG src="<svg id='obsolete'/>" onSvgLoad={obsolete} />
      </StrictMode>,
    );
    rerender(
      <StrictMode>
        <SVG src="<svg id='current'/>" onSvgLoad={onLoad} />
      </StrictMode>,
    );
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(2));
    expect(onLoad).toHaveBeenLastCalledWith("<svg id='current'/>");
    expect(obsolete).not.toHaveBeenCalled();
  });

  it("hides the previous source while a URL loads and ignores obsolete responses", async () => {
    let finish!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(response);
    vi.stubGlobal("fetch", fetchMock);
    const onLoad = vi.fn();
    const { container, rerender } = render(<SVG src={SVG_MARKUP} onSvgLoad={onLoad} />);
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1));
    rerender(<SVG src="/pending.svg" loading={<span>Loading</span>} onSvgLoad={onLoad} />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.textContent).toBe("Loading");
    rerender(<SVG src="<svg><circle/></svg>" onSvgLoad={onLoad} />);
    expect(container.querySelector("circle")).not.toBeNull();
    await act(async () =>
      finish(new Response(SVG_MARKUP, { headers: { "Cache-Control": "public" } })),
    );
    expect(container.querySelector("rect")).toBeNull();
    expect(container.querySelector("circle")).not.toBeNull();
    expect(onLoad).toHaveBeenCalledTimes(2);
  });
});
