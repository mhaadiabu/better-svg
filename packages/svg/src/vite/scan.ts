import type { Dirent } from "node:fs";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

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
  dynamic: string[];
};

export type ScanHooks = {
  onDirectory?: (directory: string) => void;
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
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "output",
]);

const namePattern = /\b([a-z][a-z0-9-]{1,30}):([a-z0-9][a-z0-9._-]{0,96})\b/g;
const templatePattern = /`(?:[^`\\]|\\[\s\S])*`/g;
const dynamicPattern = /[a-z][a-z0-9-]*:[a-z0-9._-]*\$\{/;

export const scanExtensions = new Set(defaultExtensions);

type Hint = { collection: string; file: string; line: number; snippet: string };

const lineNumberAt = (text: string, index: number) => {
  let line = 1;
  for (let at = -1; (at = text.indexOf("\n", at + 1)) >= 0 && at < index; line++);
  return line;
};

const collectNames = (text: string, file: string, hits: Map<string, Set<string>>) => {
  let references = 0;
  for (const match of text.matchAll(namePattern)) {
    const name = `${match[1]}:${match[2]}`;
    if (!name) continue;
    references += 1;
    let files = hits.get(name);
    if (!files) {
      files = new Set<string>();
      hits.set(name, files);
    }
    files.add(file);
  }
  return references;
};

const collectDynamic = (text: string, file: string, hints: Hint[]) => {
  for (const match of text.matchAll(templatePattern)) {
    const literal = match[0] ?? "";
    if (!literal || !dynamicPattern.test(literal)) continue;
    const collection = literal.match(/([a-z][a-z0-9-]*):/)?.[1];
    if (!collection) continue;
    hints.push({
      collection,
      file,
      line: lineNumberAt(text, match.index ?? 0),
      snippet: literal.slice(1, -1).replace(/\s+/g, " ").slice(0, 80),
    });
  }
};

type Entry =
  | { kind: "dir"; path: string }
  | { kind: "file"; path: string; name: string }
  | undefined;

const followEntry = async (directory: string, child: Dirent): Promise<Entry> => {
  const path = resolve(directory, child.name);
  if (child.isDirectory()) return { kind: "dir", path };
  if (child.isFile()) return { kind: "file", path, name: child.name };
  if (!child.isSymbolicLink()) return;
  let info;
  try {
    info = await stat(path);
  } catch (cause) {
    if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") return;
    throw cause;
  }
  if (info.isDirectory()) return { kind: "dir", path };
  if (info.isFile()) return { kind: "file", path, name: child.name };
  return undefined;
};

const readSourceFile = async (path: string, maxFileBytes: number) => {
  const id = await realpath(path);
  const info = await stat(id);
  if (info.size > maxFileBytes) return undefined;
  return { text: await readFile(id, "utf8"), id };
};

export const scanCatalogNames = async (
  root: string,
  options: ScanOptions = {},
  hooks: ScanHooks = {},
): Promise<ScanResult> => {
  const include = options.include ?? defaultInclude;
  const extensions = new Set(options.extensions ?? defaultExtensions);
  const maxFileBytes = options.maxFileBytes ?? defaultMaxFileBytes;
  const excludes = new Set((options.exclude ?? []).map((entry) => resolve(root, entry)));
  const hits = new Map<string, Set<string>>();
  const hints: Hint[] = [];
  const visitedFiles = new Set<string>();
  let references = 0;
  let files = 0;

  const isExcluded = (path: string) =>
    [...excludes].some((entry) => path === entry || path.startsWith(`${entry}${sep}`));

  const visit = async (directory: string, ancestors: Set<string>): Promise<void> => {
    let target: string | undefined;
    let entries;
    try {
      target = await realpath(directory);
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
    if (ancestors.has(target)) return;
    const nextAncestors = new Set(ancestors).add(target);
    hooks.onDirectory?.(target);
    const children = [...entries].sort((a, b) => a.name.localeCompare(b.name));
    await Promise.all(
      children.map(async (child) => {
        if (ignoredDirectories.has(child.name)) return;
        const entry = await followEntry(target, child);
        if (!entry) return;
        if (entry.kind === "dir") {
          if (isExcluded(entry.path)) return;
          await visit(entry.path, nextAncestors);
          return;
        }
        const dot = entry.name.lastIndexOf(".");
        const extension = dot < 0 ? "" : entry.name.slice(dot + 1).toLowerCase();
        if (!extensions.has(extension) || isExcluded(entry.path)) return;
        let source: Awaited<ReturnType<typeof readSourceFile>>;
        try {
          source = await readSourceFile(entry.path, maxFileBytes);
        } catch {
          return;
        }
        if (!source || visitedFiles.has(source.id)) return;
        visitedFiles.add(source.id);
        files += 1;
        const file = relative(root, source.id).split(sep).join("/");
        references += collectNames(source.text, file, hits);
        collectDynamic(source.text, file, hints);
      }),
    );
  };

  for (const dir of include) await visit(resolve(root, dir), new Set());

  const names = [...hits.keys()].sort();
  const filesBy = new Map<string, string[]>();
  for (const [name, store] of hits) filesBy.set(name, [...store].sort());
  const dynamic = hints.map((hint) => `${hint.file}:${hint.line} (\`${hint.snippet}\`)`).sort();
  return { names, references, files, filesBy, dynamic };
};

export default scanCatalogNames;
