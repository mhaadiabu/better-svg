import type { HTMLAttributes } from "astro/types";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import type { AstroSvgOptions } from "./runtime.js";
export { registerLocalSvgs } from "../core/local.js";

import type { SvgPresentation } from "../core/presentation.js";

export interface Props
  extends Omit<HTMLAttributes<"svg">, "style">, AstroSvgOptions, SvgPresentation {
  style?: string;
}

declare const SVG: (props: Props) => ReturnType<AstroComponentFactory>;
export default SVG;
