import type { SvgNode } from "./ast.js";

type PackedToken = string | number;

export type PackedSvgNode =
  | string
  | [
      tag: PackedToken,
      attrs?: [PackedToken, PackedToken][] | null,
      children?: PackedSvgNode[] | null,
      text?: string,
    ];

const identity = (value: string) => value;

export const packSvgNode = (
  node: SvgNode,
  encode: (value: string) => PackedToken = identity,
): PackedSvgNode => {
  if (node.tag === "#text") return node.text ?? "";
  if (node.tag === "#comment") return ["#comment", null, null, node.text ?? ""];
  const tag = encode(node.tag);
  const attrs = node.attrs.map(({ name, value }): [PackedToken, PackedToken] => [
    encode(name),
    encode(value),
  ]);
  if (node.children.length)
    return [
      tag,
      attrs.length ? attrs : null,
      node.children.map((child) => packSvgNode(child, encode)),
    ];
  return attrs.length ? [tag, attrs] : [tag];
};

const decode = (value: PackedToken, tokens: readonly string[] | undefined) => {
  if (typeof value === "string") return value;
  const token = tokens?.[value];
  if (token === undefined) throw new Error("Invalid packed SVG token.");
  return token;
};

export const unpackSvgNode = (packed: PackedSvgNode, tokens?: readonly string[]): SvgNode => {
  if (typeof packed === "string") return { tag: "#text", attrs: [], children: [], text: packed };
  const [tag, attrs, children, text] = packed;
  return {
    tag: decode(tag, tokens),
    attrs:
      attrs?.map(([name, value]) => ({
        name: decode(name, tokens),
        value: decode(value, tokens),
      })) ?? [],
    children: children?.map((child) => unpackSvgNode(child, tokens)) ?? [],
    text,
  };
};
