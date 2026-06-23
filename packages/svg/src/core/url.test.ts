import { describe, it, expect } from "vitest";
import { decodeDataUrl, hasUnsafeUrl, isInlineSvg, isSafeUrl } from "./url";

describe("isInlineSvg", () => {
  it("returns true for <svg/> markup", () => {
    expect(isInlineSvg("<svg/>")).toBe(true);
  });

  it("returns true for <?xml ...?> prolog", () => {
    expect(isInlineSvg('<?xml version="1.0"?><svg/>')).toBe(true);
  });

  it("returns false for a data: URL", () => {
    expect(isInlineSvg("data:image/svg+xml,<svg/>")).toBe(false);
  });

  it("trims surrounding whitespace before checking", () => {
    expect(isInlineSvg("  <svg")).toBe(true);
  });
});

describe("decodeDataUrl", () => {
  it("decodes a plain (non-base64) svg data URL", () => {
    expect(decodeDataUrl("data:image/svg+xml,<svg/>")).toBe("<svg/>");
  });

  it("decodes a base64 svg data URL", () => {
    expect(decodeDataUrl("data:image/svg+xml;base64,PHN2Zy8+")).toBe("<svg/>");
  });

  it("returns null for a non-svg data URL", () => {
    expect(decodeDataUrl("data:image/png,xxx")).toBeNull();
  });

  it("returns null when base64 payload is invalid", () => {
    expect(decodeDataUrl("data:image/svg+xml;base64,@@@not-base64@@@")).toBeNull();
  });
});

describe("isSafeUrl", () => {
  it("treats empty string as safe", () => {
    expect(isSafeUrl("")).toBe(true);
  });

  it("allows fragment-only URLs", () => {
    expect(isSafeUrl("#frag")).toBe(true);
    expect(isSafeUrl("#")).toBe(true);
  });

  it("allows protocol-relative URLs", () => {
    expect(isSafeUrl("//cdn.example.com/x")).toBe(true);
  });

  it("allows http / https / blob schemes", () => {
    expect(isSafeUrl("http://x")).toBe(true);
    expect(isSafeUrl("https://x")).toBe(true);
    expect(isSafeUrl("blob:...")).toBe(true);
  });

  it("allows data: URLs only for images", () => {
    expect(isSafeUrl("data:image/png,...")).toBe(true);
    expect(isSafeUrl("data:image/svg+xml,...")).toBe(true);
  });

  it("rejects javascript: and vbscript: schemes", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("javascript:")).toBe(false);
    expect(isSafeUrl("vbscript:x")).toBe(false);
  });

  it("allows scheme-less relative paths", () => {
    expect(isSafeUrl("relative/path.svg")).toBe(true);
  });
});

describe("hasUnsafeUrl", () => {
  it("returns false for a safe fragment url()", () => {
    expect(hasUnsafeUrl("fill:url(#grad)")).toBe(false);
  });

  it("returns true for a javascript: url()", () => {
    expect(hasUnsafeUrl("fill:url(javascript:alert(1))")).toBe(true);
  });

  it("returns false for an http url()", () => {
    expect(hasUnsafeUrl("fill:url(http://x)")).toBe(false);
  });

  it("returns false for style with no url()", () => {
    expect(hasUnsafeUrl("color:red")).toBe(false);
  });

  it("returns true when a safe and unsafe url() are mixed", () => {
    expect(hasUnsafeUrl("fill:url(#a) url(javascript:x)")).toBe(true);
  });
});