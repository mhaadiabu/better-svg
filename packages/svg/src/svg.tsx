import * as React from "react";
import {
  domParserAvailable,
  hasUnsafeUrl,
  isSafeUrl,
  resolveMarkup,
  resolveSource,
  toCamelCase,
  type SvgNameInput,
} from "./core";

type ParsedSvg = {
  attrs: Record<string, string>;
  className?: string;
  style?: React.CSSProperties;
  innerHTML: string;
};

const svgCache = new Map<string, string>();

const parseInlineStyle = (styleText: string) => {
  const styles: Record<string, string> = {};
  for (const entry of styleText.split(";")) {
    const [rawProp, ...rawValue] = entry.split(":");
    if (!rawProp || rawValue.length === 0) continue;
    const prop = rawProp.trim();
    const value = rawValue.join(":").trim();
    if (!prop || !value) continue;
    styles[prop.startsWith("--") ? prop : toCamelCase(prop)] = value;
  }
  return Object.keys(styles).length > 0 ? (styles as React.CSSProperties) : undefined;
};

const parseSvgMarkup = (markup: string, sanitize: boolean): ParsedSvg | null => {
  if (!domParserAvailable()) return null;
  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(markup, "image/svg+xml");
  if (parsedDocument.querySelector("parsererror")) return null;
  const svg = parsedDocument.querySelector("svg");
  if (!svg) return null;

  if (sanitize) {
    svg
      .querySelectorAll("script, foreignObject, iframe, object, embed")
      .forEach((node) => node.remove());
    const walker = svg.ownerDocument.createTreeWalker(svg, NodeFilter.SHOW_ELEMENT);
    let current: Element | null = svg;
    while (current) {
      for (const attr of Array.from(current.attributes)) {
        const name = attr.name;
        if (name.startsWith("on")) {
          current.removeAttribute(name);
          continue;
        }
        if (name === "style" && hasUnsafeUrl(attr.value)) {
          current.removeAttribute(name);
          continue;
        }
        if (name === "href" || name === "xlink:href") {
          if (!isSafeUrl(attr.value)) current.removeAttribute(name);
        }
      }
      current = walker.nextNode() as Element | null;
    }
  }

  const attrs: Record<string, string> = {};
  for (const attr of Array.from(svg.attributes)) attrs[attr.name] = attr.value;

  const className = attrs.class;
  if (className) delete attrs.class;
  const style = attrs.style ? parseInlineStyle(attrs.style) : undefined;
  if (attrs.style) delete attrs.style;

  return {
    attrs,
    className,
    style,
    innerHTML: svg.innerHTML,
  };
};

type SvgSourceProps =
  | { src: string; name?: never }
  | { name: SvgNameInput; src?: never };

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
        onSvgError?.(err);
        return () => {
          active = false;
          controller.abort();
        };
      }

      const runWithCached = (markup: string) => {
        const parsed = parseSvgMarkup(markup, sanitize);
        if (!parsed) throw new Error("SVG markup is invalid or unavailable in this environment.");
        setContent(parsed);
        setIsLoading(false);
        onSvgLoad?.(markup);
      };

      if (cache && svgCache.has(resolvedSource)) {
        try {
          runWithCached(svgCache.get(resolvedSource) ?? "");
        } catch (err) {
          if (!active) return;
          const normalized = err instanceof Error ? err : new Error("Failed to load SVG.");
          setError(normalized);
          setIsLoading(false);
          onSvgError?.(normalized);
        }
        return () => {
          active = false;
          controller.abort();
        };
      }

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
          onSvgError?.(normalized);
        });

      return () => {
        active = false;
        controller.abort();
      };
    }, [resolvedSource, fetchOptions, cache, sanitize, onSvgLoad, onSvgError]);

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
