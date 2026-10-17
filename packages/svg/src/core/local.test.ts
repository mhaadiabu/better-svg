import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerLocalSvgs, resolveSvgSource, type PrecompiledLocalSvg } from "./local";
import { clearSvgCache, ensureParsedSvg, getCachedParsedSvg, __svgCacheSize } from "./cache";
import { scopeParsedSvgIds } from "./ids";
import { parseXmlSvg } from "./xml";
import type { SvgNode } from "./ast";

const precompiledNode: SvgNode = {
  tag: "svg",
  attrs: [{ name: "viewBox", value: "0 0 24 24" }],
  children: [
    { tag: "linearGradient", attrs: [{ name: "id", value: "grad" }], children: [] },
    {
      tag: "path",
      attrs: [
        { name: "d", value: "M0 0 L4 4" },
        { name: "fill", value: "url(#grad)" },
      ],
      children: [],
    },
  ],
};

describe("local svg registry", () => {
  beforeEach(() => {
    registerLocalSvgs({ "/src/assets/svg/registry-isolated.svg": "INIT" }, { override: true });
  });

  it("registers a path → url mapping and resolves by name", () => {
    registerLocalSvgs({ "/src/assets/svg/logo.svg": "/assets/logo.svg" });
    expect(resolveSvgSource("logo")).toBe("/assets/logo.svg");
  });

  it("overrides an existing entry when override is true (default)", () => {
    registerLocalSvgs({ "/src/assets/svg/logo.svg": "A" }, { override: true });
    expect(resolveSvgSource("logo")).toBe("A");
    registerLocalSvgs({ "/src/assets/svg/logo.svg": "B" }, { override: true });
    expect(resolveSvgSource("logo")).toBe("B");
  });

  it("keeps the existing entry when override is false", () => {
    registerLocalSvgs({ "/src/assets/svg/keepit.svg": "A" }, { override: true });
    registerLocalSvgs({ "/src/assets/svg/keepit.svg": "B" }, { override: false });
    expect(resolveSvgSource("keepit")).toBe("A");
  });

  it("falls back to the /assets/svg/<name>.svg path for unregistered names", () => {
    expect(resolveSvgSource("brand/icon")).toBe("/assets/svg/brand/icon.svg");
  });

  it("strips a trailing .svg via normalizeName", () => {
    registerLocalSvgs({ "/src/assets/svg/trail.svg": "T" });
    expect(resolveSvgSource("trail.svg")).toBe("T");
  });

  it("strips a leading slash via normalizeName", () => {
    registerLocalSvgs({ "/src/assets/svg/lead.svg": "L" });
    expect(resolveSvgSource("/lead")).toBe("L");
  });
});

