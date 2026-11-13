import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { svgPlugin } from "@mhaadi/svg/vite/plugin";
import { transform } from "@svgr/core";
import { transformWithOxc } from "vite";
import { cache } from "./config.mjs";

export const viteConfig = (profile) => ({
  configFile: false,
  root: join(cache, profile.id),
  cacheDir: join(cache, profile.id, "vite-cache"),
  base: `/${profile.id}/`,
  logLevel: "silent",
  clearScreen: false,
  plugins:
    profile.kind === "better"
      ? [
          svgPlugin({
            dirs: ["icons"],
            catalog: false,
            svgo: profile.svgo,
            precompiled: profile.precompiled,
          }),
        ]
      : profile.kind === "svgr"
        ? [
            {
              name: "benchmark-svgr",
              enforce: "pre",
              async load(id) {
                if (id.endsWith(".svg?component")) return readFile(id.split("?")[0], "utf8");
              },
              async transform(source, id) {
                if (!id.endsWith(".svg?component")) return;
                const jsx = await transform(
                  source,
                  {
                    plugins: profile.svgo
                      ? ["@svgr/plugin-svgo", "@svgr/plugin-jsx"]
                      : ["@svgr/plugin-jsx"],
                    runtimeConfig: false,
                  },
                  { componentName: "Icon", filePath: id.split("?")[0] },
                );
                return transformWithOxc(jsx, `${id}.jsx`, { lang: "jsx" });
              },
            },
          ]
        : [],
  server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/dist/**"] } },
  build: { target: "es2022", sourcemap: false },
});
