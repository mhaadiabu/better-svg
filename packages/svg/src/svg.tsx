import * as React from "react";
import { ensureParsedSvg, resolveMarkup, resolveSource, type SvgNameInput } from "./core/index.js";
import { createSvgId, scopeParsedSvgIds } from "./core/ids.js";
import { getCachedMarkup } from "./core/cache.js";
import { decodeDataUrl, isInlineSvg } from "./core/url.js";

import type { ParsedInlineSvg } from "./core/sanitize.js";
import { useSvgArtwork, type SvgArtworkProps } from "./svg-artwork.js";

type SvgSourceProps = { src: string; name?: never } | { name: SvgNameInput; src?: never };

export type SvgProps = SvgArtworkProps &
  SvgSourceProps & {
    fetchOptions?: RequestInit;
    cache?: boolean;
    sanitize?: boolean;
    uniqueIds?: boolean;
    loading?: React.ReactNode;
    fallback?: React.ReactNode;
    onSvgLoad?: (markup: string) => void;
    onSvgError?: (error: Error) => void;
  };

type SvgComponent = React.ForwardRefExoticComponent<SvgProps & React.RefAttributes<SVGSVGElement>>;

type SvgResult = { content: ParsedInlineSvg; markup: string } | { error: Error };

const subscribeToClient = () => () => undefined;
const clientSnapshot = () => true;
const serverSnapshot = () => false;

const prepareSvg = (
  source: string,
  markup: string,
  {
    sanitize,
    cache,
    uniqueIds,
    prefix,
  }: {
    sanitize: boolean;
    cache: boolean;
    uniqueIds: boolean;
    prefix: string;
  },
): SvgResult => {
  try {
    const inline = ensureParsedSvg(source, markup, sanitize, cache);
    if (!inline) throw new Error("SVG markup is invalid or unavailable in this environment.");
    return { content: uniqueIds ? scopeParsedSvgIds(inline, prefix) : inline, markup };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error("Failed to load SVG.") };
  }
};

export const SVG: SvgComponent = React.forwardRef<SVGSVGElement, SvgProps>(
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
      ...rest
    },
    ref,
  ) => {
    const [prefix] = React.useState(createSvgId);
    const client = React.useSyncExternalStore(subscribeToClient, clientSnapshot, serverSnapshot);

    const resolvedSource = React.useMemo(() => resolveSource(src, name), [name, src]);
    const request = React.useMemo(
      () => ({ source: resolvedSource, fetchOptions, cache, sanitize, uniqueIds, prefix }),
      [resolvedSource, fetchOptions, cache, sanitize, uniqueIds, prefix],
    );
    const immediate = React.useMemo(() => {
      if (!client) return null;
      if (!request.source) return { error: new Error("Either name or src is required.") };
      const trimmed = request.source.trim();
      const markup = isInlineSvg(trimmed)
        ? trimmed
        : (decodeDataUrl(trimmed) ??
          (request.cache && request.fetchOptions === undefined
            ? getCachedMarkup(request.source)
            : undefined));
      return markup === undefined ? null : prepareSvg(request.source, markup, request);
    }, [request, client]);
    const [loaded, setLoaded] = React.useState<{
      request: typeof request;
      result: SvgResult;
    } | null>(null);
    const result = loaded?.request === request ? loaded.result : immediate;

    const onLoadRef = React.useRef(onSvgLoad);
    const onErrorRef = React.useRef(onSvgError);
    React.useEffect(() => {
      onLoadRef.current = onSvgLoad;
      onErrorRef.current = onSvgError;
    });

    React.useEffect(() => {
      if (!client) return;
      let active = true;
      const controller = immediate ? undefined : new AbortController();
      const resolution = controller
        ? resolveMarkup(request.source ?? "", {
            fetchOptions: request.fetchOptions,
            signal: controller.signal,
            cache: request.cache,
          }).then((markup) => prepareSvg(request.source ?? "", markup, request))
        : Promise.resolve(immediate);

      resolution
        .then((resolved) => {
          if (!active || !resolved) return;
          if ("error" in resolved) throw resolved.error;
          if (!immediate) setLoaded({ request, result: resolved });
          onLoadRef.current?.(resolved.markup);
        })
        .catch((err) => {
          if (!active) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          const normalized = err instanceof Error ? err : new Error("Failed to load SVG.");
          setLoaded({ request, result: { error: normalized } });
          onErrorRef.current?.(normalized);
        });

      return () => {
        active = false;
        controller?.abort();
      };
    }, [request, immediate, client]);

    const content = result && "content" in result ? result.content : null;
    const artwork = useSvgArtwork(content, rest, ref);
    if (!result) return loading ? <>{loading}</> : null;
    return artwork ?? (fallback ? <>{fallback}</> : null);
  },
);

SVG.displayName = "SVG";
