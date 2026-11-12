import { DOMParser } from "@xmldom/xmldom";
import { sanitizeNode, toNodeFromElement } from "./ast.js";
import { inlineSvgFromNode } from "./sanitize.js";

export const parseXmlNode = (markup: string, sanitize: boolean) => {
  try {
    const document = new DOMParser({
      xmlns: { xlink: "http://www.w3.org/1999/xlink" },
      onError: (_level, message) => {
        throw new Error(`Invalid SVG markup: ${message}`);
      },
    }).parseFromString(markup, "image/svg+xml");
    const element = document.documentElement;
    if (!element || element.tagName !== "svg") return null;
    const node = toNodeFromElement(element);
    return sanitize ? sanitizeNode(node) : node;
  } catch {
    return null;
  }
};

export const parseXmlSvg = (markup: string, sanitize: boolean) => {
  const node = parseXmlNode(markup, sanitize);
  return node ? inlineSvgFromNode(node) : null;
};
