import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, ViteDevServer } from "vite";
import { clearCatalogCache } from "../core/catalog.js";
import {
  classifyScan,
  collectionOf,
  emitCatalogReport,
  strictError,
  syncCatalogTypes,
  type CatalogOutcome,
} from "../build-tools/catalog.js";
import {
  compileStaticSvg,
  defaultSvgDirs,
  emitRegistration,
  optimizeSvg,
  readLocalSvgs,
} from "../build-tools/local.js";
import {
  resolveCatalogOptions,
  validatePathList,
  type SvgPluginOptions,
} from "../build-tools/options.js";
import { scanCatalogNames, scanExtensions, scanLocalSvgNames } from "../build-tools/scan.js";

export type {
  CatalogScanOptions,
  LocalSvgOptions,
  SvgPluginOptions,
  SvgoOption,
  SvgoOptions,
} from "../build-tools/options.js";
export { classifyScan, type CatalogOutcome } from "../build-tools/catalog.js";
export { resolveCatalogOptions } from "../build-tools/options.js";

const pluginPrefix = "[@mhaadi/svg]";
const deferredRegistryPrefix = "\0better-svg:deferred-local:";

export const svgPlugin = (options: SvgPluginOptions = {}): Plugin => {
  const dirs = options.dirs ?? defaultSvgDirs;
  validatePathList("SVG directories", dirs);
  const catalogOptions = resolveCatalogOptions(options.catalog);
  const catalogStrict = catalogOptions?.strict === true;
  let root = "";
  let pruneLocal = false;
  let devServer: ViteDevServer | undefined;
  const deferredRegistries = new Map<string, string>();
  const deferredRegistryByPath = new Map<string, string>();
  const scanState: { dirty: boolean; outcome?: CatalogOutcome } = { dirty: true };
  const signatureState: { value?: string } = { value: undefined };
  const reported = new Set<string>();
  const searchPaths = () => catalogOptions?.searchPaths ?? [root];

  const report = (emit: ((message: string) => void) | undefined, message: string) => {
    if (reported.has(message)) return;
    reported.add(message);
    if (emit) emit(message);
    else console.warn(message);
  };

  const announce = (message: string) => {
    if (reported.has(message)) return;
    reported.add(message);
    console.log(message);
  };

  const runScan = async (addDirectory?: (path: string) => void) => {
    scanState.dirty = false;
    return scanCatalogNames(
      root,
      catalogOptions,
      addDirectory ? { onDirectory: addDirectory } : undefined,
    );
  };

  let scanQueue = Promise.resolve();
  const ensureOutcome = (fresh: boolean, addDirectory?: (path: string) => void) => {
    const result = scanQueue.then(async () => {
      if (fresh || scanState.dirty || !scanState.outcome) {
        scanState.outcome = classifyScan(await runScan(addDirectory), searchPaths());
      }
      return scanState.outcome;
    });
    scanQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const outcomeSignature = (outcome: CatalogOutcome) =>
    JSON.stringify({ resolved: [...outcome.resolved], typos: catalogStrict ? outcome.typos : [] });

  const watchedDirectories = new Set<string>();
  const watchedFiles = new Set<string>();
  const containsSvg = (file: string) =>
    watchedFiles.has(file) ||
    (file.endsWith(".svg") &&
      [...dirs.map((dir) => resolve(root, dir)), ...watchedDirectories].some((dir) =>
        file.startsWith(`${dir}${sep}`),
      ));

  const scannedSourceRoot = () => `${root.replace(/\\/g, "/")}/`;

  return {
    name: "@mhaadi/svg",
    enforce: "pre",
    config: () => ({
      ssr: { noExternal: ["@mhaadi/svg"] },
      optimizeDeps: { exclude: ["@mhaadi/svg"] },
    }),
    configResolved(config) {
      root = config.root;
      pruneLocal = config.command === "build" && options.pruneLocal !== false;
      clearCatalogCache();
      syncCatalogTypes(root, catalogOptions, announce);
    },
    configureServer(server) {
      devServer = server;
      const refresh = (file: string) => {
        if (!containsSvg(file)) return;
        server.moduleGraph.invalidateAll();
        server.ws.send({ type: "full-reload" });
      };
      let pending: ReturnType<typeof setTimeout> | undefined;
      let closed = false;
      const warn = (message: string) => server.config.logger.warn(message);
      const dependencyFiles = new Set<string>();
      for (const searchPath of searchPaths()) {
        let directory = resolve(searchPath);
        for (;;) {
          for (const name of [
            "package.json",
            "pnpm-lock.yaml",
            "package-lock.json",
            "yarn.lock",
            "bun.lock",
            "bun.lockb",
          ]) {
            const file = resolve(directory, name);
            if (existsSync(file)) dependencyFiles.add(file);
          }
          const parent = dirname(directory);
          if (parent === directory) break;
          directory = parent;
        }
      }
      if (catalogOptions) server.watcher.add([...dependencyFiles]);
      const recatalog = (file: string) => {
        if (!catalogOptions) return;
        const dependencyChanged = dependencyFiles.has(resolve(file));
        const path = file.replace(/\\/g, "/");
        const dot = path.lastIndexOf(".");
        const extension = dot < 0 ? "" : path.slice(dot + 1).toLowerCase();
        if (
          !dependencyChanged &&
          (!scanExtensions.has(extension) || !path.startsWith(scannedSourceRoot()))
        )
          return;
        const localPath = relative(root, file).split(sep).join("/");
        const included = catalogOptions.include ?? ["."];
        const inDirectory = (directory: string) => {
          const path = relative(root, resolve(root, directory)).split(sep).join("/");
          return !path || localPath === path || localPath.startsWith(`${path}/`);
        };
        if (
          !dependencyChanged &&
          (!included.some(inDirectory) || catalogOptions.exclude?.some(inDirectory))
        )
          return;
        if (
          !dependencyChanged &&
          (localPath.split("/").includes("node_modules") || file.endsWith(".d.ts"))
        )
          return;
        if (dependencyChanged) clearCatalogCache();
        scanState.dirty = true;
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => {
          pending = undefined;
          void (async () => {
            if (!root || closed) return;
            const outcome = await ensureOutcome(true);
            if (closed) return;
            syncCatalogTypes(root, catalogOptions, announce);
            emitCatalogReport(outcome, (message) => report(warn, message));
            if (catalogStrict && outcome.typos.length > 0) {
              server.ws.send({
                type: "error",
                err: { message: strictError(outcome).message, stack: "", plugin: "@mhaadi/svg" },
              });
            }
            const signature = outcomeSignature(outcome);
            if (signatureState.value !== undefined && signature === signatureState.value) return;
            signatureState.value = signature;
            server.moduleGraph.invalidateAll();
            server.ws.send({ type: "full-reload" });
          })().catch((cause: unknown) => {
            if (!closed)
              warn(
                `${pluginPrefix} catalog scan failed: ${cause instanceof Error ? cause.message : String(cause)}`,
              );
          });
        }, 50);
      };
      const onEvent = (file: string) => {
        refresh(file);
        recatalog(file);
      };
      for (const dir of dirs) server.watcher.add(resolve(root, dir));
      server.watcher.on("add", onEvent).on("change", onEvent).on("unlink", onEvent);
      server.httpServer?.once("close", () => {
        closed = true;
        if (pending) clearTimeout(pending);
        server.watcher.off("add", onEvent).off("change", onEvent).off("unlink", onEvent);
      });
    },
    resolveId(id) {
      if (deferredRegistries.has(id)) return id;
    },
    async load(id) {
      const registry = deferredRegistries.get(id);
      if (registry !== undefined) return registry;
      if (!id.endsWith(".svg?better-svg")) return;
      const path = id.slice(0, -"?better-svg".length);
      this.addWatchFile(path);
      if (devServer) {
        const { isFileServingAllowed, normalizePath } = await import("vite");
        if (typeof isFileServingAllowed !== "function") {
          this.error("Static SVG imports in development require Vite filesystem authorization.");
        }
        if (
          !isFileServingAllowed(normalizePath(path), devServer) ||
          !isFileServingAllowed(normalizePath(await realpath(path)), devServer)
        ) {
          this.error("Static SVG import is outside Vite's allowed filesystem paths.");
        }
      }
      const name = relative(root, path).split(sep).join("/").slice(0, -4);
      const runtime = fileURLToPath(new URL("../react-static.js", import.meta.url)).replace(
        /\\/g,
        "/",
      );
      return compileStaticSvg(await readFile(path, "utf8"), name, options.svgo, runtime);
    },
    async transform(code, id, transformOptions) {
      const path = id.split("?")[0]?.replace(/\\/g, "/");
      if (
        !path ||
        path.startsWith("\0") ||
        !/(?:\/@mhaadi\/svg|\/packages\/svg)\/(?:dist|src)\/core\/local\.(?:js|ts)$/.test(path)
      )
        return;
      const usedNames =
        pruneLocal &&
        !transformOptions?.ssr &&
        this.environment?.config.consumer !== "server" &&
        dirs.some((dir) => existsSync(resolve(root, dir)))
          ? await scanLocalSvgNames(root, {
              onDirectory: (directory) => this.addWatchFile(directory),
              onFile: (file) => this.addWatchFile(file),
            })
          : undefined;
      const watch = (file: string) => {
        if (devServer) devServer.watcher.add(file);
        else this.addWatchFile(file);
      };
      watchedDirectories.clear();
      watchedFiles.clear();
      const { entries, deferred } = await readLocalSvgs(
        root,
        dirs,
        usedNames,
        options.svgo,
        (path) => {
          watchedDirectories.add(path);
          watch(path);
        },
        (path) => {
          watchedFiles.add(path);
          watch(path);
        },
      );
      let appended = emitRegistration(entries, options.precompiled);
      if (deferred.size > 0) {
        const register =
          options.precompiled === "tree" ? "registerLocalSvgTrees" : "registerLocalSvgs";
        const source = `import { ${register} } from ${JSON.stringify(path)};
export default function register() {
  ${emitRegistration(deferred, options.precompiled)}
}`;
        const moduleId = deferredRegistryPrefix + createHash("sha256").update(source).digest("hex");
        const previous = deferredRegistryByPath.get(path);
        if (previous) deferredRegistries.delete(previous);
        deferredRegistryByPath.set(path, moduleId);
        deferredRegistries.set(moduleId, source);
        appended += `\nregisterDeferredLocalSvgs(${JSON.stringify([...deferred.keys()])}, () => import(${JSON.stringify(moduleId)}).then(({ default: register }) => register()));\n`;
      }

      if (catalogOptions) {
        const emit = (message: string) => this.warn(message);
        const outcome = await ensureOutcome(false, watch);
        signatureState.value = outcomeSignature(outcome);
        emitCatalogReport(outcome, (message) => report(emit, message));
        syncCatalogTypes(root, catalogOptions, announce);
        if (catalogStrict && outcome.typos.length > 0) throw strictError(outcome);
        if (outcome.resolved.size > 0) {
          const catalogEntries = new Map<string, string>();
          for (const [name, markup] of outcome.resolved) {
            if (deferred.has(name)) continue;
            catalogEntries.set(name, await optimizeSvg(markup, name, options.svgo));
          }
          const tallies = new Map<string, number>();
          for (const name of catalogEntries.keys()) {
            const collection = collectionOf(name);
            tallies.set(collection, (tallies.get(collection) ?? 0) + 1);
          }
          const totals = [...tallies.entries()]
            .sort()
            .map(([collection, count]) => `${collection}: ${count}`)
            .join(", ");
          announce(
            `${pluginPrefix} auto-registered ${catalogEntries.size} catalog icon${catalogEntries.size === 1 ? "" : "s"} from ${outcome.files} source file${outcome.files === 1 ? "" : "s"} (${totals})`,
          );
          appended += emitRegistration(catalogEntries, options.precompiled);
        }
      }

      return { code: code + appended, map: null };
    },
  };
};

export const localSvgs = svgPlugin;

export default svgPlugin;
