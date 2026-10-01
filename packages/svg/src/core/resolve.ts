import { decodeDataUrl, isInlineSvg } from "./url";
import { resolveSvgSource as resolveLocalSvg, type SvgNameInput } from "./local";
import { cacheMarkup, getCachedMarkup } from "./cache";

const pending = new Map<string, object>();

export type ResolveOptions = {
  fetchOptions?: RequestInit;
  signal: AbortSignal;
  cache: boolean;
};

export const resolveMarkup = async (source: string, options: ResolveOptions): Promise<string> => {
  const trimmed = source.trim();
  if (!trimmed) throw new Error("SVG src is required.");
  if (isInlineSvg(trimmed)) return trimmed;
  const dataSvg = decodeDataUrl(trimmed);
  if (dataSvg) return dataSvg;

  const useCache = options.cache && options.fetchOptions === undefined;
  if (useCache) {
    const cached = getCachedMarkup(source);
    if (cached !== undefined) return cached;
  }

  const fetchImpl = typeof fetch === "function" ? fetch : undefined;
  if (!fetchImpl) throw new Error("Fetch is not available in this environment.");

  const headers = new Headers(options.fetchOptions?.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "image/svg+xml");
  }

  const request = {};
  if (useCache) pending.set(source, request);
  try {
    const response = await fetchImpl(source, {
      ...options.fetchOptions,
      headers,
      signal: options.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch SVG: ${response.status} ${response.statusText}`);
    }

    const markup = await response.text();
    const directives = (response.headers.get("Cache-Control") ?? "")
      .toLowerCase()
      .split(",")
      .map((directive) => directive.split("=")[0]?.trim());
    const publicResponse =
      directives.includes("public") &&
      !directives.some((directive) =>
        ["private", "no-store", "no-cache"].includes(directive ?? ""),
      );
    if (useCache && publicResponse && !options.signal.aborted && pending.get(source) === request) {
      cacheMarkup(source, markup);
    }
    return markup;
  } finally {
    if (pending.get(source) === request) pending.delete(source);
  }
};

export const resolveSource = (src: string | undefined, name: SvgNameInput | undefined) => {
  if (name) return resolveLocalSvg(name);
  return src;
};
