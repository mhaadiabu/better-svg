import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants.js";
import { syncCatalogTypes } from "../build-tools/catalog.js";
import { defaultSvgDirs } from "../build-tools/local.js";
import {
  resolveCatalogOptions,
  validatePathList,
  type SvgPluginOptions,
} from "../build-tools/options.js";
import type { SvgoOptions } from "../build-tools/svgo.js";
import { clearCatalogCache } from "../core/catalog.js";
import type { LoaderOptions } from "./load.js";

type SerializableSvgoOptions = Omit<SvgoOptions, "filter" | "plugins"> & {
  plugins?: Array<string | { name: string; params?: Record<string, unknown> }>;
};

export type NextSvgOptions = Omit<SvgPluginOptions, "svgo"> & {
  root?: string;
  svgo?: boolean | SerializableSvgoOptions;
  svgoConfig?: string;
};

type ConfigFactory = (
  phase: string,
  context: { defaultConfig: NextConfig },
) => NextConfig | Promise<NextConfig>;

const staticQuery = /^\?better-svg$/;
const loaderPath = fileURLToPath(new URL("loader.mjs", import.meta.url));
const corePath = fileURLToPath(new URL("../core/", import.meta.url));
const registryFiles = { registry: "local.js", deferred: "next-deferred.js" } as const;
const registryKinds = ["registry", "deferred"] as const;

const regexEscape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const withSvg = (
  config: NextConfig | ConfigFactory = {},
  { root: projectRoot, ...options }: NextSvgOptions = {},
): ConfigFactory => {
  const catalog = resolveCatalogOptions(options.catalog);
  validatePathList("SVG directories", options.dirs ?? defaultSvgDirs);
  if (options.svgoConfig !== undefined) validatePathList("SVGO config", [options.svgoConfig]);
  if (options.svgoConfig !== undefined && options.svgo !== undefined) {
    throw new Error('Use either "svgo" or "svgoConfig" in withSvg().');
  }
  const settings = JSON.stringify(options, (_key, value: unknown) => {
    if (typeof value === "function") {
      throw new Error(
        "Next.js loader options must be serializable. Put SVGO functions in svgoConfig.",
      );
    }
    return value;
  });

  return async (phase, context) => {
    const nextConfig = typeof config === "function" ? await config(phase, context) : config;
    const dev = phase === PHASE_DEVELOPMENT_SERVER;
    if (!dev && phase !== PHASE_PRODUCTION_BUILD) return nextConfig;
    const root = resolve(projectRoot ?? process.cwd());
    clearCatalogCache();
    syncCatalogTypes(root, catalog, console.log);

    const distDir = nextConfig.distDir ?? ".next";
    const loader = (kind: LoaderOptions["kind"]) => ({
      loader: loaderPath,
      options: { settings, root, distDir, kind, dev } satisfies LoaderOptions,
    });

    const turboRoot = nextConfig.turbopack?.root ?? root;
    const localCorePath = relative(turboRoot, corePath).split(sep).join("/");
    // Turbopack can infer an ancestor workspace root when no root is configured.
    const coreDirectory = localCorePath.startsWith("../")
      ? /(?:^|\/)(?:@mhaadi\/svg|packages\/svg)\/dist\/core\//.source
      : `(?:^|/)${regexEscape(localCorePath)}/`;
    const rules = nextConfig.turbopack?.rules ?? {};
    const jsRules = rules["*.js"];
    const svgRules = rules["*.svg"];

    return {
      ...nextConfig,
      transpilePackages: [...new Set([...(nextConfig.transpilePackages ?? []), "@mhaadi/svg"])],
      turbopack: {
        ...nextConfig.turbopack,
        rules: {
          ...rules,
          "*.js": [
            ...(jsRules ? [jsRules].flat() : []),
            ...registryKinds.map((kind) => ({
              condition: {
                all: [
                  "browser" as const,
                  { path: new RegExp(`${coreDirectory}${regexEscape(registryFiles[kind])}$`) },
                ],
              },
              loaders: [loader(kind)],
            })),
          ],
          "*.svg": [
            ...(svgRules ? [svgRules].flat() : []),
            { condition: { query: staticQuery }, loaders: [loader("static")], type: "ecmascript" },
          ],
        },
      },
      webpack(config, context) {
        const result = nextConfig.webpack?.(config, context) ?? config;
        const rules = result.module.rules;
        const imageRule = rules.find(
          (rule: { loader?: string } | null) => rule?.loader === "next-image-loader",
        );
        if (imageRule) {
          const exclude = { not: [staticQuery] };
          imageRule.resourceQuery = imageRule.resourceQuery
            ? { and: [imageRule.resourceQuery, exclude] }
            : exclude;
        }
        rules.push({
          resource: /\.svg$/i,
          resourceQuery: staticQuery,
          type: "javascript/auto",
          use: [loader("static")],
        });
        if (!context.isServer) {
          for (const kind of registryKinds) {
            const file = resolve(corePath, registryFiles[kind]);
            rules.push({ resource: (path: string) => path === file, use: [loader(kind)] });
          }
        }
        return result;
      },
    };
  };
};

export default withSvg;
