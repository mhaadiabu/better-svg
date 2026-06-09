export { resolveSvgSource } from "./local";
export type { SvgName, SvgNameInput } from "./local";
export { decodeDataUrl, hasUnsafeUrl, isInlineSvg, isSafeUrl } from "./url";
export {
  parseSvgString,
  parseAndSanitize,
  parseInlineStyle,
  renderNode,
  sanitizeNode,
  splitAttributes,
  domParserAvailable,
  toCamelCase,
} from "./ast";
export type { SvgNode, SvgAttribute } from "./ast";
export { resolveMarkup, resolveSource } from "./resolve";
