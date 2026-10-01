import { parseAndSanitize, type SvgNode } from "./ast";
import { parseInlineSvg, type ParsedInlineSvg } from "./sanitize";

type CacheKey = string;

const PARSED_CACHE_LIMIT = 500;
const NODE_CACHE_LIMIT = 200;

const parsedCache = new Map<CacheKey, { parsed: ParsedInlineSvg; markup?: string }>();
const nodeCache = new Map<CacheKey, { node: SvgNode; markup: string }>();
const markupCache = new Map<string, string>();

const keyFor = (source: string, sanitize: boolean): CacheKey =>
  `${sanitize ? "s:" : "u:"}${source}`;

const touch = <V>(map: Map<string, V>, key: string): V | undefined => {
  const value = map.get(key);
  if (value === undefined) return undefined;
  map.delete(key);
  map.set(key, value);
  return value;
};

const setBounded = <V>(map: Map<string, V>, key: string, value: V, limit: number): void => {
  if (map.has(key)) {
    map.delete(key);
  } else if (map.size >= limit) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
};

export const getCachedParsedSvg = (source: string, sanitize: boolean): ParsedInlineSvg | null => {
  const key = keyFor(source, sanitize);
  return touch(parsedCache, key)?.parsed ?? null;
};

export const cacheParsedSvg = (
  source: string,
  sanitize: boolean,
  parsed: ParsedInlineSvg,
  markup?: string,
): void => {
  setBounded(parsedCache, keyFor(source, sanitize), { parsed, markup }, PARSED_CACHE_LIMIT);
};

export const getCachedMarkup = (source: string): string | undefined => touch(markupCache, source);

export const cacheMarkup = (source: string, markup: string): void => {
  setBounded(markupCache, source, markup, PARSED_CACHE_LIMIT);
};

export const clearSvgCache = (): void => {
  parsedCache.clear();
  nodeCache.clear();
  markupCache.clear();
};

export const __svgCacheSize = (): number => parsedCache.size;

export const ensureParsedSvg = (
  source: string,
  markup: string,
  sanitize: boolean,
  cache = true,
): ParsedInlineSvg | null => {
  if (cache) {
    const cached = touch(parsedCache, keyFor(source, sanitize));
    if (cached?.markup === markup) return cached.parsed;
  }
  const parsed = parseInlineSvg(markup, sanitize);
  if (parsed && cache) cacheParsedSvg(source, sanitize, parsed, markup);
  return parsed;
};

export const ensureParsedNode = (
  source: string,
  markup: string,
  sanitize: boolean,
  cache = true,
): SvgNode | null => {
  if (cache) {
    const key = keyFor(source, sanitize);
    const entry = touch(nodeCache, key);
    if (entry?.markup === markup) return entry.node;
    const node = parseAndSanitize(markup, sanitize);
    if (node) setBounded(nodeCache, key, { node, markup }, NODE_CACHE_LIMIT);
    return node;
  }
  return parseAndSanitize(markup, sanitize);
};

export const __svgNodeCacheSize = (): number => nodeCache.size;
