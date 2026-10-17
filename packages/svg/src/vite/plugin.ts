import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import type { Plugin } from "vite";
import { runSvgoPass, type SvgoOptions } from "./svgo";

export type LocalSvgOptions = {
  dirs?: string[];
  svgo?: SvgoOptions | boolean;
};

export type { SvgoOptions };

export const localSvgs = (options: LocalSvgOptions = {}): Plugin => {
  const dirs = options.dirs ?? ["src/assets/svg", "app/assets/svg"];
  const svgoOptions =
    options.svgo === true
      ? {}
      : options.svgo === false || options.svgo === undefined
        ? null
        : options.svgo;
  if (
    dirs.some(
      (dir) =>
        !dir ||
        dir.startsWith("/") ||
        dir.includes("\\") ||
        dir.split("/").includes("..") ||
        /[*?{}[\]]/.test(dir),
    )
  ) {
    throw new Error(
      "SVG directories must be paths relative to the project root without globs or '..'.",
    );
  }
  let root = "";
  const watchedDirectories = new Set<string>();
  const watchedFiles = new Set<string>();
  const containsSvg = (file: string) =>
    watchedFiles.has(file) ||
    (file.endsWith(".svg") &&
      [...dirs.map((dir) => resolve(root, dir)), ...watchedDirectories].some((dir) =>
        file.startsWith(`${dir}${sep}`),
      ));

  return {
    name: "@mhaadi/svg/local",
    enforce: "pre",
    config: () => ({
      ssr: { noExternal: ["@mhaadi/svg"] },
      optimizeDeps: { exclude: ["@mhaadi/svg"] },
    }),
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      const refresh = (file: string) => {
        if (!containsSvg(file)) return;
        server.moduleGraph.invalidateAll();
        server.ws.send({ type: "full-reload" });
      };
      for (const dir of dirs) server.watcher.add(resolve(root, dir));
      server.watcher.on("add", refresh).on("change", refresh).on("unlink", refresh);
      server.httpServer?.once("close", () => {
        server.watcher.off("add", refresh).off("change", refresh).off("unlink", refresh);
      });
    },
    async transform(code, id) {
      const path = id.split("?")[0]?.replace(/\\/g, "/");
      if (
        !path ||
        !/(?:\/@mhaadi\/svg|\/packages\/svg)\/(?:dist|src)\/core\/local\.(?:js|ts)$/.test(path)
      )
        return;
      const entries = new Map<string, string>();
      watchedDirectories.clear();
      watchedFiles.clear();
      const visit = async (directory: string, base: string, ancestors = new Set<string>()) => {
        let files;
        let target;
        try {
          target = await realpath(directory);
          if (ancestors.has(target)) return;
          files = await readdir(directory, { withFileTypes: true });
        } catch (cause) {
          if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") return;
          throw cause;
        }
        const nextAncestors = new Set(ancestors).add(target);
        watchedDirectories.add(target);
        this.addWatchFile(target);
        for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
          const path = resolve(directory, file.name);
          let info;
          try {
            info = file.isSymbolicLink() ? await stat(path) : file;
          } catch (cause) {
            if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") continue;
            throw cause;
          }
          if (info.isDirectory()) await visit(path, base, nextAncestors);
          else if (info.isFile() && file.name.endsWith(".svg")) {
            const name = relative(base, path).split(sep).join("/").slice(0, -4);
            this.addWatchFile(path);
            const target = await realpath(path);
            watchedFiles.add(target);
            this.addWatchFile(target);
            if (!entries.has(name)) {
              let markup = await readFile(path, "utf8");
              if (svgoOptions) {
                try {
                  markup = await runSvgoPass(markup, name, svgoOptions);
                } catch (cause) {
                  if (cause instanceof Error) {
                    throw new Error(`SVGO pass failed for "${name}": ${cause.message}`, {
                      cause,
                    });
                  }
                  throw cause;
                }
              }
              entries.set(name, markup);
            }
          }
        }
      };
      for (const dir of dirs) {
        const base = resolve(root, dir);
        await visit(base, base);
      }
      return {
        code: `${code}\nregisterLocalSvgs(${JSON.stringify(Object.fromEntries(entries))}, { override: false });\n`,
        map: null,
      };
    },
  };
};

export default localSvgs;
