import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import type { Plugin } from "vite";
import { buildPrecompiledSvg } from "./precompile.js";
import { runSvgoPass, type SvgoOption } from "./svgo.js";
import { scanCatalogNames, scanExtensions, type ScanResult, type ScanHint } from "./scan.js";
import {
  collectionIconNames,
  installedCollections,
  clearCatalogCache,
  collectionSourcePackages,
  installedCollectionRoot,
  resolveIconSource,
} from "../core/catalog.js";
import { writeCatalogNameTypes, type CatalogNameEntry } from "../core/names-codegen.js";
import type { PrecompiledLocalSvg } from "../core/local.js";

export type CatalogScanOptions = {
  include?: string[];
  exclude?: string[];
  searchPaths?: string[];
  strict?: boolean;
  maxFileBytes?: number;
  /** Generated name types. On by default (svg-catalog.d.ts at the root); a string relocates the file, false disables. */
  types?: boolean | string;
  collections?: readonly string[];
};

const pluginPrefix = "[@mhaadi/svg]";

const validatePathList = (kind: string, entries: readonly string[]) => {
  for (const entry of entries) {
    if (
      !entry ||
      entry.startsWith("/") ||
      entry.includes("\\") ||
      entry.split("/").includes("..") ||
      /[*?{}[\]]/.test(entry)
    ) {
      throw new Error(`${kind} must be paths relative to the project root without globs or '..'.`);
    }
  }
};

export const resolveCatalogOptions = (
  option: CatalogScanOptions | boolean | undefined,
): CatalogScanOptions | undefined => {
  // Catalog scanning is on by default: an omitted option scans with the
  // standard defaults and registers only what resolves, so unused
  // collections emit nothing and the output stays byte-identical.
  // `catalog: false` is the explicit opt-out.
  if (option === false) return undefined;
  const chosen =
    option === true || option === undefined
      ? {}
      : (() => {
          if (typeof option !== "object" || option === null || Array.isArray(option)) {
            throw new Error(
              "The catalog option must be true, false, or an object of scan options.",
            );
          }
          return option;
        })();
  validatePathList("Catalog scan directories", chosen.include ?? ["."]);
  validatePathList("Catalog excluded directories", chosen.exclude ?? []);
  for (const path of chosen.searchPaths ?? []) {
    if (!path) throw new Error("Catalog searchPaths entries must be non-empty paths.");
  }
  if (chosen.strict !== undefined && typeof chosen.strict !== "boolean") {
    throw new Error("The catalog option strict must be a boolean.");
  }
  if (
    chosen.maxFileBytes !== undefined &&
    (typeof chosen.maxFileBytes !== "number" ||
      !Number.isFinite(chosen.maxFileBytes) ||
      chosen.maxFileBytes <= 0)
  ) {
    throw new Error("The catalog option maxFileBytes must be a positive number of bytes.");
  }
  if (chosen.types !== undefined && chosen.types !== false && chosen.types !== true) {
    if (typeof chosen.types !== "string") {
      throw new Error("The catalog option types must be true or a relative .d.ts path.");
    }
    if (
      !chosen.types.endsWith(".d.ts") ||
      chosen.types.startsWith("/") ||
      chosen.types.includes("\\") ||
      chosen.types.split("/").includes("..") ||
      /[*?{}[\]]/.test(chosen.types)
    ) {
      throw new Error(
        "Catalog types path must be a relative path ending in .d.ts without globs or '..'.",
      );
    }
  }
  if (
    chosen.collections !== undefined &&
    (!Array.isArray(chosen.collections) ||
      chosen.collections.some(
        (collection) => typeof collection !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(collection),
      ))
  ) {
    throw new Error(
      "Catalog collections must be an array of collection prefixes, such as ['lucide'].",
    );
  }
  return chosen;
};

export type SvgPluginOptions = {
  dirs?: string[];
  svgo?: SvgoOption;
  precompiled?: boolean;
  /**
   * Catalog source scan. On by default; `false` disables it and an
   * object adjusts scope (`include`, `exclude`, `strict`,
   * `maxFileBytes`, `searchPaths`, `types`, `collections`).
   */
  catalog?: boolean | CatalogScanOptions;
};

export type LocalSvgOptions = SvgPluginOptions;

export type { SvgoOptions, SvgoOption } from "./svgo.js";

export type CatalogOutcome = {
  resolved: Map<string, string>;
  typos: { collection: string; names: string[] }[];
  uninstalled: { collection: string; sample: string }[];
  hints: ScanHint[];
  files: number;
  filesBy: Map<string, string[]>;
};

const collectionOf = (name: string) => name.slice(0, Math.max(0, name.indexOf(":")));

