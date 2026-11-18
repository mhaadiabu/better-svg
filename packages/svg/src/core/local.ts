import { sanitizeNode, domParserAvailable, renderNode, type SvgNode } from "./ast.js";
import { cacheLocalSvgTree, cacheParsedSvg } from "./cache.js";
import { unpackSvgNode, type PackedSvgNode } from "./packed-svg.js";
import { inlineSvgFromNode, parseInlineSvg } from "./sanitize.js";
import { isInlineSvg } from "./url.js";

type SvgModuleMap = Record<string, string>;

export type PrecompiledLocalSvg = { node: SvgNode };

type RegisterOptions = {
  override?: boolean;
  precompiled?: Record<string, PrecompiledLocalSvg>;
};

type LocalSvgTree = { packed: PackedSvgNode } | { markup: string; node: SvgNode };

const localSvgByName = new Map<string, string | LocalSvgTree>();
const deferredLocalSvgs = new Map<string, () => Promise<void>>();
const deferredSourcePrefix = "better-svg:local:";

const normalizeName = (value: string) =>
  value
    .trim()
    .replace(/^\/+/, "")
    .replace(/\.svg$/i, "");

const pathToName = (path: string) => normalizeName(path.replace(/^\/(src|app)\/assets\/svg\//, ""));

const isSvgAttr = (value: unknown): value is { name: string; value: string } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { name?: unknown }).name === "string" &&
  typeof (value as { value?: unknown }).value === "string";

const isSvgTree = (value: unknown): value is SvgNode => {
  if (typeof value !== "object" || value === null) return false;
  const node = value as Partial<SvgNode>;
  if (typeof node.tag !== "string") return false;
  if (node.text !== undefined && typeof node.text !== "string") return false;
  if (!Array.isArray(node.attrs) || !Array.isArray(node.children)) return false;
  if (!node.attrs.every(isSvgAttr)) return false;
  return node.children.every(isSvgTree);
};

const seedPrecompiled = (name: string, markup: string, tree: SvgNode) => {
  const node = sanitizeNode(tree);
  if (!node) throw new Error(`Precompiled SVG "${name}" is not a valid sanitized svg tree.`);
  const parsed = inlineSvgFromNode(node);
  if (domParserAvailable()) {
    cacheParsedSvg(markup, true, parsed, markup, parseInlineSvg);
    return;
  }
  void import("./xml.js")
    .then(({ parseXmlSvg }) => cacheParsedSvg(markup, true, parsed, markup, parseXmlSvg))
    .catch(() => {});
};

export const registerLocalSvgs = (entries: SvgModuleMap, options: RegisterOptions = {}) => {
  const override = options.override ?? true;
  const prepared = new Map<string, { markup: string; tree?: PrecompiledLocalSvg }>();
  for (const [path, markup] of Object.entries(entries)) {
    const name = pathToName(path);
    if (name) prepared.set(name, { markup });
  }
  for (const [key, tree] of Object.entries(options.precompiled ?? {})) {
    const name = pathToName(key);
    if (!name) throw new Error(`Precompiled SVG name "${key}" resolves to an empty name.`);
    const entry = prepared.get(name);
    if (!entry) {
      throw new Error(`Precompiled SVG "${name}" has no registered markup entry.`);
    }
    if (!isSvgTree(tree?.node) || tree.node.tag !== "svg") {
      throw new Error(`Precompiled SVG "${name}" is malformed: expected a parsed svg tree.`);
    }
    if (!isInlineSvg(entry.markup.trim())) {
      throw new Error(`Precompiled SVG "${name}" expects inline svg markup.`);
    }
    entry.tree = tree;
  }
  for (const [name, entry] of prepared) {
    if (!override && localSvgByName.has(name)) continue;
    const markup = entry.tree ? entry.markup.trim() : entry.markup;
    localSvgByName.set(name, markup);
    if (entry.tree) seedPrecompiled(name, markup, entry.tree.node);
  }
};

export const registerLocalSvgTrees = (entries: [name: string, node: PackedSvgNode][]) => {
  for (const [key, packed] of entries) {
    const name = pathToName(key);
    if (name && !localSvgByName.has(name)) localSvgByName.set(name, { packed });
  }
};

export const registerDeferredLocalSvgs = (names: string[], register: () => Promise<void>) => {
  let pending: Promise<void> | undefined;
  const load = () =>
    (pending ??= register().catch((error: unknown) => {
      pending = undefined;
      throw error;
    }));
  for (const key of names) {
    const name = pathToName(key);
    if (name) deferredLocalSvgs.set(name, load);
  }
};

export const loadDeferredLocalSvg = (source: string) => {
  if (!source.startsWith(deferredSourcePrefix)) return;
  const name = source.slice(deferredSourcePrefix.length);
  const load = deferredLocalSvgs.get(name);
  if (!load) return;
  return load().then(() => {
    const resolved = resolveNormalizedSvgSource(name);
    if (resolved === source) throw new Error(`Could not load local SVG "${name}".`);
    return resolved;
  });
};

const resolveNormalizedSvgSource = (normalized: string) => {
  let local = localSvgByName.get(normalized);
  if (typeof local === "string" && local) return local;
  if (typeof local === "object") {
    if ("packed" in local) {
      const node = unpackSvgNode(local.packed);
      local = { markup: renderNode(node), node };
      localSvgByName.set(normalized, local);
    }
    const { markup, node } = local;
    cacheLocalSvgTree(markup, node);
    return markup;
  }
  if (deferredLocalSvgs.has(normalized)) return deferredSourcePrefix + normalized;
  return `/assets/svg/${normalized}.svg`;
};

export const resolveSvgSource = (name: string) => resolveNormalizedSvgSource(normalizeName(name));

export type { SvgName, SvgNameInput } from "./names.js";
