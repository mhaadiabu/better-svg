import { sanitizeNode, type SvgNode } from "./ast.js";
import { inlineSvgFromNode, parseInlineSvg, type ParsedInlineSvg } from "./sanitize.js";

type ParsedCacheEntry = {
  parsed: ParsedInlineSvg;
  markup?: string;
  parser: typeof parseInlineSvg | null;
};
type NodeParser = (markup: string, sanitize: boolean) => SvgNode | null;

export const deferredLocalSvgPrefix = "better-svg:local:";

const PARSED_CACHE_LIMIT = 500;
const NODE_CACHE_LIMIT = 200;

type Variants<V> = { sanitized?: V; raw?: V };

class BoundedCache<V> {
  readonly #entries = new Map<string, V>();
  #newest: string | undefined;

  constructor(readonly limit: number) {}

  get size() {
    return this.#entries.size;
  }

  get(key: string): V | undefined {
    const value = this.#entries.get(key);
    if (value === undefined || key === this.#newest) return value;
    this.#entries.delete(key);
    this.#entries.set(key, value);
    this.#newest = key;
    return value;
  }

  peek(key: string): V | undefined {
    return this.#entries.get(key);
  }

  set(key: string, value: V): void {
    if (this.#entries.has(key)) {
      this.#entries.delete(key);
    } else if (this.#entries.size >= this.limit) {
      const oldest = this.#entries.keys().next().value;
      if (oldest !== undefined) this.#entries.delete(oldest);
    }
    this.#entries.set(key, value);
    this.#newest = key;
  }

  clear(): void {
    this.#entries.clear();
    this.#newest = undefined;
  }
}

const parsedCache = new BoundedCache<Variants<ParsedCacheEntry>>(PARSED_CACHE_LIMIT);
const nodeCache = new BoundedCache<Variants<{ node: SvgNode; markup: string; parser: NodeParser }>>(
  NODE_CACHE_LIMIT,
);
const markupCache = new BoundedCache<string>(PARSED_CACHE_LIMIT);
const localTrees = new BoundedCache<{ node: SvgNode; sanitized?: SvgNode | null }>(
  PARSED_CACHE_LIMIT,
);

const getVariant = <V>(cache: BoundedCache<Variants<V>>, source: string, sanitize: boolean) =>
  cache.get(source)?.[sanitize ? "sanitized" : "raw"];

const setVariant = <V>(
  cache: BoundedCache<Variants<V>>,
  source: string,
  sanitize: boolean,
  value: V,
) => {
  const variants = cache.peek(source) ?? {};
  variants[sanitize ? "sanitized" : "raw"] = value;
  cache.set(source, variants);
};

export const getCachedParsedSvg = (source: string, sanitize: boolean): ParsedInlineSvg | null =>
  getVariant(parsedCache, source, sanitize)?.parsed ?? null;

export const cacheParsedSvg = (
  source: string,
  sanitize: boolean,
  parsed: ParsedInlineSvg,
  markup?: string,
  parser: typeof parseInlineSvg | null = parseInlineSvg,
): void => {
  setVariant(parsedCache, source, sanitize, { parsed, markup, parser });
};

export const getCachedMarkup = (
  source: string,
  redirect: RequestRedirect = "follow",
): string | undefined => markupCache.get(JSON.stringify([source, redirect]));

export const cacheMarkup = (
  source: string,
  markup: string,
  redirect: RequestRedirect = "follow",
): void => {
  markupCache.set(JSON.stringify([source, redirect]), markup);
};

export const clearSvgCache = (): void => {
  parsedCache.clear();
  nodeCache.clear();
  markupCache.clear();
  localTrees.clear();
};

export const __svgCacheSize = (): number => parsedCache.size;

export const cacheLocalSvgTree = (markup: string, node: SvgNode) => {
  if (localTrees.get(markup)?.node === node) return;
  localTrees.set(markup, { node });
};

const getLocalSvgTree = (source: string, markup: string, sanitize: boolean) => {
  if (source !== markup) return;
  const tree = localTrees.get(markup);
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
  const cached = getVariant(parsedCache, source, sanitize);
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
    const entry = getVariant(nodeCache, source, sanitize);
    if (entry?.markup === markup && entry.parser === parse) return entry.node;
    const node = getLocalSvgTree(source, markup, sanitize) ?? parse(markup, sanitize);
    if (node) setVariant(nodeCache, source, sanitize, { node, markup, parser: parse });
    return node;
  }
  return parse(markup, sanitize);
};

export const __svgNodeCacheSize = (): number => nodeCache.size;