export const classifyScan = (
  result: ScanResult,
  searchPaths: readonly string[],
): CatalogOutcome => {
  const resolved = new Map<string, string>();
  const unresolved: string[] = [];
  for (const name of result.names) {
    const markup = resolveIconSource(name, { searchPaths });
    if (markup) resolved.set(name, markup);
    else unresolved.push(name);
  }
  const collections = [...new Set(unresolved.map(collectionOf))].sort();
  const typos: CatalogOutcome["typos"] = [];
  const uninstalled: CatalogOutcome["uninstalled"] = [];
  const installed = new Set<string>();
  for (const collection of collections) {
    if (installedCollectionRoot(collection, searchPaths)) installed.add(collection);
  }
  for (const collection of collections) {
    const names = unresolved.filter((name) => collectionOf(name) === collection);
    if (installed.has(collection)) typos.push({ collection, names });
    else {
      const sample = names.find((name) => result.explicitNames.has(name));
      if (sample) uninstalled.push({ collection, sample });
    }
  }
  const known = new Set([
    ...[...resolved.keys()].map(collectionOf),
    ...[...result.explicitNames].map(collectionOf),
    ...installed,
  ]);
  const hints = result.dynamic.filter((hint) => {
    return (
      hint.explicit ||
      known.has(hint.collection) ||
      installedCollectionRoot(hint.collection, searchPaths) !== undefined
    );
  });
  return {
    resolved,
    typos,
    uninstalled,
    hints,
    files: result.files,
    filesBy: result.filesBy,
  };
};

