import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import type { Plugin } from "vite";
import { buildPrecompiledSvg } from "./precompile";
import { runSvgoPass, type SvgoOption } from "./svgo";
import { scanCatalogNames, scanExtensions, type ScanResult } from "./scan";
import {
  collectionSourcePackages,
  installedCollectionRoot,
  resolveIconSource,
} from "../core/catalog";
import type { PrecompiledLocalSvg } from "../core/local";

export type CatalogScanOptions = {
  include?: string[];
  exclude?: string[];
  searchPaths?: string[];
  strict?: boolean;
  maxFileBytes?: number;
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
  return chosen;
};

export type LocalSvgOptions = {
  dirs?: string[];
  svgo?: SvgoOption;
  precompiled?: boolean;
  /**
   * Catalog source scan. On by default; `false` disables it and an
   * object adjusts scope (`include`, `exclude`, `strict`,
   * `maxFileBytes`, `searchPaths`, `types`).
   */
  catalog?: boolean | CatalogScanOptions;
};

export type { SvgoOptions, SvgoOption } from "./svgo";

export type CatalogOutcome = {
  resolved: Map<string, string>;
  typos: { collection: string; names: string[] }[];
  uninstalled: { collection: string; sample: string }[];
  hints: string[];
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
    else uninstalled.push({ collection, sample: names[0] ?? collection });
  }
  const known = new Set([
    ...resolved.keys().map(collectionOf),
    ...result.names.map(collectionOf),
    ...installed,
  ]);
  const hints = result.dynamic.filter((hint) => {
    const collection = hint.match(/`([a-z][a-z0-9-]*):/)?.[1];
    return collection !== undefined && known.has(collection);
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

export const localSvgs = (options: LocalSvgOptions = {}): Plugin => {
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
    [...outcome.resolved.keys(), ...outcome.typos.flatMap((entry) => entry.names)].join("\n");

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
        `${pluginPrefix} dynamic catalog name at ${hint}. Scanning resolves literal names only; register these with registerCatalogIcons or keep the /assets/svg/{name}.svg fallback.`,
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
    name: "@mhaadi/svg/local",
    enforce: "pre",
    config: () => ({
      ssr: { noExternal: ["@mhaadi/svg"] },
      optimizeDeps: { exclude: ["@mhaadi/svg"] },
    }),
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      const refresh = (file: string) => {
        if (!containsSvg(file)) return;
        server.moduleGraph.invalidateAll();
        server.ws.send({ type: "full-reload" });
      };
      let pending: ReturnType<typeof setTimeout> | undefined;
      const recatalog = (file: string) => {
        if (!catalogOptions) return;
        const path = file.replace(/\\/g, "/");
        const dot = path.lastIndexOf(".");
        const extension = dot < 0 ? "" : path.slice(dot + 1).toLowerCase();
        if (!scanExtensions.has(extension)) return;
        if (!path.startsWith(scannedSourceRoot())) return;
        scanState.dirty = true;
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => {
          pending = undefined;
          void (async () => {
            if (!root) return;
            const outcome = await ensureOutcome(true);
            const signature = outcomeSignature(outcome);
            if (signatureState.value !== undefined && signature === signatureState.value) return;
            signatureState.value = signature;
            server.moduleGraph.invalidateAll();
            server.ws.send({ type: "full-reload" });
          })().catch(() => {});
        }, 50);
      };
      const onEvent = (file: string) => {
        refresh(file);
        recatalog(file);
      };
      server.watcher.on("add", onEvent).on("change", onEvent).on("unlink", onEvent);
      server.httpServer?.once("close", () => {
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
        emitCatalogReport(outcome, emit);
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

export default localSvgs;
