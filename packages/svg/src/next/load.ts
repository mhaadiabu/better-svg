import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  catalogDependencyFiles,
  classifyScan,
  emitCatalogReport,
  strictError,
  syncCatalogTypes,
} from "../build-tools/catalog.js";
import {
  compileStaticSvg,
  defaultSvgDirs,
  emitRegistration,
  optimizeSvg,
  readLocalSvgs,
} from "../build-tools/local.js";
import { resolveCatalogOptions } from "../build-tools/options.js";
import { scanCatalogNames, scanLocalSvgNames } from "../build-tools/scan.js";
import type { SvgoOption } from "../build-tools/svgo.js";
import { clearCatalogCache } from "../core/catalog.js";
import type { NextSvgOptions } from "./index.js";

export type LoaderOptions = {
  settings: string;
  root: string;
  distDir: string;
  kind: "registry" | "deferred" | "static";
  dev: boolean;
};

export type LoaderContext = {
  resourcePath: string;
  getOptions(): LoaderOptions;
  addDependency(file: string): void;
  addContextDependency(directory: string): void;
  emitWarning(warning: Error): void;
  async(): (error: Error | null, result?: string) => void;
};

export const loadSvg = async (context: LoaderContext, source: string) => {
  const { root, kind, dev, settings, distDir } = context.getOptions();
  const options: NextSvgOptions = JSON.parse(settings);
  const { precompiled } = options;
  let svgo: SvgoOption | undefined = options.svgo;
  if (options.svgoConfig) {
    const file = resolve(root, options.svgoConfig);
    context.addDependency(file);
    const url = pathToFileURL(file);
    if (dev) url.searchParams.set("mtime", String((await stat(file)).mtimeMs));
    const config: { default: SvgoOption } = await import(url.href);
    svgo = config.default;
  }
  if (kind === "static") {
    const name = relative(root, context.resourcePath).split(sep).join("/").slice(0, -4);
    return compileStaticSvg(source, name, svgo, "@mhaadi/svg/react-static");
  }

  const dirs = options.dirs ?? defaultSvgDirs;
  const catalog = resolveCatalogOptions(options.catalog);
  const onFile = (file: string) => context.addDependency(file);
  const onDirectory = (directory: string) => context.addContextDependency(directory);
  const hooks = { onDirectory, onFile };
  for (const dir of [...dirs, ...(catalog?.include ?? [])]) {
    let directory = resolve(root, dir);
    if (existsSync(directory)) continue;
    do {
      directory = dirname(directory);
    } while (!existsSync(directory));
    onDirectory(directory);
  }
  const usedNames =
    !dev && options.pruneLocal !== false && dirs.some((dir) => existsSync(resolve(root, dir)))
      ? await scanLocalSvgNames(root, hooks, [distDir])
      : undefined;
  const { entries, deferred } = await readLocalSvgs(
    root,
    dirs,
    usedNames,
    svgo,
    onDirectory,
    onFile,
  );
  if (kind === "deferred") {
    const register = precompiled === "tree" ? "registerLocalSvgTrees" : "registerLocalSvgs";
    return `import { ${register} } from "./local.js";
export default function register() {
  ${emitRegistration(deferred, precompiled)}
}`;
  }

  let appended = emitRegistration(entries, precompiled);
  if (deferred.size) {
    appended += `\nregisterDeferredLocalSvgs(${JSON.stringify([...deferred.keys()])}, () => import("./next-deferred.js").then(({ default: register }) => register()));\n`;
  }
  if (catalog) {
    const searchPaths = catalog.searchPaths ?? [root];
    for (const file of catalogDependencyFiles(searchPaths)) onFile(file);
    clearCatalogCache();
    if (dev) syncCatalogTypes(root, catalog, console.log);
    const scan = await scanCatalogNames(
      root,
      { ...catalog, exclude: [...(catalog.exclude ?? []), distDir] },
      hooks,
    );
    const outcome = classifyScan(scan, searchPaths);
    emitCatalogReport(outcome, (message) => context.emitWarning(new Error(message)));
    if (catalog.strict && outcome.typos.length) throw strictError(outcome);
    const catalogEntries = new Map<string, string>();
    for (const [name, markup] of outcome.resolved) {
      if (deferred.has(name) || entries.has(name)) continue;
      catalogEntries.set(name, await optimizeSvg(markup, name, svgo));
    }
    if (catalogEntries.size) appended += emitRegistration(catalogEntries, precompiled);
  }

  return source + appended;
};
