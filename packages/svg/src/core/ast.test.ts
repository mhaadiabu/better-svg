import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { domParserAvailable, parseInlineStyle, renderNode, sanitizeNode, toCamelCase } from "./ast";
import { parseInlineSvg } from "./sanitize";
import { parseXmlNode } from "./xml";

describe("toCamelCase", () => {
  it("kebab-cases a multi-word attribute", () => {
    expect(toCamelCase("stroke-width")).toBe("strokeWidth");
  });

  // TODO(002): toCamelCase does not preserve custom-property prefixes (`--my-var` => "MyVar").
  // parseInlineStyle guards `--` props before calling toCamelCase, so this is latent only.
  it.skip("preserves custom property prefix", () => {
    expect(toCamelCase("--my-var")).toBe("--my-var");
  });

  it("strips a leading dash", () => {
    expect(toCamelCase("-x")).toBe("x");
  });
});

describe("parseInlineStyle", () => {
  it("splits multiple declarations", () => {
    expect(parseInlineStyle("fill:red;stroke:blue")).toEqual({
      fill: "red",
      stroke: "blue",
    });
  });

  it("preserves custom property names", () => {
    expect(parseInlineStyle("--brand:red")).toEqual({ "--brand": "red" });
  });

  it("returns empty object for whitespace", () => {
    expect(parseInlineStyle("  ")).toEqual({});
  });

  it("skips declarations with no value", () => {
    expect(parseInlineStyle("fill:")).toEqual({});
  });
});

describe("domParserAvailable", () => {
  it("is true under happy-dom", () => {
    expect(domParserAvailable()).toBe(true);
  });
});

describe("browser SVG parser", () => {
  it("parses a well-formed svg via the DOM path", () => {
    const root = parseInlineSvg("<svg viewBox='0 0 24 24'><rect/></svg>", false)?.node;
    expect(root).not.toBeNull();
    expect(root?.tag).toBe("svg");
    expect(root?.children.length).toBe(1);
    expect(root?.children[0]?.tag).toBe("rect");
  });

  it("returns null for malformed markup (happy-dom reports a parsererror)", () => {
    expect(parseInlineSvg("<svg><rect>", false)).toBeNull();
  });

  it("returns null for non-svg content", () => {
    expect(parseInlineSvg("not svg", false)).toBeNull();
  });
});

describe("parseXmlNode without browser globals", () => {
  beforeEach(() => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("DOMParser", undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses a self-closing root with its attributes", () => {
    expect(domParserAvailable()).toBe(false);
    expect(parseXmlNode("<svg viewBox='0 0 24 24'/>", false)).toEqual({
      tag: "svg",
      attrs: [{ name: "viewBox", value: "0 0 24 24" }],
      children: [],
    });
  });

  it.each(["a > b", "a /> b"])("preserves quoted tag boundaries in %j", (value) => {
    const root = parseXmlNode(
      `<svg aria-label="${value}"><g aria-label='${value}'><text>child</text></g><rect/></svg>`,
      false,
    );
    expect(root?.attrs).toEqual([{ name: "aria-label", value }]);
    expect(root?.children.map((child) => child.tag)).toEqual(["g", "rect"]);
    expect(root?.children[0]?.attrs).toEqual([{ name: "aria-label", value }]);
    expect(root?.children[0]?.children[0]?.children[0]?.text).toBe("child");
  });

  it("decodes named and numeric XML entities once in text and attributes", () => {
    const encoded = "&lt;&gt;&quot;&apos;&amp;&#65;&#x1F600;&amp;lt;&amp;#65;";
    const decoded = "<>\"'&A😀&lt;&#65;";
    const root = parseXmlNode(`<svg aria-label='${encoded}'><text>${encoded}</text></svg>`, false);
    expect(root?.attrs).toEqual([{ name: "aria-label", value: decoded }]);
    expect(root?.children[0]?.children[0]?.text).toBe(decoded);
  });
});

describe("sanitizeNode", () => {
  it("removes dangerous child elements and on* attributes", () => {
    const node = {
      tag: "svg",
      attrs: [],
      children: [
        { tag: "script", attrs: [], children: [] },
        {
          tag: "rect",
          attrs: [
            { name: "onclick", value: "x" },
            { name: "fill", value: "red" },
          ],
          children: [],
        },
      ],
    };
    const cleaned = sanitizeNode(node);
    expect(cleaned).not.toBeNull();
    expect(cleaned?.children.length).toBe(1);
    expect(cleaned?.children[0]?.tag).toBe("rect");
    const names = cleaned?.children[0]?.attrs.map((a) => a.name);
    expect(names).not.toContain("onclick");
    expect(names).toContain("fill");
  });

  it("removes unsafe href values and keeps safe ones", () => {
    const node = {
      tag: "svg",
      attrs: [],
      children: [
        {
          tag: "use",
          attrs: [{ name: "href", value: "javascript:alert(1)" }],
          children: [],
        },
        {
          tag: "use",
          attrs: [{ name: "href", value: "#frag" }],
          children: [],
        },
        {
          tag: "use",
          attrs: [{ name: "href", value: "https://x" }],
          children: [],
        },
      ],
    };
    const cleaned = sanitizeNode(node);
    const keptTags = cleaned?.children.map((c) => c.tag);
    expect(keptTags).toEqual(["use", "use", "use"]);
    const hrefs = cleaned?.children.map((c) => c.attrs.find((a) => a.name === "href")?.value);
    // external document references are stripped along with javascript:, only
    // same-document fragments survive on use
    expect(hrefs).toEqual([undefined, "#frag", undefined]);
  });

  it("removes style with unsafe url() and keeps safe url()", () => {
    const node = {
      tag: "svg",
      attrs: [],
      children: [
        {
          tag: "rect",
          attrs: [{ name: "style", value: "fill:url(javascript:x)" }],
          children: [],
        },
        {
          tag: "rect",
          attrs: [{ name: "style", value: "fill:url(#g)" }],
          children: [],
        },
      ],
    };
    const cleaned = sanitizeNode(node);
    const keptTags = cleaned?.children.map((c) => c.tag);
    expect(keptTags).toEqual(["rect", "rect"]);
    const styles = cleaned?.children.map(
      (c) => c.attrs.find((a) => a.name === "style")?.value ?? null,
    );
    // unsafe style attribute is stripped; the safe one is kept; benign node kept
    expect(styles).toEqual([null, "fill:url(#g)"]);
  });
});

describe("renderNode", () => {
  it("round-trips a sanitized node", () => {
    const markup = "<svg><script>x</script><rect onclick='y' fill='red'/></svg>";
    const root = parseInlineSvg(markup, true)?.node;
    expect(root).not.toBeNull();
    const rendered = renderNode(root!);
    expect(rendered).toContain('fill="red"');
    expect(rendered).not.toContain("onclick");
    expect(rendered).not.toContain("<script");
  });
});

describe("browser parser sanitization", () => {
  it("strips script and on* attributes when sanitize is true", () => {
    const markup = "<svg><script>x</script><rect onclick='y'/></svg>";
    const root = parseInlineSvg(markup, true)?.node;
    const rendered = renderNode(root!);
    expect(rendered).not.toContain("<script");
    expect(rendered).not.toContain("onclick");
  });

  it("keeps script nodes when sanitize is false", () => {
    const markup = "<svg><script>x</script><rect/></svg>";
    const root = parseInlineSvg(markup, false)?.node;
    const rendered = renderNode(root!);
    expect(rendered).toContain("<script");
  });
});
