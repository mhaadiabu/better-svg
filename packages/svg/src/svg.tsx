import * as React from "react";

type ParsedSvg = {
  attrs: Record<string, string>;
  className?: string;
  style?: React.CSSProperties;
  innerHTML: string;
};

const svgCache = new Map<string, string>();

const canUseDOM =
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  typeof DOMParser !== "undefined";

const isInlineSvg = (source: string) => {
  const trimmed = source.trim();
  return trimmed.startsWith("<svg") || trimmed.startsWith("<?xml");
};

const decodeDataUrl = (source: string) => {
  const match = source.match(/^data:image\/svg\+xml(?:;charset=[^;,]+)?(;base64)?,(.*)$/i);
  if (!match) return null;
  const isBase64 = Boolean(match[1]);
  const data = match[2] ?? "";
  try {
    if (isBase64) {
      if (typeof atob === "function") return atob(data);
      return null;
    }
    return decodeURIComponent(data);
  } catch {
    return null;
  }
};

const isSafeUrl = (value: string) => {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed || trimmed.startsWith("#")) return true;
  if (trimmed.startsWith("//")) return true;
  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!schemeMatch) return true;
  const scheme = schemeMatch[1];
  if (!scheme) return false;
  const normalized = scheme.toLowerCase();
  if (normalized === "http" || normalized === "https" || normalized === "blob") {
    return true;
  }
  if (normalized === "data") return /^data:image\//i.test(trimmed);
  return false;
};

const hasUnsafeUrl = (value: string) => {
  const pattern = /url\(([^)]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    const raw = match[1]?.trim() ?? "";
    if (!isSafeUrl(raw)) return true;
  }
  return false;
};

const sanitizeSvg = (root: SVGElement) => {
  root
    .querySelectorAll("script, foreignObject, iframe, object, embed")
    .forEach((node) => node.remove());

  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let current: Element | null = root;
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
        if (!isSafeUrl(attr.value)) {
          current.removeAttribute(name);
        }
      }
    }
    current = walker.nextNode() as Element | null;
  }
};

const toCamelCase = (value: string) => value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());

const parseInlineStyle = (styleText: string) => {
  const styles: Record<string, string> = {};
  for (const entry of styleText.split(";")) {
    const [rawProp, ...rawValue] = entry.split(":");
    if (!rawProp || rawValue.length === 0) continue;
    const prop = rawProp.trim();
    const value = rawValue.join(":").trim();
    if (!prop || !value) continue;
    if (prop.startsWith("--")) {
      styles[prop] = value;
      continue;
    }
    styles[toCamelCase(prop)] = value;
  }
  return Object.keys(styles).length > 0 ? (styles as React.CSSProperties) : undefined;
};

const parseSvgMarkup = (markup: string, sanitize: boolean): ParsedSvg | null => {
  if (!canUseDOM) return null;
  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(markup, "image/svg+xml");
  if (parsedDocument.querySelector("parsererror")) return null;
  const svg = parsedDocument.querySelector("svg");
  if (!svg) return null;
  if (sanitize) sanitizeSvg(svg);

  const attrs: Record<string, string> = {};
  for (const attr of Array.from(svg.attributes)) {
    attrs[attr.name] = attr.value;
  }

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

const resolveMarkup = async (
  source: string,
  fetchOptions: RequestInit | undefined,
  signal: AbortSignal,
  cache: boolean,
) => {
  const trimmed = source.trim();
  if (!trimmed) {
    throw new Error("SVG src is required.");
  }
  if (isInlineSvg(trimmed)) return trimmed;
  const dataSvg = decodeDataUrl(trimmed);
  if (dataSvg) return dataSvg;
  if (cache && svgCache.has(source)) {
    return svgCache.get(source) ?? trimmed;
  }

  const headers = new Headers(fetchOptions?.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "image/svg+xml");
  }

  const response = await fetch(source, {
    ...fetchOptions,
    headers,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch SVG: ${response.status} ${response.statusText}`);
  }

  const markup = await response.text();
  if (cache) svgCache.set(source, markup);
  return markup;
};

export type SvgProps = Omit<
  React.SVGProps<SVGSVGElement>,
  "children" | "dangerouslySetInnerHTML"
> & {
  src: string;
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

    React.useEffect(() => {
      let active = true;
      const controller = new AbortController();
      setIsLoading(true);
      setError(null);
      setContent(null);

      resolveMarkup(src, fetchOptions, controller.signal, cache)
        .then((markup) => {
          if (!active) return;
          const parsed = parseSvgMarkup(markup, sanitize);
          if (!parsed) {
            throw new Error("SVG markup is invalid or unavailable in this environment.");
          }
          setContent(parsed);
          setIsLoading(false);
          onSvgLoad?.(markup);
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
    }, [src, fetchOptions, cache, sanitize, onSvgLoad, onSvgError]);

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
