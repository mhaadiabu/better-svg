import { parseAndSanitize, type SvgNode } from "./ast";
import { parseInlineSvg, type ParsedInlineSvg } from "./sanitize";

type CacheKey = string;

const cache = new Map<CacheKey, ParsedInlineSvg>();

const keyFor = (source: string, sanitize: boolean): CacheKey =>
  `${sanitize ? "s:" : "u:"}${source}`;

export const getCachedParsedSvg = (
  source: string,
  sanitize: boolean,
): ParsedInlineSvg | null => {
  const entry = cache.get(keyFor(source, sanitize));
  return entry ?? null;
};

export const cacheParsedSvg = (
  source: string,
  sanitize: boolean,
  parsed: ParsedInlineSvg,
): void => {
  cache.set(keyFor(source, sanitize), parsed);
};

export const clearSvgCache = (): void => {
  cache.clear();
};

export const __svgCacheSize = (): number => cache.size;

export const ensureParsedSvg = (
  source: string,
  markup: string,
  sanitize: boolean,
): ParsedInlineSvg | null => {
  const cached = getCachedParsedSvg(source, sanitize);
  if (cached) return cached;
  const parsed = parseInlineSvg(markup, sanitize);
  if (parsed) cacheParsedSvg(source, sanitize, parsed);
  return parsed;
};

const nodeCache = new Map<CacheKey, SvgNode>();

export const ensureParsedNode = (
  source: string,
  markup: string,
  sanitize: boolean,
): SvgNode | null => {
  const entry = nodeCache.get(keyFor(source, sanitize));
  if (entry) return entry;
  const node = parseAndSanitize(markup, sanitize);
  if (node) nodeCache.set(keyFor(source, sanitize), node);
  return node;
};

export const __svgNodeCacheSize = (): number => nodeCache.size;
