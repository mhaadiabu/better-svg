import { describe, expect, it } from "vitest";
import { packSvgNode, unpackSvgNode } from "./packed-svg";
import { parseXmlNode } from "./xml";

describe("packed SVG trees", () => {
  it("decodes both string tokens and numeric tokens with the supplied dictionary", () => {
    const svg = parseXmlNode(
      '<svg viewBox="0 0 24 24"><g><!-- note --><title>A &amp; B</title><path d="M1 2"/></g></svg>',
      false,
    )!;
    const plain = packSvgNode(svg);
    const tokens = ["svg", "g", "path", "viewBox", "d"];
    const packed = packSvgNode(svg, (token) => {
      const index = tokens.indexOf(token);
      return index < 0 ? token : index;
    });
    expect(packed[0]).toBe(0);
    expect(unpackSvgNode(packed, tokens)).toEqual(unpackSvgNode(plain));
    expect(unpackSvgNode(packed, tokens)).toEqual(svg);
    expect(() => unpackSvgNode(packed)).toThrow("Invalid packed SVG token.");
  });
});
