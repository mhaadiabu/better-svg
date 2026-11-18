import type { SvgNode } from "./ast.js";

export type PackedSvgNode =
  | string
  | [
      tag: string,
      attrs?: [string, string][] | null,
      children?: PackedSvgNode[] | null,
      text?: string,
    ];

export const packSvgNode = (node: SvgNode): PackedSvgNode => {
  if (node.tag === "#text") return node.text ?? "";
  if (node.tag === "#comment") return ["#comment", null, null, node.text ?? ""];
  const attrs = node.attrs.map(({ name, value }): [string, string] => [name, value]);
  if (node.children.length)
    return [node.tag, attrs.length ? attrs : null, node.children.map(packSvgNode)];
  return attrs.length ? [node.tag, attrs] : [node.tag];
};

export const unpackSvgNode = (packed: PackedSvgNode): SvgNode => {
  if (typeof packed === "string") return { tag: "#text", attrs: [], children: [], text: packed };
  const [tag, attrs, children, text] = packed;
  return {
    tag,
    attrs: attrs?.map(([name, value]) => ({ name, value })) ?? [],
    children: children?.map(unpackSvgNode) ?? [],
    text,
  };
};
