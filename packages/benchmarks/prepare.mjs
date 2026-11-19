import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile, copyFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parseXmlNode } from "../svg/dist/core/xml.js";
import { renderNode, parseInlineStyle } from "../svg/dist/core/ast.js";
import { cache, directory, profiles, root, sourceCommit } from "./config.mjs";

const require = createRequire(import.meta.url);
const packageVersion = (name, resolver = require) => {
  let entry;
  try {
    entry = resolver.resolve(name);
  } catch {
    entry = fileURLToPath(import.meta.resolve(name));
  }
  let folder = dirname(entry);
  while (dirname(folder) !== folder) {
    try {
      const data = JSON.parse(readFileSync(join(folder, "package.json"), "utf8"));
      if (data.name === name) return data.version;
    } catch {}
    folder = dirname(folder);
  }
  throw new Error(`Cannot find version of ${name}`);
};
const collection = JSON.parse(
  await readFile(require.resolve("@iconify-json/lucide/icons.json"), "utf8"),
);
const allIcons = Object.entries(collection.icons).sort(([left], [right]) =>
  left.localeCompare(right),
);
const entries = Array.from({ length: 100 }, (_unused, index) => {
  const [name, icon] = allIcons[Math.floor((index * allIcons.length) / 100)];
  const width = icon.width ?? collection.width ?? 24;
  const height = icon.height ?? collection.height ?? 24;
  return {
    name: `lucide-${name}`,
    group: "catalog",
    source: "@iconify-json/lucide@1.2.154",
    markup: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="currentColor">${icon.body}</svg>`,
  };
});
for (const file of ["apps/web/public/favicon.svg", "apps/web/public/assets/svg/logo.svg"]) {
  entries.push({
    name: `repository-${basename(file, ".svg")}`,
    group: "repository",
    source: file,
    markup: await readFile(join(root, file), "utf8"),
  });
}
if (process.argv.includes("--corpus"))
  throw new Error("Use --trusted-corpus only for SVG files you trust to run in the browser.");
const extraIndex = process.argv.indexOf("--trusted-corpus");
if (extraIndex !== -1) {
  const supplied = process.argv[extraIndex + 1];
  if (!supplied) throw new Error("--trusted-corpus requires a directory");
  const folder = resolve(supplied);
  for (const [index, file] of (await readdir(folder))
    .filter((file) => file.endsWith(".svg"))
    .sort()
    .entries()) {
    entries.push({
      name: `extra-${index}`,
      group: "local-export",
      source: basename(file),
      markup: await readFile(join(folder, file), "utf8"),
    });
  }
}
const capabilities = [];
for (const file of (await readdir(join(directory, "fixtures")))
  .filter((file) => file.endsWith(".svg"))
  .sort()) {
  capabilities.push({
    name: basename(file, ".svg"),
    group: "capability",
    source: `fixtures/${file}`,
    markup: await readFile(join(directory, "fixtures", file), "utf8"),
  });
}
await mkdir(cache, { recursive: true });
const metadata = {
  sourceCommit: sourceCommit(),
  fixtureHash: createHash("sha256")
    .update(JSON.stringify([...entries, ...capabilities]))
    .digest("hex"),
  entries: [...entries, ...capabilities].map(({ markup, ...entry }) => ({
    ...entry,
    sha256: createHash("sha256").update(markup).digest("hex"),
    bytes: Buffer.byteLength(markup),
  })),
  versions: Object.fromEntries(
    [
      "react",
      "react-dom",
      "react-svg",
      "react-inlinesvg",
      "vite-plugin-svgr",
      "unplugin-icons",
      "@svgr/core",
      "svgo",
      "vite",
    ].map((name) => [name, packageVersion(name)]),
  ),
  betterSvg: {
    published: JSON.parse(
      await readFile(
        new URL("../package.json", import.meta.resolve("@mhaadi/svg-released/react")),
        "utf8",
      ),
    ).version,
    workspace: JSON.parse(await readFile(join(root, "packages/svg/package.json"), "utf8")).version,
  },
  svgrSvgo: packageVersion("svgo", createRequire(require.resolve("@svgr/plugin-svgo"))),
};
const experiment = createHash("sha256").update(JSON.stringify(metadata));
for (const file of [
  "config.mjs",
  "client.jsx",
  "prepare.mjs",
  "measure.mjs",
  "vite.mjs",
  "collect.mjs",
  "serve.mjs",
])
  experiment.update(await readFile(join(directory, file)));
experiment.update(await readFile(join(root, "pnpm-lock.yaml")));
metadata.experimentHash = experiment.digest("hex");
await writeFile(join(cache, "manifest.json"), JSON.stringify(metadata, null, 2));
await writeFile(join(cache, "corpus.json"), JSON.stringify(entries));
for (const profile of profiles.flatMap((profile) => [
  profile,
  { ...profile, diagnostic: true },
  { ...profile, sparse: true },
])) {
  const activeEntries = profile.diagnostic ? capabilities : entries;
  const usedEntries = profile.sparse ? activeEntries.slice(0, 1) : activeEntries;
  const folder = join(
    cache,
    `${profile.diagnostic ? "contracts-" : profile.sparse ? "sparse-" : ""}${profile.id}`,
  );
  await rm(folder, { recursive: true, force: true });
  await mkdir(join(folder, "icons"), { recursive: true });
  await mkdir(join(folder, "public", "icons"), { recursive: true });
  for (const entry of activeEntries) {
    await writeFile(join(folder, "icons", `${entry.name}.svg`), entry.markup);
    if (["url", "injector", "inlinesvg"].includes(profile.kind))
      await writeFile(join(folder, "public", "icons", `${entry.name}.svg`), entry.markup);
  }
  let adapter;
  if (["svgr", "static", "unplugin"].includes(profile.kind)) {
    const imports = [];
    const query = profile.kind === "static" ? "better-svg" : "react";
    for (const [index, entry] of usedEntries.entries()) {
      const specifier =
        profile.kind === "unplugin"
          ? `~icons/benchmark/${entry.name}`
          : `./icons/${entry.name}.svg?${query}`;
      imports.push(`import Icon${index} from ${JSON.stringify(specifier)};`);
    }
    adapter = `${imports.join("\n")}\nconst icons = {${usedEntries.map((entry, index) => `${JSON.stringify(entry.name)}: Icon${index}`).join(",")}};\nexport const RenderIcon = ({ name, ...props }) => React.createElement(icons[name], props);`;
  } else if (profile.kind === "inline") {
    const icons = Object.fromEntries(
      usedEntries.map((entry) => {
        const node = parseXmlNode(entry.markup, false);
        if (!node) throw new Error(`Invalid fixture: ${entry.name}`);
        const attrs = Object.fromEntries(
          node.attrs.map(({ name, value }) => [
            name === "class"
              ? "className"
              : name === "style"
                ? "style"
                : name.startsWith("aria-") || name.startsWith("data-")
                  ? name
                  : name.replace(/[-:]([a-z])/g, (_match, letter) => letter.toUpperCase()),
            name === "style" ? parseInlineStyle(value) : value,
          ]),
        );
        return [entry.name, { attrs, body: node.children.map(renderNode).join("") }];
      }),
    );
    adapter = `const icons = ${JSON.stringify(icons)};\nexport const RenderIcon = ({name, ...props}) => React.createElement("svg", {...icons[name].attrs, ...props, dangerouslySetInnerHTML:{__html:icons[name].body}});`;
  } else if (profile.kind === "injector") {
    adapter =
      'import { ReactSVG } from "react-svg";\nexport const RenderIcon = ({name, ...props}) => React.createElement(ReactSVG, {...props, src:`/icons/${name}.svg?run=${globalThis.svgBenchmarkToken ?? "ssr"}`, onError: reportError});';
  } else if (profile.kind === "inlinesvg") {
    adapter =
      'import InlineSVG from "react-inlinesvg";\nexport const RenderIcon = ({name, ...props}) => React.createElement(InlineSVG, {...props, src:`/icons/${name}.svg?run=${globalThis.svgBenchmarkToken ?? "ssr"}`, onError: reportError});';
  } else {
    const pkg = profile.released ? "@mhaadi/svg-released" : "@mhaadi/svg";
    const render =
      profile.sparse && profile.kind === "better"
        ? `({ width, height, opacity }) => <SVG name=${JSON.stringify(usedEntries[0].name)} width={width} height={height} opacity={opacity} />`
        : `({name, ...props}) => React.createElement(SVG, {...props, ${profile.kind === "url" ? 'src:`/icons/${name}.svg?run=${globalThis.svgBenchmarkToken ?? "ssr"}`' : "name"}, onSvgError:reportError})`;
    adapter = `import { SVG } from "${pkg}/react";\nexport const RenderIcon = ${render};`;
  }
  const generated = `import * as React from "react";\nconst reportError = error => { if (typeof window !== "undefined") (window.svgBenchmarkErrors ??= []).push(String(error)); };\n${adapter}\nexport const names = ${JSON.stringify(usedEntries.map((entry) => entry.name))};\nexport const profile = ${JSON.stringify(profile.id)};\nexport const fixtureHash = ${JSON.stringify(metadata.fixtureHash)};\nexport const experimentHash = ${JSON.stringify(metadata.experimentHash)};\n`;
  await writeFile(join(folder, "adapter.jsx"), generated);
  if (profile.sparse) {
    await writeFile(
      join(folder, "client.jsx"),
      'import * as React from "react";\nimport { createRoot } from "react-dom/client";\nimport { RenderIcon, names } from "./adapter.jsx";\ncreateRoot(document.getElementById("stage")).render(React.createElement(RenderIcon, { name: names[0], width: 24, height: 24 }));',
    );
  } else {
    await copyFile(join(directory, "client.jsx"), join(folder, "client.jsx"));
  }
  await writeFile(
    join(folder, "index.html"),
    '<!doctype html><meta charset="utf-8"><title>SVG benchmark worker</title><style>#stage{display:flex;flex-wrap:wrap}#stage svg{width:24px;height:24px}.css-shape rect.target{fill:red}.css-shape path.target{fill:blue}.css-hierarchy g.pair>path{fill:red}.css-hierarchy g.pair>path+path{fill:blue}</style><div id="stage"></div><script type="module" src="/client.jsx"></script>',
  );
}
console.log(
  `Prepared ${entries.length} timing assets and ${capabilities.length} capability fixtures for ${profiles.length} profiles.`,
);
