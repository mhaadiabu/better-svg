import {
  domParserAvailable,
  renderNode,
  sanitizeNode,
  splitAttributes,
  toNodeFromElement,
} from "./ast";

export type ParsedInlineSvg = {
  attrs: Record<string, string>;
  className?: string;
  style?: Record<string, string>;
  styleText?: string;
  innerHTML: string;
};

export const parseInlineSvg = (markup: string, sanitize: boolean): ParsedInlineSvg | null => {
  if (!domParserAvailable()) return null;
  const parsedDocument = new DOMParser().parseFromString(markup, "image/svg+xml");
  if (parsedDocument.querySelector("parsererror")) return null;
  const svg = parsedDocument.querySelector("svg");
  if (!svg) return null;
  const node = toNodeFromElement(svg);
  const root = sanitize ? sanitizeNode(node) : node;
  if (!root) return null;
  const { attributes, className, style, styleText } = splitAttributes(root.attrs);
  const attrs = Object.fromEntries(attributes.map(({ name, value }) => [name, value]));
  const innerHTML = sanitize ? root.children.map(renderNode).join("") : svg.innerHTML;
  return { attrs, className, style, styleText, innerHTML };
};
