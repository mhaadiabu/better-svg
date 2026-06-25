import { describe, it, expect, vi, beforeEach } from "vitest";
import * as sanitize from "./sanitize";
import {
  cacheParsedSvg,
  clearSvgCache,
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