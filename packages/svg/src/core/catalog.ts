import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { registerLocalSvgs } from "./local";

type IconifyIcon = {
  body?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  hidden?: boolean;
  parent?: string;
};

type IconifyCollection = {
  icons: Record<string, IconifyIcon>;
  aliases?: Record<string, IconifyIcon>;
  width?: number;
  height?: number;
};

type FileProbe = {
  package: string;
  file: (icon: string) => string;
};

export type CatalogOptions = {
  searchPaths?: readonly string[];
};

const collectionPattern = /^[a-z0-9][a-z0-9-]*$/;
const iconPattern = /^[a-z0-9][a-z0-9._-]*$/;

const iconifyProbes = (collection: string): readonly string[] => [
  join("@iconify-json", collection, "icons.json"),
  join("@iconify", "json", "json", `${collection}.json`),
];

const packageProbes: Record<string, readonly FileProbe[]> = {
  lucide: [{ package: "lucide-static", file: (icon) => `icons/${icon}.svg` }],
  tabler: [
    { package: "@tabler/icons", file: (icon) => `icons/outline/${icon}.svg` },
    { package: "@tabler/icons", file: (icon) => `icons/filled/${icon}.svg` },
  ],
  phosphor: [{ package: "@phosphor-icons/core", file: (icon) => `assets/regular/${icon}.svg` }],
};

const normalizeIcon = (value: string) => value.trim().replace(/\.svg$/i, "");

const parseIconName = (name: string) => {
  const separator = name.indexOf(":");
  if (separator <= 0 || separator === name.length - 1) return null;
  const collection = name.slice(0, separator).trim();
  const icon = normalizeIcon(name.slice(separator + 1));
  if (!collectionPattern.test(collection) || !iconPattern.test(icon)) return null;
  return [collection, icon] as const;
};

const nodeModuleRoots = (start: string) => {
  const roots: string[] = [];
  let directory = start;
  for (;;) {
    roots.push(join(directory, "node_modules"));
    const parent = dirname(directory);
    if (parent === directory) return roots;
    directory = parent;
  }
};

const searchRoots = (options: CatalogOptions) =>
  (options.searchPaths ?? [process.cwd()]).flatMap(nodeModuleRoots);

const collectionData = new Map<string, IconifyCollection | null>();
const fileMarkup = new Map<string, string>();

const readIconifyCollection = (file: string) => {
  if (collectionData.has(file)) return collectionData.get(file) ?? undefined;
  let markup;
  try {
    markup = readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
  let parsed: IconifyCollection | null;
  try {
    const raw = JSON.parse(markup) as IconifyCollection;
    parsed =
      raw &&
      typeof raw === "object" &&
      !Array.isArray(raw.icons) &&
      typeof raw.icons === "object" &&
      !Array.isArray(raw.aliases)
        ? raw
        : null;
  } catch {
    parsed = null;
  }
  collectionData.set(file, parsed);
  return parsed ?? undefined;
};

const readSvgFile = (file: string) => {
  const cached = fileMarkup.get(file);
  if (cached !== undefined) return cached || undefined;
  try {
    const markup = readFileSync(file, "utf8");
    fileMarkup.set(file, markup);
    return markup;
  } catch {
    fileMarkup.set(file, "");
    return undefined;
  }
};

const iconifyIcon = (collection: IconifyCollection, icon: string) => {
  const visited = new Set<string>([icon]);
  const chain: IconifyIcon[] = [];
  let data = collection.icons[icon] ?? collection.aliases?.[icon];
  while (data) {
    if (data.hidden) return undefined;
    chain.push(data);
    if (typeof data.body !== "string") {
      const parent = data.parent;
      if (!parent || visited.has(parent)) return undefined;
      visited.add(parent);
      data = collection.icons[parent] ?? collection.aliases?.[parent];
      continue;
    }
    const nearest = (key: "left" | "top" | "width" | "height") =>
      chain.map((entry) => entry[key]).find((value) => value !== undefined);
    return {
      body: data.body,
      left: nearest("left"),
      top: nearest("top"),
      width: nearest("width"),
      height: nearest("height"),
    };
  }
  return undefined;
};

const iconifyMarkup = (collection: IconifyCollection, icon: string) => {
  const data = iconifyIcon(collection, icon);
  if (!data) return undefined;
  const left = data.left ?? 0;
  const top = data.top ?? 0;
  const width = data.width ?? collection.width ?? 16;
  const height = data.height ?? collection.height ?? 16;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}">${data.body}</svg>`;
};

const findIconMarkup = (collection: string, icon: string, roots: readonly string[]) => {
  for (const root of roots) {
    for (const probe of iconifyProbes(collection)) {
      const data = readIconifyCollection(join(root, probe));
      if (data) {
        const markup = iconifyMarkup(data, icon);
        if (markup) return markup;
      }
    }
    for (const probe of packageProbes[collection] ?? []) {
      const markup = readSvgFile(join(root, probe.package, probe.file(icon)));
      if (markup) return markup;
    }
  }
  return undefined;
};

export const resolveIconSource = (name: string, options: CatalogOptions = {}) => {
  const parsed = parseIconName(name);
  if (!parsed) return undefined;
  const [collection, icon] = parsed;
  const roots = searchRoots(options);
  const cacheKey = `${collection}:${icon}\u0000${roots.join("\u0001")}`;
  if (fileMarkup.has(cacheKey)) return fileMarkup.get(cacheKey) || undefined;
  const markup = findIconMarkup(collection, icon, roots);
  fileMarkup.set(cacheKey, markup ?? "");
  return markup;
};

export const registerCatalogIcons = (names: readonly string[], options: CatalogOptions = {}) => {
  const registered: string[] = [];
  for (const name of names) {
    const markup = resolveIconSource(name, options);
    if (!markup) continue;
    registerLocalSvgs({ [name]: markup }, { override: false });
    registered.push(name);
  }
  return registered;
};
