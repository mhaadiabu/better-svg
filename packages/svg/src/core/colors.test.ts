import { describe, expect, it } from "vitest";
import { parseSvgString, renderNode } from "./ast";
import { withSvgColorOverrides } from "./colors";
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
});
