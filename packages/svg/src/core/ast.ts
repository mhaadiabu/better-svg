import {
  hasUnsafeUrl,
  isSafeHrefUrl,
  isSafeResourceUrl,
  isSafeUrl,
  isSameDocumentUrl,
} from "./url.js";
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

const entities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};
const encodeEntity = (character: string) => entities[character] ?? character;

const encodeAttr = (value: string) => value.replace(/[&<>"]/g, encodeEntity);
const encodeText = (value: string) => value.replace(/[&<>]/g, encodeEntity);

export const domParserAvailable = () =>
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  typeof DOMParser !== "undefined";

export const toNodeFromElement = (element: Element | XmlElement): SvgNode => {
  const attrs: SvgAttribute[] = [];
  const xlinkNamespace = "http://www.w3.org/1999/xlink";
  let aliasedXlink = false;
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes.item(i);
    if (attr) {
      const name = attr.namespaceURI === xlinkNamespace ? `xlink:${attr.localName}` : attr.name;
      if (name !== attr.name) aliasedXlink = true;
      attrs.push({ name, value: attr.value });
    }
  }
  if (aliasedXlink) {
    const declaration = attrs.find((attr) => attr.name === "xmlns:xlink");
    if (declaration) declaration.value = xlinkNamespace;
    else attrs.push({ name: "xmlns:xlink", value: xlinkNamespace });
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
  let markup = `<${node.tag}`;
  for (const { name, value } of node.attrs) markup += ` ${name}="${encodeAttr(value)}"`;
  if (!html && node.children.length === 0) return `${markup}/>`;

  const tag = node.tag.toLowerCase();
  if (VOID_ELEMENTS.has(tag)) return `${markup}/>`;

  const htmlChildren = tag === "foreignobject" || (html && tag !== "svg");
  markup += ">";
  for (const child of node.children) markup += serializeNode(child, htmlChildren);
  return `${markup}</${node.tag}>`;
};

export const renderNode = (node: SvgNode): string => serializeNode(node, false);

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
