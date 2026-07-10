import { describe, it, expect } from "vitest";
import { parseInlineSvg } from "./sanitize";

describe("parseInlineSvg", () => {
  it("strips dangerous tags and on* attributes when sanitize=true", () => {
    const result = parseInlineSvg(
      "<svg onload='x'><script>a</script><rect onclick='y' fill='red'/></svg>",
      true,
    );
    expect(result).not.toBeNull();
    expect(result!.innerHTML).not.toContain("<script");
    expect(result!.innerHTML).not.toContain("onload");
    expect(result!.innerHTML).not.toContain("onclick");
    expect(result!.attrs).toEqual({});
  });

  it("drops javascript: hrefs", () => {
    const result = parseInlineSvg("<svg><a href='javascript:alert(1)'><rect/></a></svg>", true);
    expect(result).not.toBeNull();
    expect(result!.innerHTML).not.toContain("javascript:");
  });

  it("keeps safe https: hrefs", () => {
    const result = parseInlineSvg("<svg><a href='https://example.com'><rect/></a></svg>", true);
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toContain("https://example.com");
  });

  it("keeps #fragment hrefs", () => {
    const result = parseInlineSvg("<svg><use href='#id'/></svg>", true);
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toContain('href="#id"');
  });

  it("keeps safe url(#...) style references on the root svg", () => {
    const result = parseInlineSvg("<svg style='fill:url(#grad)'><rect/></svg>", true);
    expect(result).not.toBeNull();
    expect(result!.style).toBeDefined();
    expect(result!.style).toEqual({ fill: "url(#grad)" });
    expect(result!.innerHTML).not.toContain("javascript:");
  });

  it("does not over-strip safe url(#...) style on nested elements", () => {
    const result = parseInlineSvg("<svg><rect style='fill:url(#grad)'/></svg>", true);
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toContain("url(#grad)");
  });

  it("drops unsafe url(javascript:...) style and removes the style attr", () => {
    const result = parseInlineSvg("<svg style='fill:url(javascript:alert(1))'><rect/></svg>", true);
    expect(result).not.toBeNull();
    expect(result!.style).toBeUndefined();
    expect(result!.innerHTML).not.toContain("style=");
    expect(result!.innerHTML).not.toContain("javascript:");
  });

  it("preserves dangerous content when sanitize=false", () => {
    const result = parseInlineSvg("<svg><script>x</script></svg>", false);
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toContain("<script");
  });

  it("extracts className and removes class from attrs", () => {
    const result = parseInlineSvg("<svg class='a b'><rect/></svg>", true);
    expect(result).not.toBeNull();
    expect(result!.className).toBe("a b");
    expect(result!.attrs).not.toHaveProperty("class");
  });

  it("returns null for malformed non-svg markup", () => {
    expect(parseInlineSvg("not svg", true)).toBeNull();
  });

  it("does not throw on an unclosed svg tag", () => {
    expect(() => parseInlineSvg("<svg", true)).not.toThrow();
  });

  it("strips xlink:href javascript: URLs", () => {
    const result = parseInlineSvg("<svg><use xlink:href='javascript:alert(1)'/></svg>", true);
    expect(result).not.toBeNull();
    expect(result!.innerHTML).not.toContain("javascript:");
  });

  it("removes iframe, foreignObject, object, embed", () => {
    const result = parseInlineSvg(
      "<svg><iframe src='x'/><foreignObject/><object/><embed/></svg>",
      true,
    );
    expect(result).not.toBeNull();
    expect(result!.innerHTML).not.toContain("<iframe");
    expect(result!.innerHTML).not.toContain("<foreignObject");
    expect(result!.innerHTML).not.toContain("<object");
    expect(result!.innerHTML).not.toContain("<embed");
  });
});
