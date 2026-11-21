import * as React from "react";
import { renderNode } from "./core/ast.js";
import { scopeParsedSvgIds } from "./core/ids.js";
import { unpackSvgNode, type PackedSvgNode } from "./core/packed-svg.js";
import { inlineSvgFromNode } from "./core/sanitize.js";
import { useSvgArtwork, type SvgArtworkProps } from "./svg-artwork.js";

export type StaticSvgProps = SvgArtworkProps & {
  uniqueIds?: boolean;
  onSvgLoad?: (markup: string) => void;
};

export const createStaticSvg = (node: PackedSvgNode) => {
  let content: ReturnType<typeof inlineSvgFromNode> | { packed: PackedSvgNode } = { packed: node };
  const getContent = () => {
    if ("packed" in content) content = inlineSvgFromNode(unpackSvgNode(content.packed));
    return content;
  };
  let markup: string | undefined;
  const StaticSvg = React.forwardRef<SVGSVGElement, StaticSvgProps>(
    ({ uniqueIds = true, onSvgLoad, ...props }, ref) => {
      const prefix = `svg-${React.useId()}`;
      const parsed = React.useMemo(() => {
        const parsed = getContent();
        return uniqueIds ? scopeParsedSvgIds(parsed, prefix) : parsed;
      }, [prefix, uniqueIds]);
      const onLoadRef = React.useRef(onSvgLoad);
      React.useEffect(() => {
        onLoadRef.current = onSvgLoad;
      });
      React.useEffect(() => {
        onLoadRef.current?.((markup ??= renderNode(getContent().node)));
      }, [uniqueIds]);
      return useSvgArtwork(parsed, props, ref, prefix);
    },
  );
  StaticSvg.displayName = "StaticSvg";
  return StaticSvg;
};