describe("precompiled registry entries", () => {
  it("seeds the parsed tree so request-time resolution skips parsing", () => {
    registerLocalSvgs({ "brand/precompiled.svg": '<svg viewBox="0 0 24 24"></svg>' }, {
      precompiled: { "brand/precompiled.svg": { node: precompiledNode } },
    });
    const markup = resolveSvgSource("brand/precompiled") as string;
    expect(markup).toBe('<svg viewBox="0 0 24 24"></svg>');
    const content = ensureParsedSvg(markup, markup, true, true);
    expect(content).not.toBeNull();
    expect(content?.attrs).toEqual({ viewBox: "0 0 24 24" });
    expect(content?.node.children).toHaveLength(2);
  });

  it("returns the seeded tree without parsing the registered markup", () => {
    registerLocalSvgs({ junk: "<svg></garbage></svg>" }, {
      precompiled: { junk: { node: precompiledNode } },
    });
    const markup = resolveSvgSource("junk") as string;
    expect(markup).toBe("<svg></garbage></svg>");
    expect(ensureParsedSvg(markup, markup, true, true)).not.toBeNull();
  });

  it("keeps per-instance id scoping on top of the seeded tree", () => {
    registerLocalSvgs({ scoped: "<svg></svg>" }, {
      precompiled: { scoped: { node: precompiledNode } },
    });
    const markup = resolveSvgSource("scoped") as string;
    const content = ensureParsedSvg(markup, markup, true, true)!;
    const first = scopeParsedSvgIds(content, "first");
    const second = scopeParsedSvgIds(content, "second");
    expect(first.ids?.get("grad")).toBe("first-0");
    expect(second.ids?.get("grad")).toBe("second-0");
    expect(content.ids).toBeUndefined();
  });

  it("strips unsafe content from seeded trees at registration", () => {
    const hostile: SvgNode = {
      tag: "svg",
      attrs: [],
      children: [{ tag: "script", attrs: [{ name: "src", value: "x" }], children: [] }],
    };
    registerLocalSvgs({ hostile: "<svg></svg>" }, {
      precompiled: { hostile: { node: hostile } },
    });
    const markup = resolveSvgSource("hostile") as string;
    const content = ensureParsedSvg(markup, markup, true, true)!;
    expect(content.node.children).toHaveLength(0);
  });

  it("leaves plain registrations on the runtime parse path", () => {
    clearSvgCache();
    registerLocalSvgs({ dynamic: '<svg viewBox="0 0 9 9"></svg>' });
    expect(resolveSvgSource("dynamic")).toBe('<svg viewBox="0 0 9 9"></svg>');
    expect(__svgCacheSize()).toBe(0);
    const markup = resolveSvgSource("dynamic") as string;
    expect(ensureParsedSvg(markup, markup, true, true)).not.toBeNull();
    expect(__svgCacheSize()).toBe(1);
  });

  it("fails loudly when a precompiled entry has no registered markup entry", () => {
    expect(() =>
      registerLocalSvgs({}, { precompiled: { orphan: { node: precompiledNode } } }),
    ).toThrow(/Precompiled SVG "orphan" has no registered markup entry\./);
  });

  it("fails loudly when a precompiled tree is malformed", () => {
    const malformed: unknown[] = [
      "plain markup",
      42,
      { tag: "html", attrs: [], children: [] },
      { tag: "svg", attrs: "nonsense", children: [] },
      { tag: "svg", attrs: [], children: "nonsense" },
      { tag: "svg", attrs: [{ name: "x", value: 5 }], children: [] },
    ];
    for (const node of malformed) {
      expect(() =>
        registerLocalSvgs(
          { bad: "<svg></svg>" },
          { precompiled: { bad: { node } as unknown as PrecompiledLocalSvg } },
        ),
      ).toThrow(/"bad" is malformed/);
    }
  });

  it("fails loudly when precompiled keys map to an empty name", () => {
    expect(() =>
      registerLocalSvgs({ "": "<svg></svg>" }, {
        precompiled: { "": { node: precompiledNode } },
      }),
    ).toThrow(/resolves to an empty name\./);
  });

  it("fails loudly when precompiled markup is not inline svg", () => {
    expect(() =>
      registerLocalSvgs({ remote: "/assets/remote.svg" }, {
        precompiled: { remote: { node: precompiledNode } },
      }),
    ).toThrow(/expects inline svg markup/);
  });
});

describe("precompiled registration without a window parser", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("seeds the xmldom parser used by SSR adapters", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("DOMParser", undefined);
    registerLocalSvgs({ ssr: '<svg viewBox="0 0 2 2"></svg>' }, {
      precompiled: { ssr: { node: precompiledNode } },
    });
    const markup = resolveSvgSource("ssr") as string;
    await vi.waitFor(() => {
      expect(getCachedParsedSvg(markup, true)).not.toBeNull();
    });
    const seeded = ensureParsedSvg(markup, markup, true, true, parseXmlSvg);
    expect(seeded).not.toBeNull();
    expect(seeded?.attrs).toEqual({ viewBox: "0 0 24 24" });
  });
});
