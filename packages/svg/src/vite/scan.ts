import { lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { catalogLiterals, localSvgLiterals } from "./extract.js";

export type ScanOptions = {
  include?: string[];
  exclude?: string[];
  extensions?: string[];
  maxFileBytes?: number;
};

export type ScanResult = {
  names: string[];
  references: number;
  files: number;
  filesBy: Map<string, string[]>;
  explicitNames: Set<string>;
  dynamic: ScanHint[];
};

export type ScanHooks = {
  onDirectory?: (directory: string) => void;
  onFile?: (file: string) => void;
};

const defaultInclude = ["."];
const defaultExtensions = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "astro",
  "vue",
  "svelte",
  "html",
  "mdx",
];
const defaultMaxFileBytes = 524_288;

const ignoredDirectories = new Set([
  ".astro",
  ".cache",
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".svelte-kit",
  ".turbo",
  ".vite",
  "__snapshots__",
  "__tests__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "output",
]);

export const scanExtensions = new Set(defaultExtensions);

export type ScanHint = {
  collection: string;
  file: string;
  line: number;
  snippet: string;
  explicit: boolean;
};

const lineNumberAt = (text: string, index: number) => {
  let line = 1;
  for (let at = -1; (at = text.indexOf("\n", at + 1)) >= 0 && at < index; line++);
  return line;
};

type SourceEntry = { path: string; extension: string; symlink: boolean };

const readSourceFile = async (
  entry: SourceEntry,
  maxFileBytes: number,
  isExcluded: (path: string) => boolean,
) => {
  const localInfo = entry.symlink ? undefined : await lstat(entry.path);
  const id = entry.symlink || localInfo?.isSymbolicLink() ? await realpath(entry.path) : entry.path;
  if (isExcluded(id)) return undefined;
  const info = localInfo && !localInfo.isSymbolicLink() ? localInfo : await stat(id);
  if (info.size > maxFileBytes) return undefined;
  return { text: await readFile(id, "utf8"), id };
};

const scanSources = async (
  root: string,
  options: ScanOptions,
  hooks: ScanHooks,
  onSource: (source: string, extension: string, file: string) => void,
  onSkipped?: () => void,
) => {
  const include = options.include ?? defaultInclude;
  const extensions = new Set(options.extensions ?? defaultExtensions);
  const maxFileBytes = options.maxFileBytes ?? defaultMaxFileBytes;
  const excludes = [...new Set((options.exclude ?? []).map((entry) => resolve(root, entry)))].map(
    (path) => ({ path, prefix: path + sep }),
  );
  const visitedFiles = new Set<string>();

  const isExcluded = (path: string) =>
    excludes.some((entry) => path === entry.path || path.startsWith(entry.prefix));

  const files: SourceEntry[] = [];
  const addFile = (path: string, name: string, symlink: boolean) => {
    const dot = name.lastIndexOf(".");
    const extension = dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
    if (!extensions.has(extension) || isExcluded(path)) return;
    if (/\.(?:test|spec|stories)\.[^.]+$/.test(name) || name.endsWith(".d.ts")) return;
    files.push({ path, extension, symlink });
  };

  const visit = async (directory: string, ancestors: Set<string>): Promise<void> => {
    let target: string;
    let entries;
    try {
      target = await realpath(directory);
      if (ancestors.has(target) || isExcluded(target)) return;
      entries = await readdir(target, { withFileTypes: true });
    } catch (cause) {
      if (
        cause instanceof Error &&
        "code" in cause &&
        (cause.code === "ENOENT" || cause.code === "ENOTDIR")
      )
        return;
      throw cause;
    }
    const nextAncestors = new Set(ancestors).add(target);
    hooks.onDirectory?.(target);
    const visitDirectory = (path: string) =>
      isExcluded(path) ? undefined : visit(path, nextAncestors);
    const visitSymlink = async (path: string, name: string) => {
      let info;
      try {
        info = await stat(path);
      } catch (cause) {
        if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") return;
        throw cause;
      }
      if (info.isDirectory()) await visitDirectory(path);
      else if (info.isFile()) addFile(path, name, true);
    };

    const pending: Promise<void>[] = [];
    for (const child of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (ignoredDirectories.has(child.name)) continue;
      const path = resolve(target, child.name);
      if (child.isSymbolicLink()) pending.push(visitSymlink(path, child.name));
      else if (child.isDirectory()) {
        const visit = visitDirectory(path);
        if (visit) pending.push(visit);
      } else if (child.isFile()) addFile(path, child.name, false);
    }
    await Promise.all(pending);
  };

  const read = async (entry: SourceEntry) => {
    let source: Awaited<ReturnType<typeof readSourceFile>>;
    try {
      hooks.onFile?.(entry.path);
      source = await readSourceFile(entry, maxFileBytes, isExcluded);
    } catch {
      onSkipped?.();
      return;
    }
    if (!source) {
      onSkipped?.();
      return;
    }
    if (visitedFiles.has(source.id)) return;
    visitedFiles.add(source.id);
    if (source.id !== entry.path) hooks.onFile?.(source.id);
    const file = relative(root, source.id).split(sep).join("/");
    onSource(source.text, entry.extension, file);
  };

  const batchSize = 64;
  for (const dir of include) {
    await visit(resolve(root, dir), new Set());
    for (let index = 0; index < files.length; index += batchSize) {
      await Promise.all(files.slice(index, index + batchSize).map(read));
    }
    files.length = 0;
  }
};

export const scanCatalogNames = async (
  root: string,
  options: ScanOptions = {},
  hooks: ScanHooks = {},
): Promise<ScanResult> => {
  const hits = new Map<string, Set<string>>();
  const hints: ScanHint[] = [];
  const explicitNames = new Set<string>();
  let references = 0;
  let files = 0;

  await scanSources(root, options, hooks, (source, extension, file) => {
    files++;
    for (const literal of catalogLiterals(source, extension)) {
      const collection = literal.value.slice(0, literal.value.indexOf(":"));
      if (literal.value.includes("${")) {
        hints.push({
          collection,
          file,
          line: lineNumberAt(source, literal.index),
          snippet: literal.value.replace(/\s+/g, " ").slice(0, 80),
          explicit: literal.explicit,
        });
        continue;
      }
      references++;
      if (literal.explicit) explicitNames.add(literal.value);
      const matches = hits.get(literal.value) ?? new Set<string>();
      matches.add(file);
      hits.set(literal.value, matches);
    }
  });

  const names = [...hits.keys()].sort();
  const filesBy = new Map<string, string[]>();
  for (const [name, store] of hits) filesBy.set(name, [...store].sort());
  const dynamic = hints.sort(
    (left, right) => left.file.localeCompare(right.file) || left.line - right.line,
  );
  return { names, references, files, filesBy, explicitNames, dynamic };
};

export const scanLocalSvgNames = async (root: string, hooks: ScanHooks) => {
  const names = new Set<string>();
  let dynamic = false;
  const keepAll = () => {
    dynamic = true;
  };
  await scanSources(
    root,
    { extensions: [...defaultExtensions, "cjs", "mts", "cts"] },
    hooks,
    (source, extension) => {
      if (dynamic) return;
      for (const { value } of localSvgLiterals(source, extension, keepAll)) {
        names.add(
          value
            .trim()
            .replace(/^\/+/, "")
            .replace(/\.svg$/i, ""),
        );
      }
    },
    keepAll,
  );
  return dynamic ? undefined : names;
};

export default scanCatalogNames;
