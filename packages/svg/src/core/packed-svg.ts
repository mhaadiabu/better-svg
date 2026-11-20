import type { SvgNode } from "./ast.js";

const tags = "svg g path circle rect ellipse line polygon polyline".split(" ");
const names =
  "xmlns viewBox width height d fill stroke stroke-linecap stroke-linejoin stroke-width cx cy r x y rx ry".split(
    " ",
  );
const values = ["http://www.w3.org/2000/svg", "currentColor", "none", "round"];

type PackedToken = string | number;

export type PackedSvgNode =
  | string
  | [
      tag: PackedToken,
      attrs?: [PackedToken, PackedToken][] | null,
      children?: PackedSvgNode[] | null,
      text?: string,
    ];

const encode = (dictionary: readonly string[], value: string): PackedToken => {
  const index = dictionary.indexOf(value);
  return index < 0 ? value : index;
};

const decode = (dictionary: readonly string[], value: PackedToken): string =>
  typeof value === "string" ? value : dictionary[value]!;

export const packSvgNode = (node: SvgNode): PackedSvgNode => {
  if (node.tag === "#text") return node.text ?? "";
  if (node.tag === "#comment") return ["#comment", null, null, node.text ?? ""];
  const tag = encode(tags, node.tag);
  const attrs = node.attrs.map(({ name, value }): [PackedToken, PackedToken] => [
    encode(names, name),
    encode(values, value),
  ]);
  if (node.children.length)
    return [tag, attrs.length ? attrs : null, node.children.map(packSvgNode)];
  return attrs.length ? [tag, attrs] : [tag];
};

export const unpackSvgNode = (packed: PackedSvgNode): SvgNode => {
  if (typeof packed === "string") return { tag: "#text", attrs: [], children: [], text: packed };
  const [tag, attrs, children, text] = packed;
  return {
    tag: decode(tags, tag),
    attrs:
      attrs?.map(([name, value]) => ({
        name: decode(names, name),
        value: decode(values, value),
      })) ?? [],
    children: children?.map(unpackSvgNode) ?? [],
    text,
  };
};
