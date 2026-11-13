import { fork, execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { cpus, platform, release } from "node:os";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";
import { build, createServer } from "vite";
import { cache, directory, profiles, summarize } from "./config.mjs";
import { viteConfig } from "./vite.mjs";

const worker = process.argv.indexOf("--worker");
if (worker !== -1) {
  const profile = profiles.find((profile) => profile.id === process.argv[worker + 1]);
  if (!profile) throw new Error("Unknown worker profile");
  const config = viteConfig(profile);
  const start = performance.now();
  const server = await createServer(config);
  try {
    await server.listen();
    await server.transformRequest("/client.jsx");
    const startupEntryMs = performance.now() - start;
    const target =
      profile.kind === "better"
        ? resolve(directory, "../svg/dist/core/local.js")
        : profile.kind === "svgr"
          ? join(config.root, "icons", "lucide-a-arrow-down.svg")
          : null;
    let editTransformMs = null;
    if (target) {
      const request =
        profile.kind === "better" ? `/@fs${target}` : "/icons/lucide-a-arrow-down.svg?component";
      await server.transformRequest(request);
      const sourceFile = join(config.root, "icons", "lucide-a-arrow-down.svg");
      const original = await readFile(sourceFile, "utf8");
      const editing = performance.now();
      try {
        await writeFile(sourceFile, original.replace("<svg ", '<svg data-benchmark-edit="1" '));
        for (const module of server.moduleGraph.getModulesByFile(target) ?? [])
          server.moduleGraph.invalidateModule(module);
        if (profile.kind === "svgr")
          for (const module of server.moduleGraph.getModulesByFile(sourceFile) ?? [])
            server.moduleGraph.invalidateModule(module);
        await server.transformRequest(request);
        editTransformMs = performance.now() - editing;
      } finally {
        await writeFile(sourceFile, original);
      }
    }
    process.send({ status: "ready", startupEntryMs, editTransformMs });
  } catch (error) {
    process.send({
      status: "error",
      startupEntryMs: null,
      editTransformMs: null,
      error: error.message,
    });
  } finally {
    await server.close();
  }
} else {
  process.env.NODE_ENV = "production";
  const React = await import("react");
  const { renderToString } = await import("react-dom/server");
  const manifest = JSON.parse(await readFile(join(cache, "manifest.json"), "utf8"));
  const repetitions = Number(process.env.SVG_BENCH_REPETITIONS ?? 5);
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 100)
    throw new Error("SVG_BENCH_REPETITIONS must be between 1 and 100");
  const runWorker = (profile) =>
    new Promise((resolve, reject) => {
      let result;
      const child = fork(join(directory, "measure.mjs"), ["--worker", profile.id], {
        stdio: ["ignore", "inherit", "inherit", "ipc"],
        env: { ...process.env, NODE_ENV: "development" },
      });
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`Worker ${profile.id} exceeded 60 seconds`));
      }, 60_000);
      child.once("exit", () => clearTimeout(timeout));
      child.on("message", (value) => {
        result = value;
      });
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0 && result
          ? resolve(result)
          : reject(new Error(`Worker ${profile.id} exited ${code}`)),
      );
    });
  const bytes = (buffer) => ({
    raw: buffer.length,
    gzip: gzipSync(buffer, { level: 9 }).length,
    brotli: brotliCompressSync(buffer, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length,
  });
  const files = async (folder) =>
    (
      await Promise.all(
        (
          await readdir(folder, { withFileTypes: true })
        ).map(async (entry) =>
          entry.isDirectory()
            ? files(join(folder, entry.name))
            : [{ name: entry.name, data: await readFile(join(folder, entry.name)) }],
        ),
      )
    ).flat();
  const results = new Map(
    profiles.map((profile) => [profile.id, { profile: profile.id, buildMs: [], dev: [] }]),
  );
  for (let repetition = 0; repetition < repetitions; repetition++) {
    const order = profiles
      .slice(repetition % profiles.length)
      .concat(profiles.slice(0, repetition % profiles.length));
    for (const profile of order) {
      const result = results.get(profile.id);
      const start = performance.now();
      await build(viteConfig(profile));
      result.buildMs.push(performance.now() - start);
      result.dev.push(await runWorker(profile));
      console.log(`${repetition + 1}/${repetitions} ${profile.id}`);
    }
  }
  for (const profile of profiles) {
    const result = results.get(profile.id);
    const assets = await files(join(cache, profile.id, "dist"));
    result.assets = assets.map(({ name, data }) => ({ name, ...bytes(data) }));
    result.totalBytes = result.assets.reduce(
      (total, asset) => ({
        raw: total.raw + asset.raw,
        gzip: total.gzip + asset.gzip,
        brotli: total.brotli + asset.brotli,
      }),
      { raw: 0, gzip: 0, brotli: 0 },
    );
    result.buildMs = summarize(result.buildMs);
    result.startupEntryMs = summarize(
      result.dev.map((sample) => sample.startupEntryMs).filter((value) => value !== null),
    );
    result.editTransformMs = summarize(
      result.dev.map((sample) => sample.editTransformMs).filter((value) => value !== null),
    );
    await build({
      ...viteConfig(profile),
      build: { ssr: join(cache, profile.id, "adapter.jsx"), outDir: "server", minify: false },
    });
    const serverFiles = await readdir(join(cache, profile.id, "server"));
    const entry = serverFiles.find((file) => /adapter\.(m?js)$/.test(file));
    if (!entry) throw new Error(`Missing SSR entry for ${profile.id}`);
    const { RenderIcon, names } = await import(
      pathToFileURL(join(cache, profile.id, "server", entry)).href
    );
    const nodes = Array.from({ length: 100 }, (_unused, index) =>
      React.createElement(RenderIcon, {
        key: index,
        name: names[index % names.length],
        width: 24,
        height: 24,
      }),
    );
    const render = () => renderToString(React.createElement(React.Fragment, null, ...nodes));
    const html = render();
    const rendered = (html.match(/<svg(?:\s|>)/g) ?? []).length;
    const samples = [];
    if (rendered === 100) {
      for (let index = 0; index < 5; index++) render();
      for (let index = 0; index < 30; index++) {
        const start = performance.now();
        render();
        samples.push(performance.now() - start);
      }
    }
    result.ssr = {
      expected: 100,
      rendered,
      eligible: rendered === 100,
      htmlBytes: bytes(Buffer.from(html)),
      milliseconds: summarize(samples),
    };
    await build(viteConfig({ ...profile, id: `contracts-${profile.id}` }));
  }
  const data = {
    manifest,
    environment: {
      node: process.version,
      platform: platform(),
      release: release(),
      cpu: cpus()[0].model,
      logicalCpus: cpus().length,
      sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    },
    repetitions,
    profiles: [...results.values()],
  };
  await writeFile(join(cache, "node.json"), JSON.stringify(data, null, 2));
  console.log(`Saved ${join(cache, "node.json")}`);
}
