import {
  domParserAvailable,
  renderNode,
  sanitizeNode,
  splitAttributes,
  toNodeFromElement,
  type SvgNode,
} from "./ast.js";

export type ParsedInlineSvg<Style = Record<string, string>> = {
  node: SvgNode;
  ids?: ReadonlyMap<string, string>;
  attrs: Record<string, string>;
  className?: string;
  style?: Style;
  styleText?: string;
  innerHTML: string;
};

export const inlineSvgFromNode = (
  node: SvgNode,
  innerHTML?: string | (() => string),
): ParsedInlineSvg => {
  const { attributes, className, style, styleText } = splitAttributes(node.attrs);
  return {
    attrs: Object.fromEntries(attributes.map(({ name, value }) => [name, value])),
    className,
    style,
    styleText,
    node,
    get innerHTML() {
      return (innerHTML =
        typeof innerHTML === "function"
          ? innerHTML()
          : (innerHTML ?? node.children.map(renderNode).join("")));
    },
  };
};

export const parseInlineSvg = (markup: string, sanitize: boolean): ParsedInlineSvg | null => {
  if (!domParserAvailable()) return null;
  const parsedDocument = new DOMParser().parseFromString(markup, "image/svg+xml");
  if (parsedDocument.querySelector("parsererror")) return null;
  const rootElement = parsedDocument.documentElement;
  const svg = rootElement?.tagName === "svg" ? rootElement : parsedDocument.querySelector("svg");
  if (!svg) return null;
  const node = toNodeFromElement(svg);
  const root = sanitize ? sanitizeNode(node) : node;
  if (!root) return null;
  return inlineSvgFromNode(root, sanitize ? undefined : svg.innerHTML);
};
