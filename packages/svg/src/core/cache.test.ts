import { describe, it, expect, vi, beforeEach } from "vitest";
import * as sanitize from "./sanitize";
import {
  __svgCacheSize,
  __svgNodeCacheSize,
  cacheParsedSvg,
  clearSvgCache,
  ensureParsedNode,
  ensureParsedSvg,
  getCachedParsedSvg,
} from "./cache";

const MARKUP = '<svg viewBox="0 0 24 24"><rect width="10" height="10"/></svg>';

beforeEach(() => {
  clearSvgCache();
  vi.restoreAllMocks();
});

describe("ensureParsedSvg", () => {
  it("returns null for malformed markup", () => {
    expect(ensureParsedSvg("s1", "not svg", true)).toBeNull();
  });

  it("parses and caches on first call", () => {
    const spy = vi.spyOn(sanitize, "parseInlineSvg");
    const first = ensureParsedSvg("s2", MARKUP, true);
    expect(first).not.toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("returns the cached parsed result on the second call (no re-parse)", () => {
    const spy = vi.spyOn(sanitize, "parseInlineSvg");
    const first = ensureParsedSvg("s3", MARKUP, true);
    const second = ensureParsedSvg("s3", MARKUP, true);
    expect(second).toEqual(first);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("treats sanitize as part of the key", () => {
    const spy = vi.spyOn(sanitize, "parseInlineSvg");
    ensureParsedSvg("s4", MARKUP, true);
    ensureParsedSvg("s4", MARKUP, false);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("round-trips a sanitized result through getCachedParsedSvg", () => {
    const parsed = ensureParsedSvg("s5", MARKUP, true);
    expect(parsed).not.toBeNull();
    expect(getCachedParsedSvg("s5", true)).toEqual(parsed);
    expect(getCachedParsedSvg("s5", false)).toBeNull();
  });

  it("clearSvgCache empties the cache", () => {
    ensureParsedSvg("s6", MARKUP, true);
    clearSvgCache();
    expect(getCachedParsedSvg("s6", true)).toBeNull();
  });
});

describe("getCachedParsedSvg", () => {
  it("returns null for an unknown source", () => {
    expect(getCachedParsedSvg("unknown", true)).toBeNull();
  });

  it("returns the same object after cacheParsedSvg", () => {
    const inline = sanitize.parseInlineSvg(MARKUP, true)!;
    cacheParsedSvg("s7", true, inline);
    expect(getCachedParsedSvg("s7", true)).toBe(inline);
  });
});

describe("LRU eviction", () => {
  it("evicts the least-recently-used entry when the parsed cache is full", () => {
    clearSvgCache();
    for (let i = 0; i < 500; i++) {
      ensureParsedSvg(`s-evict-${i}`, "<svg><rect/></svg>", true);
    }
    expect(__svgCacheSize()).toBe(500);
    ensureParsedSvg("s-evict-new", "<svg><rect/></svg>", true);
    expect(__svgCacheSize()).toBe(500);
    expect(getCachedParsedSvg("s-evict-0", true)).toBeNull();
    expect(getCachedParsedSvg("s-evict-new", true)).not.toBeNull();
  });

  it("touches an entry on read so it is not evicted next", () => {
    clearSvgCache();
    for (let i = 0; i < 500; i++) {
      ensureParsedSvg(`s-touch-${i}`, "<svg><rect/></svg>", true);
    }
    getCachedParsedSvg("s-touch-0", true);
    ensureParsedSvg("s-touch-new", "<svg><rect/></svg>", true);
    expect(__svgCacheSize()).toBe(500);
    expect(getCachedParsedSvg("s-touch-0", true)).not.toBeNull();
    expect(getCachedParsedSvg("s-touch-1", true)).toBeNull();
  });

  it("evicts the node cache when full (lower limit)", () => {
    clearSvgCache();
    for (let i = 0; i < 200; i++) {
      ensureParsedNode(`n-evict-${i}`, "<svg><rect/></svg>", true);
    }
    expect(__svgNodeCacheSize()).toBe(200);
    ensureParsedNode("n-evict-new", "<svg><rect/></svg>", true);
    expect(__svgNodeCacheSize()).toBe(200);
    expect(ensureParsedNode("n-evict-0", "<svg><rect/></svg>", true)).not.toBeNull();
  });
});