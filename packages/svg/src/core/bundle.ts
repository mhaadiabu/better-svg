import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { expandCatalogNames, resolveIconSource } from "./catalog";

export type IconBundle = Record<string, string>;

export type BundleOptions = {
  names: readonly string[];
  searchPaths?: readonly string[];
  format?: "ts" | "js";
  out?: string;
};

export type BundleResult = {
  icons: IconBundle;
  code: string;
  file?: string;
};

const serializeIcons = (icons: IconBundle, format: "ts" | "js") => {
  const entries = Object.entries(icons).map(
    ([name, markup]) => `  ${JSON.stringify(name)}: ${JSON.stringify(markup)},`,
  );
  const annotation = format === "ts" ? ": Record<string, string>" : "";
  return `export const bundledIcons${annotation} = {\n${entries.join("\n")}\n};\n`;
};

const bundleName = (name: string) => name.trim().replace(/\.svg$/i, "");

const bundleFormat = (out: string) => {
  if (/\.(js|mjs)$/.test(out)) return "js" as const;
  if (/\.(ts|mts)$/.test(out)) return "ts" as const;
  return undefined;
};

export const bundleCatalogIcons = (options: BundleOptions): BundleResult => {
  const names = expandCatalogNames(options.names, options);
  const icons: IconBundle = {};
  const missing: string[] = [];
  for (const name of names) {
    const markup = resolveIconSource(name, options);
    if (!markup) {
      missing.push(name);
      continue;
    }
    icons[bundleName(name)] = markup;
  }
  if (missing.length > 0) {
    throw new Error(`No source found for these catalog icons: ${missing.join(", ")}`);
  }
  if (
    options.names.some((name) => name.includes("*")) &&
    (Object.keys(icons).length > 250 ||
      Object.values(icons).reduce((total, markup) => total + markup.length, 0) > 262_144)
  ) {
    console.warn(
      `[@mhaadi/svg] bundled ${Object.keys(icons).length} wildcard catalog icons into the data module; pin explicit names or prefixes to trim it.`,
    );
  }
  const format = options.format ?? (options.out ? bundleFormat(options.out) : "ts");
  if (!format) {
    throw new Error(
      `Unsupported bundle output extension: ${options.out}. Use .ts, .mts, .js, or .mjs, or set format.`,
    );
  }
  const code = serializeIcons(icons, format);
  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, code);
  }
  return { icons, code, ...(options.out ? { file: options.out } : {}) };
};
