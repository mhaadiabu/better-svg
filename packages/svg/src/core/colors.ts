import { parseInlineStyle, type SvgNode } from "./ast";
import { inlineSvgFromNode, type ParsedInlineSvg } from "./sanitize";

export type SvgColorOverrides = {
  fill?: string;
  stroke?: string;
};

const isUrlRef = (value: string) => /^\s*url\(/i.test(value);

const isNone = (value: string) => value.trim().toLowerCase() === "none";

const shouldReplace = (value: string) => !isNone(value) && !isUrlRef(value);

const toKebabCase = (key: string) =>
  key.startsWith("--") ? key : key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

const serializeInlineStyle = (style: Record<string, string>) =>
  Object.entries(style)
    .map(([key, value]) => `${toKebabCase(key)}:${value}`)
    .join(";");

const overrideStyleText = (text: string, overrides: SvgColorOverrides): string | undefined => {
  const parsed = parseInlineStyle(text);
  let changed = false;
  if (overrides.fill !== undefined && typeof parsed.fill === "string" && shouldReplace(parsed.fill)) {
    parsed.fill = overrides.fill;
    changed = true;
  }
  if (
    overrides.stroke !== undefined &&
    typeof parsed.stroke === "string" &&
    shouldReplace(parsed.stroke)
  ) {
    parsed.stroke = overrides.stroke;
    changed = true;
  }
  return changed ? serializeInlineStyle(parsed) : undefined;
};

const overrideNode = (node: SvgNode, overrides: SvgColorOverrides): SvgNode => {
  let attrs = node.attrs;
  const nextAttrs = attrs.map((attr) => {
    const lower = attr.name.toLowerCase();
    if (lower === "style" && overrides) {
      const replaced = overrideStyleText(attr.value, overrides);
      return replaced === undefined ? attr : { ...attr, value: replaced };
    }
    if (lower === "fill" && overrides.fill !== undefined && shouldReplace(attr.value)) {
      return { ...attr, value: overrides.fill };
    }
    if (lower === "stroke" && overrides.stroke !== undefined && shouldReplace(attr.value)) {
      return { ...attr, value: overrides.stroke };
    }
    return attr;
  });
  if (nextAttrs.every((attr, index) => attr === attrs[index])) {
    attrs = node.attrs;
  } else {
    attrs = nextAttrs;
  }

  let children = node.children;
  const nextChildren = node.children.map((child) =>
    child.tag === "#text" || child.tag === "#comment" ? child : overrideNode(child, overrides),
  );
  if (nextChildren.every((child, index) => child === node.children[index])) {
    children = node.children;
  } else {
    children = nextChildren;
  }

  if (attrs === node.attrs && children === node.children) return node;
  return { ...node, attrs, children };
};

const overrideCache = new WeakMap<ParsedInlineSvg, Map<string, ParsedInlineSvg>>();

export const withSvgColorOverrides = (
  content: ParsedInlineSvg,
  overrides: SvgColorOverrides,
): ParsedInlineSvg => {
  if (overrides.fill === undefined && overrides.stroke === undefined) return content;
  const key = `${overrides.fill ?? ""}\n${overrides.stroke ?? ""}`;
  const cached = overrideCache.get(content)?.get(key);
  if (cached) return cached;
  const node = overrideNode(content.node, overrides);
  const result = node === content.node ? content : withIds(content, node);
  let scoped = overrideCache.get(content);
  if (!scoped) {
    scoped = new Map();
    overrideCache.set(content, scoped);
  }
  scoped.set(key, result);
  return result;
};

const withIds = (content: ParsedInlineSvg, node: SvgNode): ParsedInlineSvg => {
  const parsed = inlineSvgFromNode(node);
  if (content.ids) parsed.ids = content.ids;
  return parsed;
};
