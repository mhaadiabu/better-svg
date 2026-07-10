import { parseAndSanitize, type SvgNode } from "./ast";
import { parseInlineSvg, type ParsedInlineSvg } from "./sanitize";

type CacheKey = string;

const PARSED_CACHE_LIMIT = 500;
const NODE_CACHE_LIMIT = 200;

const cache = new Map<CacheKey, ParsedInlineSvg>();
const nodeCache = new Map<CacheKey, SvgNode>();

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
  return touch(cache, key) ?? null;
};

export const cacheParsedSvg = (
  source: string,
  sanitize: boolean,
  parsed: ParsedInlineSvg,
): void => {
  setBounded(cache, keyFor(source, sanitize), parsed, PARSED_CACHE_LIMIT);
};

export const clearSvgCache = (): void => {
  cache.clear();
  nodeCache.clear();
};

export const __svgCacheSize = (): number => cache.size;

export const ensureParsedSvg = (
  source: string,
  markup: string,
  sanitize: boolean,
  cache = true,
): ParsedInlineSvg | null => {
  if (cache) {
    const cached = getCachedParsedSvg(source, sanitize);
    if (cached) return cached;
  }
  const parsed = parseInlineSvg(markup, sanitize);
  if (parsed && cache) cacheParsedSvg(source, sanitize, parsed);
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
    if (entry) return entry;
    const node = parseAndSanitize(markup, sanitize);
    if (node) setBounded(nodeCache, key, node, NODE_CACHE_LIMIT);
    return node;
  }
  return parseAndSanitize(markup, sanitize);
};

export const __svgNodeCacheSize = (): number => nodeCache.size;
