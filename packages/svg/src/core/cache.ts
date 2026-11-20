import { sanitizeNode, type SvgNode } from "./ast.js";
import { inlineSvgFromNode, parseInlineSvg, type ParsedInlineSvg } from "./sanitize.js";

type ParsedCacheEntry = {
  source: string;
  sanitize: boolean;
  parsed: ParsedInlineSvg;
  markup?: string;
  parser: typeof parseInlineSvg | null;
};
type NodeParser = (markup: string, sanitize: boolean) => SvgNode | null;

export const deferredLocalSvgPrefix = "better-svg:local:";

const PARSED_CACHE_LIMIT = 500;
const NODE_CACHE_LIMIT = 200;

const parsedCache = new Map<string, ParsedCacheEntry>();
let mostRecentParsed: ParsedCacheEntry | undefined;
const nodeCache = new Map<string, { node: SvgNode; markup: string; parser: NodeParser }>();
const markupCache = new Map<string, string>();
const localTrees = new Map<string, { node: SvgNode; sanitized?: SvgNode | null }>();

const keyFor = (source: string, sanitize: boolean) => `${sanitize ? "s:" : "u:"}${source}`;

const parsedKeyFor = (source: string, sanitize: boolean) =>
  sanitize && source.charCodeAt(0) !== 0 ? source : `\0${sanitize ? "s" : "u"}${source}`;

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

const getParsedEntry = (source: string, sanitize: boolean) => {
  if (mostRecentParsed?.source === source && mostRecentParsed.sanitize === sanitize)
    return mostRecentParsed;
  const entry = touch(parsedCache, parsedKeyFor(source, sanitize));
  if (entry) mostRecentParsed = entry;
  return entry;
};

export const getCachedParsedSvg = (source: string, sanitize: boolean): ParsedInlineSvg | null =>
  getParsedEntry(source, sanitize)?.parsed ?? null;

export const cacheParsedSvg = (
  source: string,
  sanitize: boolean,
  parsed: ParsedInlineSvg,
  markup?: string,
  parser: typeof parseInlineSvg | null = parseInlineSvg,
): void => {
  const entry = { source, sanitize, parsed, markup, parser };
  setBounded(parsedCache, parsedKeyFor(source, sanitize), entry, PARSED_CACHE_LIMIT);
  mostRecentParsed = entry;
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
  mostRecentParsed = undefined;
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
  if (source.startsWith(deferredLocalSvgPrefix)) source = markup;
  const cached = getParsedEntry(source, sanitize);
  if (cached?.markup === markup && (cached.parser === parse || cached.parser === null))
    return cached.parsed;
  const tree = getLocalSvgTree(source, markup, sanitize);
  const parsed = tree ? inlineSvgFromNode(tree) : parse(markup, sanitize);
  if (parsed) cacheParsedSvg(source, sanitize, parsed, markup, parse);
  return parsed;
};

export const ensureParsedNode = (
  source: string,
  markup: string,
  sanitize: boolean,
  cache: boolean,
  parse: NodeParser,
): SvgNode | null => {
  if (cache) {
    if (source.startsWith(deferredLocalSvgPrefix)) source = markup;
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
