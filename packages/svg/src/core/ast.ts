import {
  hasUnsafeUrl,
  isSafeHrefUrl,
  isSafeResourceUrl,
  isSafeUrl,
  isSameDocumentUrl,
} from "./url";
import type { Element as XmlElement } from "@xmldom/xmldom";

export type SvgAttribute = { name: string; value: string };

export type SvgNode = {
  tag: string;
  attrs: SvgAttribute[];
  children: SvgNode[];
  text?: string;
};

const SVG_TAGS = new Set([
  "svg",
  "a",
  "circle",
  "clippath",
  "defs",
  "desc",
  "ellipse",
  "feblend",
  "fecolormatrix",
  "fecomponenttransfer",
  "fecomposite",
  "feconvolvematrix",
  "fediffuselighting",
  "fedisplacementmap",
  "fedistantlight",
  "fedropshadow",
  "feflood",
  "fefunca",
  "fefuncb",
  "fefuncg",
  "fefuncr",
  "fegaussianblur",
  "feimage",
  "femerge",
  "femergenode",
  "femorphology",
  "feoffset",
  "fepointlight",
  "fespecularlighting",
  "fespotlight",
  "fetile",
  "feturbulence",
  "filter",
  "g",
  "image",
  "line",
  "lineargradient",
  "marker",
  "mask",
  "metadata",
  "mpath",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialgradient",
  "rect",
  "stop",
  "switch",
  "symbol",
  "text",
  "textpath",
  "title",
  "tspan",
  "use",
  "view",
]);

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const XML_ENTITIES: Record<string, string> = {
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  amp: "&",
};

const decodeEntities = (value: string) =>
  value.replace(
    /&(#(?:[xX][0-9a-fA-F]+|[0-9]+)|lt|gt|quot|apos|amp);/g,
    (match, entity: string) => {
      if (!entity.startsWith("#")) return XML_ENTITIES[entity] ?? match;
      const hexadecimal = entity[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      if (codePoint === 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        return "\uFFFD";
      }
      return String.fromCodePoint(codePoint);
    },
  );

const encodeAttr = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const encodeText = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const domParserAvailable = () =>
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  typeof DOMParser !== "undefined";

export const toNodeFromElement = (element: Element | XmlElement): SvgNode => {
  const attrs: SvgAttribute[] = [];
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes.item(i);
    if (attr) attrs.push({ name: attr.name, value: attr.value });
  }
  const children: SvgNode[] = [];
  for (let child = element.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1) {
      children.push(toNodeFromElement(child as Element | XmlElement));
    } else if (child.nodeType === 8) {
      children.push({ tag: "#comment", attrs: [], children: [], text: child.nodeValue ?? "" });
    } else if (child.nodeType === 3 || child.nodeType === 4) {
      const text = child.nodeValue ?? "";
      if (text.length > 0) {
        children.push({ tag: "#text", attrs: [], children: [], text });
      }
    }
  }
  return { tag: element.tagName, attrs, children };
};

const parseAttributes = (raw: string): SvgAttribute[] => {
  const attrs: SvgAttribute[] = [];
  const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) {
    const name = match[1] ?? "";
    const value = match[3] ?? match[4] ?? match[5] ?? "";
    if (!name) continue;
    attrs.push({ name, value: decodeEntities(value) });
  }
  return attrs;
};

const parseWithRegex = (markup: string): SvgNode | null => {
  const cleaned = markup.replace(/<\?xml[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[\s\S]*?>/gi, "");
  const openTag = cleaned.match(/<svg\b((?:"[^"]*"|'[^']*'|[^'">])*)>/i);
  if (!openTag) return null;
  const openTagIndex = openTag.index ?? 0;
  const openTagEnd = openTagIndex + openTag[0].length;
  const root: SvgNode = {
    tag: "svg",
    attrs: parseAttributes(openTag[1] ?? ""),
    children: [],
  };
  if (/\/\s*>$/.test(openTag[0])) return root;
  const lastClose = cleaned.lastIndexOf("</svg");
  if (lastClose < openTagEnd) return null;
  const inner = cleaned.slice(openTagEnd, lastClose);

  const stack: SvgNode[] = [root];
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(inner))) {
    const before = inner.slice(cursor, match.index);
    if (before && stack.length > 0) {
      const parent = stack[stack.length - 1];
      if (parent) {
        if (before.trim().length > 0) {
          parent.children.push({
            tag: "#text",
            attrs: [],
            children: [],
            text: decodeEntities(before),
          });
        }
      }
    }

    const full = match[0];
    const tag = (match[1] ?? "").toLowerCase();
    const attrs = parseAttributes(match[2] ?? "");
    const isClose = full.startsWith("</");
    const isSelfClose = !isClose && (full.endsWith("/>") || VOID_ELEMENTS.has(tag));

    if (isClose) {
      let depth = stack.length - 1;
      while (depth > 0) {
        const top = stack[depth];
        if (top && top.tag.toLowerCase() === tag) break;
        depth--;
      }
      if (depth > 0) stack.length = depth;
    } else {
      const node: SvgNode = { tag, attrs, children: [] };
      const parent = stack[stack.length - 1];
      if (parent) parent.children.push(node);
      if (!isSelfClose) stack.push(node);
    }

    cursor = match.index + full.length;
  }

  const trailing = inner.slice(cursor);
  if (trailing && stack.length > 0) {
    const parent = stack[stack.length - 1];
    if (parent && trailing.trim().length > 0) {
      parent.children.push({
        tag: "#text",
        attrs: [],
        children: [],
        text: decodeEntities(trailing),
      });
    }
  }

  return root;
};

