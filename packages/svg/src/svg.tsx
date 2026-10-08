import * as React from "react";
import { ensureParsedSvg, resolveMarkup, resolveSource, type SvgNameInput } from "./core";
import { withSvgColorOverrides } from "./core/colors";
import { createSvgId, rewriteSvgAttributes, scopeParsedSvgIds, withSvgRootId } from "./core/ids";

import type { ParsedInlineSvg } from "./core/sanitize";
import {
  createSvgPresentation,
  svgDimensions,
  svgViewBox,
  type SvgPresentation,
} from "./core/presentation";

type SvgSourceProps = { src: string; name?: never } | { name: SvgNameInput; src?: never };

export type SvgProps = Omit<React.SVGProps<SVGSVGElement>, "children" | "dangerouslySetInnerHTML"> &
  SvgSourceProps &
  SvgPresentation & {
    fetchOptions?: RequestInit;
    cache?: boolean;
    sanitize?: boolean;
    uniqueIds?: boolean;
    loading?: React.ReactNode;
    fallback?: React.ReactNode;
    onSvgLoad?: (markup: string) => void;
    onSvgError?: (error: Error) => void;
  };

export const SVG = React.forwardRef<SVGSVGElement, SvgProps>(
  (
    {
      src,
      name,
      fetchOptions,
      cache = true,
      sanitize = true,
      uniqueIds = true,
      loading,
      fallback,
      onSvgLoad,
      onSvgError,
      size,
      width,
      height,
      title,
      desc,
      className,
      style,
      fill,
      stroke,
      ...rest
    },
    ref,
  ) => {
    const [content, setContent] = React.useState<ParsedInlineSvg | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);
    const [prefix] = React.useState(createSvgId);
    const [present] = React.useState(() => createSvgPresentation());

    const resolvedSource = React.useMemo(() => resolveSource(src, name), [name, src]);

    const onLoadRef = React.useRef(onSvgLoad);
    const onErrorRef = React.useRef(onSvgError);
    React.useEffect(() => {
      onLoadRef.current = onSvgLoad;
      onErrorRef.current = onSvgError;
    });

    React.useEffect(() => {
      let active = true;
      const controller = new AbortController();
      setIsLoading(true);
      setError(null);
      setContent(null);

      if (!resolvedSource) {
        const err = new Error("Either name or src is required.");
        setError(err);
        setIsLoading(false);
        onErrorRef.current?.(err);
        return () => {
          active = false;
          controller.abort();
        };
      }

      const runWithCached = (markup: string) => {
        const inline = ensureParsedSvg(resolvedSource, markup, sanitize, cache);
        if (!inline) throw new Error("SVG markup is invalid or unavailable in this environment.");
        const scoped = uniqueIds ? scopeParsedSvgIds(inline, prefix) : inline;
        setContent(scoped);
        setIsLoading(false);
        onLoadRef.current?.(markup);
      };

      resolveMarkup(resolvedSource, { fetchOptions, signal: controller.signal, cache })
        .then((markup) => {
          if (!active) return;
          runWithCached(markup);
        })
        .catch((err) => {
          if (!active) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          const normalized = err instanceof Error ? err : new Error("Failed to load SVG.");
          setError(normalized);
          setIsLoading(false);
          onErrorRef.current?.(normalized);
        });

      return () => {
        active = false;
        controller.abort();
      };
    }, [resolvedSource, fetchOptions, cache, sanitize, uniqueIds, prefix]);

    if (isLoading) {
      return loading ? <>{loading}</> : null;
    }

    if (error || !content) {
      return fallback ? <>{fallback}</> : null;
    }

    const colored = withSvgColorOverrides(content, { fill, stroke });
    const presented = present(withSvgRootId(colored, rest.id), { title, desc });
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
        dangerouslySetInnerHTML={{ __html: presented.innerHTML }}
      />
    );
  },
);

SVG.displayName = "SVG";
