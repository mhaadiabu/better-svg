import * as React from "react";
import {
  parseInlineSvg,
  resolveMarkup,
  resolveSource,
  type SvgNameInput,
} from "./core";

type ParsedSvg = {
  attrs: Record<string, string>;
  className?: string;
  style?: React.CSSProperties;
  innerHTML: string;
};

const svgCache = new Map<string, string>();

type SvgSourceProps = { src: string; name?: never } | { name: SvgNameInput; src?: never };

export type SvgProps = Omit<React.SVGProps<SVGSVGElement>, "children" | "dangerouslySetInnerHTML"> &
  SvgSourceProps & {
    fetchOptions?: RequestInit;
    cache?: boolean;
    sanitize?: boolean;
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
      loading,
      fallback,
      onSvgLoad,
      onSvgError,
      className,
      style,
      ...rest
    },
    ref,
  ) => {
    const [content, setContent] = React.useState<ParsedSvg | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);

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
        const inline = parseInlineSvg(markup, sanitize);
        if (!inline) throw new Error("SVG markup is invalid or unavailable in this environment.");
        const parsed: ParsedSvg = {
          attrs: inline.attrs,
          className: inline.className,
          style: inline.style as React.CSSProperties | undefined,
          innerHTML: inline.innerHTML,
        };
        setContent(parsed);
        setIsLoading(false);
        onLoadRef.current?.(markup);
      };

      if (cache && svgCache.has(resolvedSource)) {
        try {
          runWithCached(svgCache.get(resolvedSource) ?? "");
        } catch (err) {
          if (!active) return;
          const normalized = err instanceof Error ? err : new Error("Failed to load SVG.");
          setError(normalized);
          setIsLoading(false);
          onErrorRef.current?.(normalized);
        }
        return () => {
          active = false;
          controller.abort();
        };
      }

      resolveMarkup(resolvedSource, { fetchOptions, signal: controller.signal, cache })
        .then((markup) => {
          if (!active) return;
          if (cache) svgCache.set(resolvedSource, markup);
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
    }, [resolvedSource, fetchOptions, cache, sanitize]);

    if (isLoading) {
      return loading ? <>{loading}</> : null;
    }

    if (error || !content) {
      return fallback ? <>{fallback}</> : null;
    }

    const mergedClassName = [content.className, className].filter(Boolean).join(" ");
    const mergedStyle = content.style ? { ...content.style, ...style } : style;

    return (
      <svg
        ref={ref}
        {...content.attrs}
        {...rest}
        className={mergedClassName || undefined}
        style={mergedStyle}
        dangerouslySetInnerHTML={{ __html: content.innerHTML }}
      />
    );
  },
);

SVG.displayName = "SVG";
