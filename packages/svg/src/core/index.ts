export { resolveSvgSource } from "./local.js";
export type { SvgName, SvgNameInput } from "./local.js";
export { decodeDataUrl, hasUnsafeUrl, isInlineSvg, isSafeUrl } from "./url.js";
export { parseInlineSvg } from "./sanitize.js";
export type { ParsedInlineSvg } from "./sanitize.js";
export {
  parseSvgString,
  parseAndSanitize,
  parseInlineStyle,
  renderNode,
  sanitizeNode,
  splitAttributes,
  domParserAvailable,
  toCamelCase,
} from "./ast.js";
export type { SvgNode, SvgAttribute } from "./ast.js";
export { resolveMarkup, resolveSource } from "./resolve.js";
export { ensureParsedSvg, ensureParsedNode } from "./cache.js";
export { withSvgColorOverrides } from "./colors.js";
export type { SvgColorOverrides } from "./colors.js";
