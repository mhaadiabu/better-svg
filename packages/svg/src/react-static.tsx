import * as React from "react";
import { renderNode, type SvgNode } from "./core/ast.js";
import { scopeParsedSvgIds } from "./core/ids.js";
import { inlineSvgFromNode } from "./core/sanitize.js";
import { useSvgArtwork, type SvgArtworkProps } from "./svg-artwork.js";

export type StaticSvgProps = SvgArtworkProps & {
  uniqueIds?: boolean;
  onSvgLoad?: (markup: string) => void;
};

export const createStaticSvg = (node: SvgNode) => {
  let content: ReturnType<typeof inlineSvgFromNode> | undefined;
  let markup: string | undefined;
  const StaticSvg = React.forwardRef<SVGSVGElement, StaticSvgProps>(
    ({ uniqueIds = true, onSvgLoad, ...props }, ref) => {
      const prefix = `svg-${React.useId()}`;
      const parsed = React.useMemo(() => {
        content ??= inlineSvgFromNode(node);
        return uniqueIds ? scopeParsedSvgIds(content, prefix) : content;
      }, [prefix, uniqueIds]);
      const onLoadRef = React.useRef(onSvgLoad);
      React.useEffect(() => {
        onLoadRef.current = onSvgLoad;
      });
      React.useEffect(() => {
        onLoadRef.current?.((markup ??= renderNode(node)));
      }, [uniqueIds]);
      return useSvgArtwork(parsed, props, ref, prefix);
    },
  );
  StaticSvg.displayName = "StaticSvg";
  return StaticSvg;
};
