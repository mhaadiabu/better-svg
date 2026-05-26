type SvgModuleMap = Record<string, string>;

type ImportMetaGlob = (
  patterns: string | string[],
  options: { eager: true; import: "default" },
) => Record<string, string>;

const glob = (import.meta as ImportMeta & { glob?: ImportMetaGlob }).glob;

const srcSvgs: SvgModuleMap = glob
  ? glob("/src/assets/svg/**/*.svg", { eager: true, import: "default" })
  : {};
const appSvgs: SvgModuleMap = glob
  ? glob("/app/assets/svg/**/*.svg", { eager: true, import: "default" })
  : {};

const normalizeName = (value: string) =>
  value.trim().replace(/^\/+/, "").replace(/\.svg$/i, "");

const pathToName = (path: string) =>
  normalizeName(path.replace(/^\/(src|app)\/assets\/svg\//, ""));

const localSvgByName: Record<string, string> = {};

const register = (modules: SvgModuleMap, override: boolean) => {
  for (const [path, url] of Object.entries(modules)) {
    const name = pathToName(path);
    if (!name) continue;
    if (!override && localSvgByName[name]) continue;
    localSvgByName[name] = url;
  }
};

register(appSvgs, false);
register(srcSvgs, true);

export type SvgName = keyof typeof localSvgByName;
export type SvgNameInput = SvgName | (string & {});

export const resolveSvgSource = (name: SvgNameInput) => {
  const normalized = normalizeName(name);
  const local = localSvgByName[normalized];
  if (local) return local;
  return `/assets/svg/${normalized}.svg`;
};
