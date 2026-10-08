import type { SvgNode } from "./ast";
import { rewriteSvgValue } from "./ids";
import { inlineSvgFromNode, type ParsedInlineSvg } from "./sanitize";

export type SvgColorOverrides = {
  fill?: string;
  stroke?: string;
};

const MAX_CACHED_OVERRIDES = 10;

const isUrlRef = (value: string) => /^\s*url\(/i.test(value);

const IMPORTANT_SUFFIX = /\s*!important\s*$/i;

const paintValue = (value: string) => value.replace(IMPORTANT_SUFFIX, "").trim();

const isNone = (value: string) => paintValue(value).toLowerCase() === "none";

const shouldReplace = (value: string) => !isNone(value) && !isUrlRef(value);

const splitDeclarations = (text: string): string[] => {
  const parts: string[] = [];
  let current = "";
  let quote: string | undefined;
  let depth = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index] ?? "";
    if (quote) {
      current += char;
      if (char === "\\" && index + 1 < text.length) {
        current += text[index + 1];
        index++;
      } else if (char === quote) {
        quote = undefined;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === "(") {
      depth++;
      current += char;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
    } else if (char === ";" && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
};

const overrideStyleText = (text: string, overrides: SvgColorOverrides): string | undefined => {
  let changed = false;
  const result = splitDeclarations(text).map((declaration) => {
    const colon = declaration.indexOf(":");
    if (colon < 0) return declaration;
    const name = declaration.slice(0, colon).trim().toLowerCase();
    if (name !== "fill" && name !== "stroke") return declaration;
    const override = overrides[name];
    const value = declaration.slice(colon + 1);
    if (override === undefined || !shouldReplace(value)) return declaration;
    changed = true;
    return `${declaration.slice(0, colon)}:${override}${IMPORTANT_SUFFIX.test(value) ? " !important" : ""}`;
  });
  return changed ? result.join(";") : undefined;
};

const overrideNode = (node: SvgNode, overrides: SvgColorOverrides): SvgNode => {
  let attrs = node.attrs;
  const nextAttrs = attrs.map((attr) => {
    const lower = attr.name.toLowerCase();
    if (lower === "style") {
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

const rewriteOverride = (
  name: string,
  value: string | undefined,
  ids: ReadonlyMap<string, string> | undefined,
): string | undefined => {
  if (value === undefined || ids === undefined) return value;
  return rewriteSvgValue(name, value, ids);
};

export const withSvgColorOverrides = (
  content: ParsedInlineSvg,
  overrides: SvgColorOverrides,
): ParsedInlineSvg => {
  if (overrides.fill === undefined && overrides.stroke === undefined) return content;
  const key = JSON.stringify([overrides.fill ?? null, overrides.stroke ?? null]);
  let scoped = overrideCache.get(content);
  const cached = scoped?.get(key);
  if (scoped && cached) {
    scoped.delete(key);
    scoped.set(key, cached);
    return cached;
  }
  const scopedOverrides: SvgColorOverrides = {
    fill: rewriteOverride("fill", overrides.fill, content.ids),
    stroke: rewriteOverride("stroke", overrides.stroke, content.ids),
  };
  const node = overrideNode(content.node, scopedOverrides);
  const result = node === content.node ? content : withIds(content, node);
  if (!scoped) {
    scoped = new Map();
    overrideCache.set(content, scoped);
  }
  scoped.set(key, result);
  if (scoped.size > MAX_CACHED_OVERRIDES) {
    const oldest = scoped.keys().next();
    if (!oldest.done) scoped.delete(oldest.value);
  }
  return result;
};

const withIds = (content: ParsedInlineSvg, node: SvgNode): ParsedInlineSvg => {
  const parsed = inlineSvgFromNode(node);
  if (content.ids) parsed.ids = content.ids;
  return parsed;
};
