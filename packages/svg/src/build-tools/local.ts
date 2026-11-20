import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { buildPackedSvg, buildPrecompiledSvg } from "./precompile.js";
import { runSvgoPass } from "./svgo.js";
import type { SvgPluginOptions } from "./options.js";

export const defaultSvgDirs = ["src/assets/svg", "app/assets/svg"];

export const optimizeSvg = async (markup: string, name: string, svgo: SvgPluginOptions["svgo"]) => {
  if (!svgo) return markup;
  try {
    return await runSvgoPass(markup, name, svgo);
  } catch (cause) {
    if (cause instanceof Error)
      throw new Error(`SVGO pass failed for "${name}": ${cause.message}`, { cause });
    throw cause;
  }
};
export const emitRegistration = (
  entries: Map<string, string>,
  mode: SvgPluginOptions["precompiled"],
) => {
  if (mode === "tree") {
    const trees = Array.from(entries, ([name, markup]) => [name, buildPackedSvg(markup, name)]);
    return `\nregisterLocalSvgTrees(${JSON.stringify(trees)});\n`;
  }
  const registration = mode
    ? JSON.stringify({
        override: false,
        precompiled: Object.fromEntries(
          Array.from(entries, ([name, markup]) => [name, buildPrecompiledSvg(markup, name)]),
        ),
      })
    : "{ override: false }";
  return `\nregisterLocalSvgs(${JSON.stringify(Object.fromEntries(entries))}, ${registration});\n`;
};

export const compileStaticSvg = async (
  markup: string,
  name: string,
  svgo: SvgPluginOptions["svgo"],
  runtime: string,
) => {
  const { node } = buildPrecompiledSvg(await optimizeSvg(markup, name, svgo), name);
  return `import { createStaticSvg } from ${JSON.stringify(runtime)};
export default /* @__PURE__ */ createStaticSvg(${JSON.stringify(node)});`;
};

export const readLocalSvgs = async (
  root: string,
  dirs: string[],
  usedNames: Set<string> | undefined,
  svgo: SvgPluginOptions["svgo"],
  onDirectory: (path: string) => void,
  onFile: (path: string) => void,
) => {
  const entries = new Map<string, string>();
  const deferred = new Map<string, string>();
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
    onDirectory(target);
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
        onFile(path);
        const target = await realpath(path);
        if (target !== path) onFile(target);
        if (!entries.has(name) && !deferred.has(name)) {
          const destination =
            usedNames && !usedNames.has(name.trim().replace(/\.svg$/i, "")) ? deferred : entries;
          destination.set(name, await optimizeSvg(await readFile(path, "utf8"), name, svgo));
        }
      }
    }
  };
  for (const dir of dirs) {
    const base = resolve(root, dir);
    await visit(base, base);
  }
  return { entries, deferred };
};
