import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { resolveIconSource } from "./catalog";

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

export const bundleCatalogIcons = (options: BundleOptions): BundleResult => {
  const icons: IconBundle = {};
  const missing: string[] = [];
  for (const name of options.names) {
    const markup = resolveIconSource(name, options);
    if (!markup) {
      missing.push(name);
      continue;
    }
    icons[name] = markup;
  }
  if (missing.length > 0) {
    throw new Error(`No source found for these catalog icons: ${missing.join(", ")}`);
  }
  const format = options.format ?? (/\.(mjs|cjs|jsx|js)$/.test(options.out ?? "") ? "js" : "ts");
  const code = serializeIcons(icons, format);
  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, code);
  }
  return { icons, code, ...(options.out ? { file: options.out } : {}) };
};
