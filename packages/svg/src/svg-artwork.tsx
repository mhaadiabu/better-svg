import * as React from "react";
import { withSvgColorOverrides } from "./core/colors.js";
import { rewriteSvgAttributes, withSvgRootId } from "./core/ids.js";
import {
  createSvgPresentation,
  svgDimensions,
  svgViewBox,
  type SvgPresentation,
} from "./core/presentation.js";
import type { ParsedInlineSvg } from "./core/sanitize.js";

export type SvgArtworkProps = Omit<
  React.SVGProps<SVGSVGElement>,
  "children" | "dangerouslySetInnerHTML" | "name" | "src"
> &
  SvgPresentation;

export const useSvgArtwork = (
  content: ParsedInlineSvg | null,
  { size, width, height, title, desc, className, style, fill, stroke, ...rest }: SvgArtworkProps,
  ref: React.ForwardedRef<SVGSVGElement>,
  prefix?: string,
) => {
  const [present] = React.useState(() => createSvgPresentation(prefix));
  const presented = React.useMemo(
    () =>
      content
        ? present(withSvgRootId(withSvgColorOverrides(content, { fill, stroke }), rest.id), {
            title,
            desc,
          })
        : null,
    [content, present, fill, stroke, rest.id, title, desc],
  );
  const markup = presented?.innerHTML ?? "";
  const innerHTML = React.useMemo(() => ({ __html: markup }), [markup]);

  if (!presented) return null;

  const mergedClassName = [presented.className, className].filter(Boolean).join(" ");
  const mergedStyle = presented.style ? { ...presented.style, ...style } : style;
  const rootProps =
    fill === undefined && stroke === undefined
      ? rest
      : {
          ...rest,
          ...(fill !== undefined ? { fill } : {}),
          ...(stroke !== undefined ? { stroke } : {}),
        };

  return (
    <svg
      ref={ref}
      {...presented.attrs}
      aria-labelledby={
        rest["aria-label"] !== undefined ? undefined : presented.attrs["aria-labelledby"]
      }
      {...svgDimensions({ size, width, height })}
      viewBox={svgViewBox(presented.attrs, { size, width, height, viewBox: rest.viewBox })}
      {...rewriteSvgAttributes(rootProps, presented.ids)}
      className={mergedClassName || undefined}
      style={rewriteSvgAttributes(mergedStyle ?? {}, presented.ids) as React.CSSProperties}
      dangerouslySetInnerHTML={innerHTML}
    />
  );
};
