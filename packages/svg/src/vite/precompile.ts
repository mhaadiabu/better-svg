import { parseXmlNode } from "../core/xml";
import type { PrecompiledLocalSvg } from "../core/local";

export const buildPrecompiledSvg = (markup: string, name: string): PrecompiledLocalSvg => {
  const node = parseXmlNode(markup, true);
  if (!node) {
    throw new Error(`Precompile pass failed for "${name}": markup is not a valid SVG document.`);
  }
  return { node };
};
