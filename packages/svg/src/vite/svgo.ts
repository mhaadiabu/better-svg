type SvgoNode = {
  type: "root" | "element" | "text" | "comment" | "doctype" | "instruction" | "cdata";
  name?: string;
  value?: string;
  attributes?: Record<string, string>;
  children?: SvgoNode[];
};

type SvgoVisitor = {
  enter?: (node: SvgoNode, parent: SvgoNode) => void | symbol;
  exit?: (node: SvgoNode, parent: SvgoNode) => void;
};

type SvgoPluginFn = (
  root: SvgoNode,
  params: unknown,
  info: { path?: string; multipassCount: number },
) => SvgoVisitor | null | void;

type SvgoPluginConfig =
  | string
  | { name: string; params?: Record<string, unknown> }
  | { name: string; fn: SvgoPluginFn; params?: unknown };

type SvgoOptions = {
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

export type SvgoOption = boolean | SvgoOptions | ((name: string) => boolean | SvgoOptions);

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
  options: SvgoOption,
  load: SvgoLoader = loadSvgo,
) =>
  (async () => {
    const request = typeof options === "function" ? options(name) : options;
    if (!request) return markup;
    if (request !== true && request.preset !== undefined && request.plugins !== undefined) {
      throw new Error(
        'The "preset" option and the "plugins" list are incompatible; pass one or the other.',
      );
    }
    const {
      preset: _preset,
      plugins,
      filter,
      ...settings
    } = request === true ? ({} as SvgoOptions) : request;
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
    assertKnownPlugins(svgo, config.plugins);
    const result = svgo.optimize(markup, config);
    if (!result.data && markup.trim()) {
      throw new Error("svgo produced no markup, the SVG is likely malformed.");
    }
    return result.data;
  })();

export type { SvgoOptions };
