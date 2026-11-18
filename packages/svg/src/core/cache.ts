import { parseAndSanitize, sanitizeNode, type SvgNode } from "./ast.js";
import { inlineSvgFromNode, parseInlineSvg, type ParsedInlineSvg } from "./sanitize.js";

type CacheKey = string;

const PARSED_CACHE_LIMIT = 500;
const NODE_CACHE_LIMIT = 200;

const parsedCache = new Map<
  CacheKey,
  { parsed: ParsedInlineSvg; markup?: string; parser?: typeof parseInlineSvg }
>();
const nodeCache = new Map<
  CacheKey,
  { node: SvgNode; markup: string; parser: typeof parseAndSanitize }
>();
const markupCache = new Map<string, string>();
const localTrees = new Map<string, { node: SvgNode; sanitized?: SvgNode | null }>();

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
  parser = parseInlineSvg,
): void => {
  setBounded(parsedCache, keyFor(source, sanitize), { parsed, markup, parser }, PARSED_CACHE_LIMIT);
};

export const getCachedMarkup = (
  source: string,
  redirect: RequestRedirect = "follow",
): string | undefined => touch(markupCache, JSON.stringify([source, redirect]));

export const cacheMarkup = (
  source: string,
  markup: string,
  redirect: RequestRedirect = "follow",
): void => {
  setBounded(markupCache, JSON.stringify([source, redirect]), markup, PARSED_CACHE_LIMIT);
};

export const clearSvgCache = (): void => {
  parsedCache.clear();
  nodeCache.clear();
  markupCache.clear();
  localTrees.clear();
};

export const __svgCacheSize = (): number => parsedCache.size;

export const cacheLocalSvgTree = (markup: string, node: SvgNode) => {
  if (touch(localTrees, markup)?.node === node) return;
  setBounded(localTrees, markup, { node }, PARSED_CACHE_LIMIT);
};

const getLocalSvgTree = (source: string, markup: string, sanitize: boolean) => {
  if (source !== markup) return;
  const tree = touch(localTrees, markup);
  if (!tree) return;
  if (!sanitize) return tree.node;
  if (tree.sanitized === undefined) tree.sanitized = sanitizeNode(tree.node);
  return tree.sanitized;
};

export const ensureParsedSvg = (
  source: string,
  markup: string,
  sanitize: boolean,
  cache = true,
  parse = parseInlineSvg,
): ParsedInlineSvg | null => {
  if (!cache) return parse(markup, sanitize);
  const cached = touch(parsedCache, keyFor(source, sanitize));
  if (cached?.markup === markup && cached.parser === parse) return cached.parsed;
  const tree = getLocalSvgTree(source, markup, sanitize);
  const parsed = tree ? inlineSvgFromNode(tree) : parse(markup, sanitize);
  if (parsed) cacheParsedSvg(source, sanitize, parsed, markup, parse);
  return parsed;
};

export const ensureParsedNode = (
  source: string,
  markup: string,
  sanitize: boolean,
  cache = true,
  parse = parseAndSanitize,
): SvgNode | null => {
  if (cache) {
    const key = keyFor(source, sanitize);
    const entry = touch(nodeCache, key);
    if (entry?.markup === markup && entry.parser === parse) return entry.node;
    const node = getLocalSvgTree(source, markup, sanitize) ?? parse(markup, sanitize);
    if (node) setBounded(nodeCache, key, { node, markup, parser: parse }, NODE_CACHE_LIMIT);
    return node;
  }
  return parse(markup, sanitize);
};

export const __svgNodeCacheSize = (): number => nodeCache.size;