export const svgPlugin = (options: SvgPluginOptions = {}): Plugin => {
  const dirs = options.dirs ?? ["src/assets/svg", "app/assets/svg"];
  if (
    dirs.some(
      (dir) =>
        !dir ||
        dir.startsWith("/") ||
        dir.includes("\\") ||
        dir.split("/").includes("..") ||
        /[*?{}[\]]/.test(dir),
    )
  ) {
    throw new Error(
      "SVG directories must be paths relative to the project root without globs or '..'.",
    );
  }
  const catalogOptions = resolveCatalogOptions(options.catalog);
  const catalogStrict = catalogOptions?.strict === true;
  let root = "";
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

  const ensureOutcome = async (fresh: boolean, addDirectory?: (path: string) => void) => {
    if (fresh || scanState.dirty || !scanState.outcome) {
      scanState.outcome = classifyScan(await runScan(addDirectory), searchPaths());
    }
    return scanState.outcome;
  };

  const outcomeSignature = (outcome: CatalogOutcome) =>
    JSON.stringify({ resolved: [...outcome.resolved], typos: catalogStrict ? outcome.typos : [] });

  const emitCatalogReport = (outcome: CatalogOutcome, warn?: (message: string) => void) => {
    for (const entry of outcome.typos) {
      const details = entry.names
        .slice(0, 4)
        .map((name) => {
          const hits = outcome.filesBy.get(name) ?? [];
          const shown = hits.slice(0, 2).join(", ");
          return `${name}${shown ? ` (${shown}${hits.length > 2 ? ", and more" : ""})` : ""}`;
        })
        .join(", ");
      report(
        warn,
        `${pluginPrefix} catalog names did not resolve, but the collection is installed: ${details}. Fix the spelling; the name renders the fallback state until registered.`,
      );
    }
    for (const entry of outcome.uninstalled) {
      const packages = collectionSourcePackages(entry.collection);
      const primary = packages[0];
      const rest = packages.slice(1);
      const where = outcome.filesBy.get(entry.sample)?.[0] ?? "the project";
      report(
        warn,
        `${pluginPrefix} catalog collection "${entry.collection}" is referenced (e.g. ${entry.sample} in ${where}) but no icon source package is installed. Add ${primary}${rest.length ? ` (or ${rest.join(", ")})` : ""} and rerun.`,
      );
    }
    for (const hint of outcome.hints) {
      report(
        warn,
        `${pluginPrefix} dynamic catalog name at ${hint.file}:${hint.line} (\`${hint.snippet}\`). Scanning resolves literal names only; register these with registerCatalogIcons or keep the /assets/svg/{name}.svg fallback.`,
      );
    }
  };

  const syncCatalogTypes = () => {
    const option = catalogOptions?.types;
    if (!catalogOptions || option === false || !root) return;
    const label = typeof option === "string" ? option : "svg-catalog.d.ts";
    const collections =
      catalogOptions.collections ?? installedCollections({ searchPaths: searchPaths() });
    const entries: CatalogNameEntry[] = [];
    for (const collection of [...new Set(collections)].sort()) {
      const names = collectionIconNames(collection, { searchPaths: searchPaths() });
      if (names.length > 0) entries.push([collection, names]);
    }
    if (writeCatalogNameTypes(resolve(root, label), entries) === "written") {
      const totals = entries
        .map(([collection, names]) => `${collection}: ${names.length}`)
        .join(", ");
      announce(
        `${pluginPrefix} catalog name types written to ${label} (${totals || "no installed icons"})`,
      );
    }
  };

  const strictError = (outcome: CatalogOutcome) => {
    const names = outcome.typos.flatMap((entry) => entry.names);
    const files = [
      ...new Set(
        outcome.typos.flatMap((entry) =>
          entry.names.flatMap((name) => outcome.filesBy.get(name) ?? []),
        ),
      ),
    ]
      .slice(0, 3)
      .join(", ");
    return new Error(
      `No source found for these catalog icons: ${names.join(", ")} (catalog scan strict mode). The collections are installed; check the spelling in ${files || "the scanned sources"}.`,
    );
  };

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
      clearCatalogCache();
      syncCatalogTypes();
    },
    configureServer(server) {
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
            syncCatalogTypes();
            emitCatalogReport(outcome, warn);
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
    async transform(code, id) {
      const path = id.split("?")[0]?.replace(/\\/g, "/");
      if (
        !path ||
        !/(?:\/@mhaadi\/svg|\/packages\/svg)\/(?:dist|src)\/core\/local\.(?:js|ts)$/.test(path)
      )
        return;
      const entries = new Map<string, string>();
      const precompiled = options.precompiled ? new Map<string, PrecompiledLocalSvg>() : undefined;
      watchedDirectories.clear();
      watchedFiles.clear();
      const visit = async (directory: string, base: string, ancestors = new Set<string>()) => {
        let files;
        let target;
        try {
          target = await realpath(directory);
          if (ancestors.has(target)) return;
          files = await readdir(directory, { withFileTypes: true });
        } catch (cause) {
          if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") return;
          throw cause;
        }
        const nextAncestors = new Set(ancestors).add(target);
        watchedDirectories.add(target);
        this.addWatchFile(target);
        for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
          const path = resolve(directory, file.name);
          let info;
          try {
            info = file.isSymbolicLink() ? await stat(path) : file;
          } catch (cause) {
            if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") continue;
            throw cause;
          }
          if (info.isDirectory()) await visit(path, base, nextAncestors);
          else if (info.isFile() && file.name.endsWith(".svg")) {
            const name = relative(base, path).split(sep).join("/").slice(0, -4);
            this.addWatchFile(path);
            const target = await realpath(path);
            watchedFiles.add(target);
            this.addWatchFile(target);
            if (!entries.has(name)) {
              let markup = await readFile(path, "utf8");
              if (options.svgo) {
                try {
                  markup = await runSvgoPass(markup, name, options.svgo);
                } catch (cause) {
                  if (cause instanceof Error) {
                    throw new Error(`SVGO pass failed for "${name}": ${cause.message}`, {
                      cause,
                    });
                  }
                  throw cause;
                }
              }
              entries.set(name, markup);
              if (precompiled) precompiled.set(name, buildPrecompiledSvg(markup, name));
            }
          }
        }
      };
      for (const dir of dirs) {
        const base = resolve(root, dir);
        await visit(base, base);
      }
      const registration = precompiled
        ? JSON.stringify({ override: false, precompiled: Object.fromEntries(precompiled) })
        : "{ override: false }";
      let appended = `\nregisterLocalSvgs(${JSON.stringify(Object.fromEntries(entries))}, ${registration});\n`;

      if (catalogOptions) {
        const addDirectory = (directory: string) => this.addWatchFile(directory);
        const emit = (message: string) => this.warn(message);
        const outcome = await ensureOutcome(false, addDirectory);
        signatureState.value = outcomeSignature(outcome);
        emitCatalogReport(outcome, emit);
        syncCatalogTypes();
        if (catalogStrict && outcome.typos.length > 0) throw strictError(outcome);
        if (outcome.resolved.size > 0) {
          const catalogEntries = new Map<string, string>();
          const catalogPrecompiled = precompiled
            ? new Map<string, PrecompiledLocalSvg>()
            : undefined;
          for (const [name, markup] of outcome.resolved) {
            let source = markup;
            if (options.svgo) {
              try {
                source = await runSvgoPass(markup, name, options.svgo);
              } catch (cause) {
                if (cause instanceof Error) {
                  throw new Error(`SVGO pass failed for "${name}": ${cause.message}`, { cause });
                }
                throw cause;
              }
            }
            catalogEntries.set(name, source);
            if (catalogPrecompiled) catalogPrecompiled.set(name, buildPrecompiledSvg(source, name));
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
          const catalogRegistration = catalogPrecompiled
            ? JSON.stringify({
                override: false,
                precompiled: Object.fromEntries(catalogPrecompiled),
              })
            : "{ override: false }";
          appended += `\nregisterLocalSvgs(${JSON.stringify(Object.fromEntries(catalogEntries))}, ${catalogRegistration});\n`;
        }
      }

      return { code: code + appended, map: null };
    },
  };
};

export const localSvgs = svgPlugin;

export default svgPlugin;
