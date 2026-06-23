import { domParserAvailable, parseInlineStyle } from "./ast";
import { hasUnsafeUrl, isSafeUrl } from "./url";

export type ParsedInlineSvg = {
  attrs: Record<string, string>;
  className?: string;
  style?: Record<string, string>;
  innerHTML: string;
};

export const parseInlineSvg = (markup: string, sanitize: boolean): ParsedInlineSvg | null => {
  if (!domParserAvailable()) return null;
  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(markup, "image/svg+xml");
  if (parsedDocument.querySelector("parsererror")) return null;
  const svg = parsedDocument.querySelector("svg");
  if (!svg) return null;

  if (sanitize) {
    svg
      .querySelectorAll("script, foreignObject, iframe, object, embed")
      .forEach((node) => node.remove());
    const walker = svg.ownerDocument.createTreeWalker(svg, NodeFilter.SHOW_ELEMENT);
    let current: Element | null = svg;
    while (current) {
      for (const attr of Array.from(current.attributes)) {
        const name = attr.name;
        if (name.startsWith("on")) {
          current.removeAttribute(name);
          continue;
        }
        if (name === "style" && hasUnsafeUrl(attr.value)) {
          current.removeAttribute(name);
          continue;
        }
        if (name === "href" || name === "xlink:href") {
          if (!isSafeUrl(attr.value)) current.removeAttribute(name);
        }
      }
      current = walker.nextNode() as Element | null;
    }
  }

  const attrs: Record<string, string> = {};
  for (const attr of Array.from(svg.attributes)) attrs[attr.name] = attr.value;

  const className = attrs.class;
  if (className) delete attrs.class;
  let style: Record<string, string> | undefined;
  if (attrs.style) {
    const parsed = parseInlineStyle(attrs.style);
    if (Object.keys(parsed).length > 0) style = parsed;
    delete attrs.style;
  }

  return { attrs, className, style, innerHTML: svg.innerHTML };
};
