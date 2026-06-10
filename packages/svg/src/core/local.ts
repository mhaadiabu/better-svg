type SvgModuleMap = Record<string, string>;

type RegisterOptions = {
  override?: boolean;
};

const localSvgByName = new Map<string, string>();

const normalizeName = (value: string) =>
  value
    .trim()
    .replace(/^\/+/, "")
    .replace(/\.svg$/i, "");

const pathToName = (path: string) => normalizeName(path.replace(/^\/(src|app)\/assets\/svg\//, ""));

export const registerLocalSvgs = (entries: SvgModuleMap, options: RegisterOptions = {}) => {
  const override = options.override ?? true;
  for (const [path, url] of Object.entries(entries)) {
    const name = pathToName(path);
    if (!name) continue;
    if (!override && localSvgByName.has(name)) continue;
    localSvgByName.set(name, url);
  }
};

export const resolveSvgSource = (name: string) => {
  const normalized = normalizeName(name);
  const local = localSvgByName.get(normalized);
  if (local) return local;
  return `/assets/svg/${normalized}.svg`;
};

export type SvgName = string;
export type SvgNameInput = SvgName;
