import type { Component } from "svelte";
import type { SvelteSvgProps } from "./runtime.js";

declare const SVG: Component<SvelteSvgProps>;
export default SVG;

export { createSvgController, parseSvgMarkup } from "./runtime.js";
export type { SvelteSvgProps, SvgState, ParsedSvg } from "./runtime.js";
