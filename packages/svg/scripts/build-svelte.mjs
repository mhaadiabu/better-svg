import { compile } from "svelte/compiler";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcSvelte = resolve(root, "src/svelte/SVG.svelte");
const outSvelte = resolve(root, "dist/svelte/SVG.svelte");
const outJs = resolve(root, "dist/svelte/SVG.svelte.js");
const outCss = resolve(root, "dist/svelte/SVG.svelte.css");
const outTypes = resolve(root, "dist/svelte/SVG.svelte.d.ts");

await mkdir(dirname(outSvelte), { recursive: true });

const source = await readFile(srcSvelte, "utf8");
const compiled = compile(source, {
  filename: srcSvelte,
  generate: "client",
  runes: true,
  css: "injected",
});

await writeFile(outSvelte, source, "utf8");
await writeFile(outJs, compiled.js.code, "utf8");
if (compiled.css?.code) {
  await writeFile(outCss, compiled.css.code, "utf8");
}

await copyFile(resolve(root, "src/svelte/index.d.ts"), outTypes);
