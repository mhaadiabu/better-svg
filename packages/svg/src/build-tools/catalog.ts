import { resolve } from "node:path";
import {
  collectionIconNames,
  installedCollections,
  collectionSourcePackages,
  installedCollectionRoot,
  resolveIconSource,
} from "../core/catalog.js";
import { writeCatalogNameTypes, type CatalogNameEntry } from "../core/names-codegen.js";
import type { ScanResult, ScanHint } from "./scan.js";
import type { CatalogScanOptions } from "./options.js";

const pluginPrefix = "[@mhaadi/svg]";

export type CatalogOutcome = {
  resolved: Map<string, string>;
  typos: { collection: string; names: string[] }[];
  uninstalled: { collection: string; sample: string }[];
  hints: ScanHint[];
  files: number;
  filesBy: Map<string, string[]>;
};

export const collectionOf = (name: string) => name.slice(0, Math.max(0, name.indexOf(":")));

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

export const emitCatalogReport = (outcome: CatalogOutcome, warn: (message: string) => void) => {
  for (const entry of outcome.typos) {
    const details = entry.names
      .slice(0, 4)
      .map((name) => {
        const hits = outcome.filesBy.get(name) ?? [];
        const shown = hits.slice(0, 2).join(", ");
        return `${name}${shown ? ` (${shown}${hits.length > 2 ? ", and more" : ""})` : ""}`;
      })
      .join(", ");
    warn(
      `${pluginPrefix} catalog names did not resolve, but the collection is installed: ${details}. Fix the spelling; the name renders the fallback state until registered.`,
    );
  }
  for (const entry of outcome.uninstalled) {
    const packages = collectionSourcePackages(entry.collection);
    const primary = packages[0];
    const rest = packages.slice(1);
    const where = outcome.filesBy.get(entry.sample)?.[0] ?? "the project";
    warn(
      `${pluginPrefix} catalog collection "${entry.collection}" is referenced (e.g. ${entry.sample} in ${where}) but no icon source package is installed. Add ${primary}${rest.length ? ` (or ${rest.join(", ")})` : ""} and rerun.`,
    );
  }
  for (const hint of outcome.hints) {
    warn(
      `${pluginPrefix} dynamic catalog name at ${hint.file}:${hint.line} (\`${hint.snippet}\`). Scanning resolves literal names only; use registerCatalogIcons in Node build code, or generate a client map with bundleCatalogIcons and registerLocalSvgs. Otherwise the /assets/svg/{name}.svg fallback is used.`,
    );
  }
};

export const syncCatalogTypes = (
  root: string,
  catalogOptions: CatalogScanOptions | undefined,
  announce: (message: string) => void,
) => {
  const searchPaths = catalogOptions?.searchPaths ?? [root];
  const option = catalogOptions?.types;
  if (!catalogOptions || option === false || !root) return;
  const label = typeof option === "string" ? option : "svg-catalog.d.ts";
  const collections = catalogOptions.collections ?? installedCollections({ searchPaths });
  const entries: CatalogNameEntry[] = [];
  for (const collection of [...new Set(collections)].sort()) {
    const names = collectionIconNames(collection, { searchPaths });
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

export const strictError = (outcome: CatalogOutcome) => {
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
