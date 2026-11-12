import { renderNode, type SvgNode } from "./ast.js";
import { createSvgId } from "./ids.js";
import type { ParsedInlineSvg } from "./sanitize.js";

export type SvgPresentation = {
  size?: string | number;
  title?: string;
  desc?: string;
};

export const svgDimensions = ({
  size,
  width,
  height,
}: SvgPresentation & {
  width?: string | number;
  height?: string | number;
}) => {
  const dimensions: { width?: string | number; height?: string | number } = {};
  if (width !== undefined || size !== undefined) dimensions.width = width ?? size;
  if (height !== undefined || size !== undefined) dimensions.height = height ?? size;
  return dimensions;
};

export const svgViewBox = (
  attrs: Record<string, string>,
  {
    size,
    width,
    height,
    viewBox,
  }: SvgPresentation & { width?: string | number; height?: string | number; viewBox?: string },
) => {
  if (viewBox !== undefined) return viewBox;
  if (attrs.viewBox) return attrs.viewBox;
  if (size === undefined && width === undefined && height === undefined) return;
  const dimension = (value: string | undefined) => {
    const length = value?.trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)([a-z]*)$/i);
    if (!length) return;
    const units: Record<string, number> = {
      "": 1,
      px: 1,
      in: 96,
      cm: 96 / 2.54,
      mm: 96 / 25.4,
      q: 96 / 101.6,
      pt: 96 / 72,
      pc: 16,
    };
    const scale = units[length[2]?.toLowerCase() ?? ""];
    if (scale === undefined) return;
    const number = Number(length[1]) * scale;
    return Number.isFinite(number) && number > 0 ? number : undefined;
  };
  const sourceWidth = dimension(attrs.width);
  const sourceHeight = dimension(attrs.height);
  if (sourceWidth !== undefined && sourceHeight !== undefined)
    return `0 0 ${sourceWidth} ${sourceHeight}`;
};

type SvgContent<Style> = ParsedInlineSvg<Style>;

export const createSvgPresentation = <Style = Record<string, string>>() => {
  const prefix = createSvgId();
  const rendered = new WeakMap<SvgNode, string>();
  const renderChild = (node: SvgNode) => {
    let markup = rendered.get(node);
    if (markup === undefined) {
      markup = renderNode(node);
      rendered.set(node, markup);
    }
    return markup;
  };
  let previous:
    | { content: SvgContent<Style>; title?: string; desc?: string; result: SvgContent<Style> }
    | undefined;

  return (content: SvgContent<Style>, { title, desc }: SvgPresentation): SvgContent<Style> => {
    if (title === undefined && desc === undefined) return content;
    if (previous?.content === content && previous.title === title && previous.desc === desc)
      return previous.result;
    const attrs = { ...content.attrs };
    let children = [...content.node.children];
    for (const [tag, text] of [
      ["desc", desc],
      ["title", title],
    ] as const) {
      if (text === undefined) continue;
      const existing = children.find((child) => child.tag.toLowerCase() === tag);
      const id = existing?.attrs.find((attr) => attr.name === "id")?.value ?? `${prefix}-${tag}`;
      const label: SvgNode = {
        tag,
        attrs: [
          ...(existing?.attrs.filter((attr) => attr.name !== "id") ?? []),
          { name: "id", value: id },
        ],
        children: [{ tag: "#text", attrs: [], children: [], text }],
      };
      children = children.filter((child) => child.tag.toLowerCase() !== tag);
      children.unshift(label);
      if (tag === "title" && attrs["aria-label"] === undefined) attrs["aria-labelledby"] ??= id;
      if (tag === "desc") attrs["aria-describedby"] ??= id;
    }
    if (title) attrs.role ??= "img";
    let innerHTML: string | undefined;
    const result: SvgContent<Style> = {
      className: content.className,
      style: content.style,
      styleText: content.styleText,
      ids: content.ids,
      node: { ...content.node, children },
      attrs,
      get innerHTML() {
        return (innerHTML ??= children.map(renderChild).join(""));
      },
    };
    previous = { content, title, desc, result };
    return result;
  };
};
