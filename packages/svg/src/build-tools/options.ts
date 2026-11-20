import type { SvgoOption } from "./svgo.js";

export type CatalogScanOptions = {
  include?: string[];
  exclude?: string[];
  searchPaths?: string[];
  strict?: boolean;
  maxFileBytes?: number;
  /** Generated name types. Defaults to src/svg-catalog.d.ts when src exists, or svg-catalog.d.ts at the root. Pass a relative path or false to override. */
  types?: boolean | string;
  collections?: readonly string[];
};

export const validatePathList = (kind: string, entries: readonly string[]) => {
  if (!Array.isArray(entries) || entries.some((entry) => typeof entry !== "string")) {
    throw new Error(`${kind} must be an array of relative paths.`);
  }
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
  if (
    chosen.searchPaths !== undefined &&
    (!Array.isArray(chosen.searchPaths) ||
      chosen.searchPaths.some((path) => typeof path !== "string" || !path))
  ) {
    throw new Error("Catalog searchPaths must be an array of non-empty paths.");
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
  pruneLocal?: boolean;
  svgo?: SvgoOption;
  precompiled?: boolean | "tree";
  /**
   * Catalog source scan. On by default; `false` disables it and an
   * object adjusts scope (`include`, `exclude`, `strict`,
   * `maxFileBytes`, `searchPaths`, `types`, `collections`).
   */
  catalog?: boolean | CatalogScanOptions;
};

export type LocalSvgOptions = SvgPluginOptions;

export type { SvgoOptions, SvgoOption } from "./svgo.js";
