type SvgoPluginConfig = string | { name: string; params?: Record<string, unknown> };

export type SvgoOptions = {
  preset?: "safe";
  plugins?: SvgoPluginConfig[];
  multipass?: boolean;
  floatPrecision?: number;
  js2svg?: {
    pretty?: boolean;
    indent?: number | string;
    finalNewline?: boolean;
  };
  filter?: (name: string) => boolean;
};

type SvgoModule = {
  optimize: (input: string, config?: Record<string, unknown>) => { data: string };
  builtinPlugins: ReadonlyArray<{ name: string }>;
};

type SvgoLoader = () => Promise<SvgoModule>;

const safeOverrides = {
  cleanupIds: false,
  removeDesc: false,
  minifyStyles: false,
  removeDeprecatedAttrs: false,
} as const;

const safePlugins = () => [{ name: "preset-default", params: { overrides: safeOverrides } }];

const loadSvgo: SvgoLoader = async () => import("svgo");

const isModuleNotFound = (cause: unknown) =>
  (cause as NodeJS.ErrnoException | null)?.code === "ERR_MODULE_NOT_FOUND" ||
  /Cannot find (?:module|package)|Failed to resolve|Could not resolve/i.test(
    cause instanceof Error ? cause.message : String(cause),
  );

const assertKnownPlugins = (svgo: SvgoModule, plugins: SvgoPluginConfig[]) => {
  const builtins = new Set(svgo.builtinPlugins.map((plugin) => plugin.name));
  for (const plugin of plugins) {
    if (typeof plugin === "string") {
      if (builtins.has(plugin)) continue;
      throw new Error(
        `Unknown SVGO plugin "${plugin}". Known built-in plugins: ${[...builtins].sort().join(", ")}.`,
      );
    }
    if ("fn" in plugin) {
      if (typeof plugin.fn !== "function") {
        throw new Error(`Custom SVGO plugin "${plugin.name}" must provide a fn.`);
      }
      continue;
    }
    if (builtins.has(plugin.name)) continue;
    throw new Error(
      `Unknown SVGO plugin "${plugin.name}". Known built-in plugins: ${[...builtins]
        .sort()
        .join(", ")}.`,
    );
  }
};

export const runSvgoPass = (
  markup: string,
  name: string,
  options: SvgoOptions,
  load: SvgoLoader = loadSvgo,
) =>
  (async () => {
    const { preset: _preset, plugins, filter, ...settings } = options;
    if (filter && !filter(name)) return markup;
    const svgo = await load().catch((cause: unknown) => {
      if (isModuleNotFound(cause)) {
        throw new Error(
          'The SVGO pass is enabled, but "svgo" is not installed. Add svgo to your development dependencies (for example `pnpm add -D svgo`) and rerun the build.',
          { cause },
        );
      }
      throw cause;
    });
    const config = { ...settings, path: name, plugins: plugins ?? safePlugins() };
    assertKnownPlugins(svgo, config.plugins ?? []);
    return svgo.optimize(markup, config).data;
  })();
