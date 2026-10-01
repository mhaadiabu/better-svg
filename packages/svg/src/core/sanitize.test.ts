import { describe, it, expect } from "vitest";
import { parseInlineSvg } from "./sanitize";
import { parseAndSanitize, renderNode } from "./ast";

describe("parseInlineSvg", () => {
  it("strips mixed-case event handlers and dangerous tags", () => {
    const result = parseInlineSvg(
      "<svg OnLoad='x'><ScRiPt>x</ScRiPt><rect oNcLiCk='y' fill='red'/></svg>",
      true,
    );
    expect(result?.attrs).toEqual({});
    expect(result?.innerHTML).toBe('<rect fill="red"/>');
  });

  it.each(["set", "animate", "animateMotion", "animateTransform", "style", "foreignObject"])(
    "removes %s elements while retaining static SVG siblings",
    (tag) => {
      const result = parseInlineSvg(
        `<svg><${tag} attributeName='href' to='javascript:alert(1)'>payload</${tag}><rect/></svg>`,
        true,
      );
      expect(result?.innerHTML).toBe("<rect/>");
    },
  );

  it.each(["href", "xlink:href"])("strips obfuscated protocols in %s", (attribute) => {
    const result = parseInlineSvg(
      `<svg><use ${attribute}='java&#x09;script:alert(1)'/><use ${attribute}='#safe'/></svg>`,
      true,
    );
    expect(result?.innerHTML).toBe(`<use/><use ${attribute}="#safe"/>`);
  });

  it("escapes parsed text before inserting it into an HTML document", () => {
    const root = parseAndSanitize(
      "<svg><text>&lt;img src=x onerror=alert(1)&gt; &amp; text</text></svg>",
      true,
    );
    expect(root).not.toBeNull();
    const container = document.createElement("div");
    container.innerHTML = renderNode(root!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("<img src=x onerror=alert(1)> & text");
  });

  it("preserves trusted stylesheets and animations when sanitization is disabled", () => {
    const markup =
      "<svg><style>rect { fill: red }</style><set attributeName='fill' to='blue'/></svg>";
    const result = parseInlineSvg(markup, false);
    expect(result?.innerHTML).toContain("<style>");
    expect(result?.innerHTML).toContain("<set ");
  });

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
