import type { Component } from "svelte";
import type { SvelteSvgProps } from "./runtime";

declare const SVG: Component<SvelteSvgProps>;
export default SVG;

export { createSvgController, parseSvgMarkup } from "./runtime";
export type { SvelteSvgProps, SvgState, ParsedSvg } from "./runtime";

