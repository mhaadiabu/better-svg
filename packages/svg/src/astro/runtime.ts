import { ensureParsedSvg } from "../core/cache.js";
import { parseXmlSvg } from "../core/xml.js";
import { resolveMarkup, resolveSource } from "../core/resolve.js";
import { decodeDataUrl, isInlineSvg } from "../core/url.js";
import type { ParsedInlineSvg } from "../core/sanitize.js";
import type { WebSvgOptions } from "../core/web.js";
import { createSvgId, scopeParsedSvgIds } from "../core/ids.js";

export type AstroSvgOptions = WebSvgOptions & { allowedOrigins?: readonly string[] };

export const loadAstroSvg = async (
  options: AstroSvgOptions,
  baseUrl: URL,
): Promise<ParsedInlineSvg> => {
  let source = resolveSource(options.src, options.name);
  if (!source) throw new Error("Either name or src is required.");
  if (!isInlineSvg(source.trim()) && !decodeDataUrl(source.trim())) {
    const destination = new URL(source, baseUrl);
    if (!["http:", "https:"].includes(destination.protocol))
      throw new Error("SVG URLs must use HTTP or HTTPS.");
    if (
      destination.origin !== baseUrl.origin &&
      !options.allowedOrigins?.includes(destination.origin)
    ) {
      throw new Error(`SVG origin is not allowed: ${destination.origin}`);
    }
    source = destination.href;
  }
  const markup = await resolveMarkup(source, {
    signal: options.fetchOptions?.signal ?? new AbortController().signal,
    fetchOptions: options.fetchOptions,
    cache: options.cache ?? true,
    redirect: "error",
  });
  const content = ensureParsedSvg(
    source,
    markup,
    options.sanitize ?? true,
    options.cache ?? true,
    parseXmlSvg,
  );
  if (!content) throw new Error("SVG markup is invalid.");
  options.onSvgLoad?.(markup);
  return options.uniqueIds === false ? content : scopeParsedSvgIds(content, createSvgId());
};
