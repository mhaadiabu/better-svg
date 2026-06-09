import { decodeDataUrl, isInlineSvg } from "./url";
import { resolveSvgSource as resolveLocalSvg, type SvgNameInput } from "./local";

export type ResolveOptions = {
  fetchOptions?: RequestInit;
  signal: AbortSignal;
  cache: boolean;
};

export const resolveMarkup = async (
  source: string,
  options: ResolveOptions,
): Promise<string> => {
  const trimmed = source.trim();
  if (!trimmed) throw new Error("SVG src is required.");
  if (isInlineSvg(trimmed)) return trimmed;
  const dataSvg = decodeDataUrl(trimmed);
  if (dataSvg) return dataSvg;

  const fetchImpl = typeof fetch === "function" ? fetch : undefined;
  if (!fetchImpl) throw new Error("Fetch is not available in this environment.");

  const headers = new Headers(options.fetchOptions?.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "image/svg+xml");
  }

  const response = await fetchImpl(source, {
    ...options.fetchOptions,
    headers,
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch SVG: ${response.status} ${response.statusText}`);
  }

  return await response.text();
};

export const resolveSource = (src: string | undefined, name: SvgNameInput | undefined) => {
  if (name) return resolveLocalSvg(name);
  return src;
};
