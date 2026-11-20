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

export const registrySvgTokens =
  "svg g path circle rect ellipse line polygon polyline xmlns viewBox width height d fill stroke stroke-linecap stroke-linejoin stroke-width cx cy r x y rx ry http://www.w3.org/2000/svg currentColor none round".split(
    " ",
  );

const registryTokenIds = new Map(registrySvgTokens.map((token, index) => [token, index]));

export const buildPackedRegistrySvg = (markup: string, name: string) =>
  packSvgNode(
    parsePrecompiledSvg(markup, name, false),
    (token) => registryTokenIds.get(token) ?? token,
  );
