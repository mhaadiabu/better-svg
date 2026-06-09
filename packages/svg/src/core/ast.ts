import { hasUnsafeUrl, isSafeUrl } from "./url";

export type SvgAttribute = { name: string; value: string };

export type SvgNode = {
  tag: string;
  attrs: SvgAttribute[];
  children: SvgNode[];
  text?: string;
};

const DANGEROUS_TAGS = new Set(["script", "foreignobject", "iframe", "object", "embed"]);

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

const decodeEntities = (value: string) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const encodeAttr = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const encodeText = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const domParserAvailable = () =>
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  typeof DOMParser !== "undefined";

const toNodeFromElement = (element: Element): SvgNode => {
  const attrs: SvgAttribute[] = [];
  for (const attr of Array.from(element.attributes)) {
    attrs.push({ name: attr.name, value: attr.value });
  }
  const children: SvgNode[] = [];
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 1) {
      children.push(toNodeFromElement(child as Element));
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
  const openTag = cleaned.match(/<svg\b([^>]*)>/i);
  if (!openTag) return null;
  const openTagIndex = openTag.index ?? 0;
  const openTagEnd = openTagIndex + openTag[0].length;
  const lastClose = cleaned.lastIndexOf("</svg");
  if (lastClose < openTagEnd) return null;
  const inner = cleaned.slice(openTagEnd, lastClose);

  const root: SvgNode = {
    tag: "svg",
    attrs: parseAttributes(openTag[1] ?? ""),
    children: [],
  };

  const stack: SvgNode[] = [root];
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b([^>]*)>/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(inner))) {
    const before = inner.slice(cursor, match.index);
    if (before && stack.length > 0) {
      const parent = stack[stack.length - 1];
      if (parent) {
        if (before.trim().length > 0) {
          parent.children.push({ tag: "#text", attrs: [], children: [], text: before });
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
      parent.children.push({ tag: "#text", attrs: [], children: [], text: trailing });
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

export const sanitizeNode = (node: SvgNode): SvgNode | null => {
  const tagLower = node.tag.toLowerCase();
  if (tagLower === "#text") return node;
  if (DANGEROUS_TAGS.has(tagLower)) return null;

  const sanitizedAttrs: SvgAttribute[] = [];
  for (const attr of node.attrs) {
    const name = attr.name;
    const lower = name.toLowerCase();
    if (lower.startsWith("on")) continue;
    if (lower === "style" && hasUnsafeUrl(attr.value)) continue;
    if (lower === "href" || lower === "xlink:href") {
      if (!isSafeUrl(attr.value)) continue;
    }
    sanitizedAttrs.push(attr);
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

export const renderNode = (node: SvgNode): string => {
  if (node.tag === "#text") {
    return encodeText(node.text ?? "");
  }
  const attrText = node.attrs.map((attr) => ` ${attr.name}="${encodeAttr(attr.value)}"`).join("");
  if (VOID_ELEMENTS.has(node.tag.toLowerCase()) || node.children.length === 0) {
    return `<${node.tag}${attrText}/>`;
  }
  const inner = node.children.map(renderNode).join("");
  return `<${node.tag}${attrText}>${inner}</${node.tag}>`;
};

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
  } = { attributes: [...attrs] };

  const className = result.attributes.find((a) => a.name === "class");
  if (className) {
    result.className = className.value;
    result.attributes = result.attributes.filter((a) => a.name !== "class");
  }

  const styleAttr = result.attributes.find((a) => a.name === "style");
  if (styleAttr) {
    result.style = parseInlineStyle(styleAttr.value);
    result.attributes = result.attributes.filter((a) => a.name !== "style");
  }

  return result;
};
