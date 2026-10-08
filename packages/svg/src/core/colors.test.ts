import { describe, expect, it } from "vitest";
import { parseSvgString, renderNode } from "./ast";
import { withSvgColorOverrides } from "./colors";
import { scopeParsedSvgIds } from "./ids";
import { inlineSvgFromNode } from "./sanitize";

const parse = (markup: string) => {
  const node = parseSvgString(markup);
  if (!node) throw new Error("failed to parse fixture");
  return inlineSvgFromNode(node);
};

describe("withSvgColorOverrides", () => {
  it("returns the same instance when no overrides are provided", () => {
    const content = parse('<svg><path fill="black"/></svg>');
    expect(withSvgColorOverrides(content, {})).toBe(content);
  });

  it("replaces hardcoded fill attributes with the override", () => {
    const content = parse('<svg><path fill="black" d="M0 0h10v10H0z"/></svg>');
    const result = withSvgColorOverrides(content, { fill: "currentColor" });
    expect(result.innerHTML).toContain('fill="currentColor"');
    expect(result.innerHTML).not.toContain('fill="black"');
  });

  it("preserves fill none and gradient references", () => {
    const content = parse(
      '<svg><path fill="none" d="M0 0h1"/><path fill="url(#g)" d="M0 0h1"/><defs><linearGradient id="g"></linearGradient></defs></svg>',
    );
    const result = withSvgColorOverrides(content, { fill: "currentColor" });
    expect(result.innerHTML).toContain('fill="none"');
    expect(result.innerHTML).toContain("fill=\"url(#g)\"");
  });

  it("kills stroke variants when stroke none is passed", () => {
    const content = parse(
      '<svg fill="none"><path stroke="currentColor" stroke-width="1.5" d="M17 17L21 21"/></svg>',
    );
    const result = withSvgColorOverrides(content, { stroke: "none" });
    expect(result.innerHTML).toContain('stroke="none"');
    expect(result.innerHTML).not.toContain('stroke="currentColor"');
  });

  it("rewrites fill inside inline style attributes", () => {
    const content = parse('<svg><path style="fill:black;opacity:0.5" d="M0 0h1"/></svg>');
    const result = withSvgColorOverrides(content, { fill: "red" });
    expect(result.innerHTML).toContain("fill:red");
    expect(result.innerHTML).toContain("opacity:0.5");
  });

  it("does not mutate the cached node", () => {
    const content = parse('<svg><path fill="black"/></svg>');
    const before = renderNode(content.node);
    withSvgColorOverrides(content, { fill: "red" });
    expect(renderNode(content.node)).toBe(before);
  });

  it("memoizes repeated overrides for the same content", () => {
    const content = parse('<svg><path fill="black"/></svg>');
    const first = withSvgColorOverrides(content, { fill: "red" });
    expect(withSvgColorOverrides(content, { fill: "red" })).toBe(first);
  });

  it("rewrites caller gradient references through scoped ids", () => {
    const content = scopeParsedSvgIds(
      parse('<svg><defs><linearGradient id="g"></linearGradient></defs><path fill="black"/></svg>'),
      "p",
    );
    const result = withSvgColorOverrides(content, { fill: "url(#g)" });
    expect(result.innerHTML).toContain("url(#p-0)");
    expect(result.innerHTML).not.toContain("url(#g)");
  });

  it("preserves fill none with important in inline styles", () => {
    const content = parse('<svg><path style="fill:none !important" d="M0 0h1"/></svg>');
    const result = withSvgColorOverrides(content, { fill: "red" });
    expect(result.innerHTML).toContain("fill:none !important");
  });

  it("keeps important priority when replacing an inline color", () => {
    const content = parse('<svg><path style="fill:black!important" d="M0 0h1"/></svg>');
    const result = withSvgColorOverrides(content, { fill: "red" });
    expect(result.innerHTML).toContain("fill:red !important");
  });

  it("keeps the important winner with duplicate fill declarations", () => {
    const content = parse('<svg><path style="fill:black !important;fill:none" d="M0 0h1"/></svg>');
    const result = withSvgColorOverrides(content, { fill: "red" });
    expect(result.innerHTML).toContain("fill:red !important;fill:none");
  });

  it("preserves unrelated declarations with quoted semicolons", () => {
    const content = parse(`<svg><path style="fill:black;font-family:'A;B'" d="M0 0h1"/></svg>`);
    const result = withSvgColorOverrides(content, { fill: "red" });
    expect(result.innerHTML).toContain("fill:red");
    expect(result.innerHTML).toContain("font-family:'A;B'");
  });

  it("overrides uppercase fill declarations", () => {
    const content = parse('<svg><path style="FILL:black" d="M0 0h1"/></svg>');
    const result = withSvgColorOverrides(content, { fill: "red" });
    expect(result.innerHTML).toContain("FILL:red");
  });

  it("distinguishes empty-string overrides from omitted overrides", () => {
    const content = parse('<svg><path fill="black"/></svg>');
    const empty = withSvgColorOverrides(content, { fill: "", stroke: "blue" });
    const omitted = withSvgColorOverrides(content, { stroke: "blue" });
    expect(empty).not.toBe(omitted);
    expect(empty.innerHTML).toContain('fill=""');
    expect(omitted.innerHTML).toContain('fill="black"');
  });

  it("stays correct past the memo eviction limit", () => {
    const content = parse('<svg><path fill="black"/></svg>');
    for (let index = 0; index < 12; index++) {
      const result = withSvgColorOverrides(content, { fill: `color-${index}` });
      expect(result.innerHTML).toContain(`fill="color-${index}"`);
    }
    const evicted = withSvgColorOverrides(content, { fill: "color-0" });
    expect(evicted.innerHTML).toContain('fill="color-0"');
  });
});
