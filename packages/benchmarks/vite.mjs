import { join } from "node:path";
import { svgPlugin } from "@mhaadi/svg/vite/plugin";
import { localSvgs } from "@mhaadi/svg-released/vite/plugin";
import icons from "unplugin-icons/vite";
import { FileSystemIconLoader } from "unplugin-icons/loaders";
import svgr from "vite-plugin-svgr";
import { cache } from "./config.mjs";

const pluginFor = (profile, root) => {
  if (profile.kind === "better" || profile.kind === "static") {
    const options = {
      dirs: ["icons"],
      svgo: profile.svgo,
      precompiled: profile.precompiled,
    };
    return profile.released
      ? localSvgs(options)
      : svgPlugin({ ...options, catalog: false, pruneLocal: profile.sparse === true });
  }
  if (profile.kind === "unplugin") {
    return icons({
      compiler: "jsx",
      jsx: "react",
      scale: 1,
      customCollections: { benchmark: FileSystemIconLoader(join(root, "icons")) },
    });
  }
  if (profile.kind === "svgr") {
    return svgr({
      svgrOptions: {
        runtimeConfig: false,
        plugins: profile.svgo ? ["@svgr/plugin-svgo", "@svgr/plugin-jsx"] : ["@svgr/plugin-jsx"],
      },
    });
  }
};

export const viteConfig = (profile) => {
  const root = join(cache, profile.id);
  return {
    configFile: false,
    root,
    cacheDir: join(root, "vite-cache"),
    base: `/${profile.id}/`,
    logLevel: "silent",
    clearScreen: false,
    resolve: { dedupe: ["react", "react-dom"] },
    plugins: [pluginFor(profile, root)],
    ssr: profile.released ? { noExternal: ["@mhaadi/svg-released"] } : undefined,
    optimizeDeps: profile.released ? { exclude: ["@mhaadi/svg-released"] } : undefined,
    server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/dist/**"] } },
    build: { target: "es2022", sourcemap: false },
  };
};
