import { parseXmlNode } from "../core/xml.js";
import type { PrecompiledLocalSvg } from "../core/local.js";
import { packSvgNode } from "../core/packed-svg.js";

const parsePrecompiledSvg = (markup: string, name: string, sanitize: boolean) => {
  const node = parseXmlNode(markup, sanitize);
  if (!node) {
    throw new Error(`Precompile pass failed for "${name}": markup is not a valid SVG document.`);
  }
  return node;
};

export const buildPrecompiledSvg = (markup: string, name: string): PrecompiledLocalSvg => ({
  node: parsePrecompiledSvg(markup, name, true),
});

export const buildPackedSvg = (markup: string, name: string, sanitize = false) =>
  packSvgNode(parsePrecompiledSvg(markup, name, sanitize));