const parseWithDom = (markup: string): SvgNode | null => {
  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(markup, "image/svg+xml");
  if (parsedDocument.querySelector("parsererror")) return null;
  const svg = parsedDocument.querySelector("svg");
  if (!svg) return null;
  return toNodeFromElement(svg);
};

export const parseSvgString = (markup: string): SvgNode | null => {
  if (domParserAvailable()) {
    return parseWithDom(markup);
  }
  return parseWithRegex(markup);
};

const hrefLikeAttributeIsUnsafe = (tagLower: string, value: string) => {
  if (tagLower === "use") return !isSameDocumentUrl(value);
  if (tagLower === "image" || tagLower === "feimage") return !isSafeResourceUrl(value);
  if (tagLower === "a") return !isSafeHrefUrl(value);
  return !isSafeUrl(value);
};

const attributeIsDropped = (tagLower: string, attr: SvgAttribute) => {
  const colon = attr.name.lastIndexOf(":");
  const localName = attr.name.slice(colon + 1).toLowerCase();
  if (localName.startsWith("on")) return true;
  if (localName === "style") return hasUnsafeUrl(attr.value);
  if (localName === "href") return hrefLikeAttributeIsUnsafe(tagLower, attr.value);
  return false;
};

export const sanitizeNode = (node: SvgNode): SvgNode | null => {
  const tagLower = node.tag.toLowerCase();
  if (tagLower === "#text") return node;
  if (!SVG_TAGS.has(tagLower)) return null;

  const sanitizedAttrs: SvgAttribute[] = [];
  for (const attr of node.attrs) {
    if (!attributeIsDropped(tagLower, attr)) sanitizedAttrs.push(attr);
  }

  const sanitizedChildren: SvgNode[] = [];
  for (const child of node.children) {
    const cleaned = sanitizeNode(child);
    if (cleaned) sanitizedChildren.push(cleaned);
  }

  return {
    tag: node.tag,
    attrs: sanitizedAttrs,
    children: sanitizedChildren,
    text: node.text,
  };
};

const serializeNode = (node: SvgNode, html: boolean): string => {
  if (node.tag === "#comment") return `<!--${node.text ?? ""}-->`;
  if (node.tag === "#text") {
    return encodeText(node.text ?? "");
  }
  const attrText = node.attrs.map((attr) => ` ${attr.name}="${encodeAttr(attr.value)}"`).join("");
  const tag = node.tag.toLowerCase();
  if (VOID_ELEMENTS.has(tag) || (!html && node.children.length === 0)) {
    return `<${node.tag}${attrText}/>`;
  }
  const htmlChildren = tag === "foreignobject" || (html && tag !== "svg");
  const inner = node.children.map((child) => serializeNode(child, htmlChildren)).join("");
  return `<${node.tag}${attrText}>${inner}</${node.tag}>`;
};

export const renderNode = (node: SvgNode): string => serializeNode(node, false);

export const parseAndSanitize = (markup: string, sanitize: boolean): SvgNode | null => {
  const root = parseSvgString(markup);
  if (!root) return null;
  const cleaned = sanitize ? sanitizeNode(root) : root;
  return cleaned;
};

export const toCamelCase = (value: string) =>
  value.replace(/^-/, "").replace(/-([a-z])/g, (_, char) => char.toUpperCase());

export const parseInlineStyle = (styleText: string): Record<string, string> => {
  const styles: Record<string, string> = {};
  for (const entry of styleText.split(";")) {
    const [rawProp, ...rawValue] = entry.split(":");
    if (!rawProp || rawValue.length === 0) continue;
    const prop = rawProp.trim();
    const value = rawValue.join(":").trim();
    if (!prop || !value) continue;
    styles[prop.startsWith("--") ? prop : toCamelCase(prop)] = value;
  }
  return styles;
};

export const splitAttributes = (attrs: SvgAttribute[]) => {
  const result: {
    attributes: SvgAttribute[];
    className?: string;
    style?: Record<string, string>;
    styleText?: string;
  } = { attributes: [...attrs] };

  const className =
    result.attributes.find((a) => a.name === "class") ??
    result.attributes.find((a) => a.name.toLowerCase() === "class");
  if (className) {
    result.className = className.value;
    result.attributes = result.attributes.filter((a) => a.name.toLowerCase() !== "class");
  }

  const styleAttr =
    result.attributes.find((a) => a.name === "style") ??
    result.attributes.find((a) => a.name.toLowerCase() === "style");
  if (styleAttr) {
    result.style = parseInlineStyle(styleAttr.value);
    result.styleText = styleAttr.value;
    result.attributes = result.attributes.filter((a) => a.name.toLowerCase() !== "style");
  }

  return result;
};
