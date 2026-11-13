import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { generateCatalogNameTypes } from "../dist/core/names-codegen.js";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const directory = mkdtempSync(join(tmpdir(), "svg-consumer-types-"));

try {
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  const [packed] = JSON.parse(
    execFileSync("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], {
      cwd: packageRoot,
      encoding: "utf8",
    }),
  );
  const destination = join(directory, "node_modules", "@mhaadi", "svg");
  for (const { path } of packed.files) {
    const target = join(destination, path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(packageRoot, path), target);
  }
  const dependencies = new Set([
    ...Object.keys(manifest.dependencies),
    ...Object.keys(manifest.devDependencies),
    ...Object.keys(manifest.peerDependencies),
  ]);
  for (const name of dependencies) {
    const source = join(packageRoot, "node_modules", name);
    if (!existsSync(source)) continue;
    const target = join(directory, "node_modules", name);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(realpathSync(source), target, "junction");
  }
  writeFileSync(join(directory, "package.json"), '{"type":"module"}');

  const adapters = [
    [
      "root",
      'import { SVG as RootSVG } from "@mhaadi/svg";',
      'Parameters<typeof RootSVG>[0]["name"]',
    ],
    [
      "react",
      'import { SVG as ReactSVG } from "@mhaadi/svg/react";',
      'Parameters<typeof ReactSVG>[0]["name"]',
    ],
    [
      "native",
      'import { SVG as NativeSVG } from "@mhaadi/svg/react-native";',
      'Parameters<typeof NativeSVG>[0]["name"]',
    ],
    [
      "vue",
      'import { SVG as VueSVG } from "@mhaadi/svg/vue";',
      'InstanceType<typeof VueSVG>["$props"]["name"]',
    ],
    [
      "solid",
      'import { SVG as SolidSVG } from "@mhaadi/svg/solid";',
      'Parameters<typeof SolidSVG>[0]["name"]',
    ],
    [
      "svelte",
      'import SvelteSVG from "@mhaadi/svg/svelte"; import type { ComponentProps } from "svelte";',
      'ComponentProps<typeof SvelteSVG>["name"]',
    ],
    [
      "astro",
      'import AstroSVG from "@mhaadi/svg/astro";',
      'Parameters<typeof AstroSVG>[0]["name"]',
    ],
    [
      "angular",
      'import { SVG as AngularSVG } from "@mhaadi/svg/angular";',
      'ReturnType<AngularSVG["name"]>',
    ],
  ];
  const consumer = [
    ...adapters.map(([, statement]) => statement),
    "type Expect<Suggestion extends true> = Suggestion;",
    'type HasSuggestion<Name> = [Extract<Name, "testy:house">] extends [never] ? false : true;',
    ...adapters.flatMap(([name, , type]) => [
      `type ${name}Suggestion = Expect<HasSuggestion<${type}>>;`,
      `export const ${name}Name: ${type} = "testy:";`,
    ]),
    'export const element = <ReactSVG name="testy:" />;',
    "export const dynamic = <ReactSVG name={`future:${Date.now()}`} />;",
  ].join("\n");
  const consumerFile = join(directory, "consumer.tsx");
  const typesFile = join(directory, "svg-catalog.d.ts");
  writeFileSync(consumerFile, consumer);
  writeFileSync(typesFile, generateCatalogNameTypes([["testy", ["house", "zap"]]]));

  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    types: [],
  };
  let version = 0;
  const service = ts.createLanguageService({
    getCompilationSettings: () => options,
    getScriptFileNames: () => [consumerFile, typesFile],
    getScriptVersion: () => String(version),
    getScriptSnapshot: (file) => {
      const content = ts.sys.readFile(file);
      return content === undefined ? undefined : ts.ScriptSnapshot.fromString(content);
    },
    getCurrentDirectory: () => directory,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath,
  });
  try {
    const program = service.getProgram();
    assert.ok(program, "The consumer program must load the packed declarations.");
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(
      diagnostics.length,
      0,
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => directory,
        getNewLine: () => "\n",
      }),
    );

    const markers = [...adapters.map(([name]) => `${name}Name:`), "<ReactSVG name="];
    const completionNames = (marker) => {
      const start = consumer.indexOf(marker);
      const position = consumer.indexOf('"testy:', start) + '"testy:'.length;
      assert.ok(start >= 0 && position > start, `Missing completion marker ${marker}`);
      return new Set(
        service
          .getCompletionsAtPosition(consumerFile, position, {})
          ?.entries.map((entry) => entry.name),
      );
    };
    for (const marker of markers) {
      const names = completionNames(marker);
      assert.ok(
        names.has("testy:house") && names.has("testy:zap"),
        `No generated suggestions at ${marker}`,
      );
    }

    writeFileSync(typesFile, generateCatalogNameTypes([]));
    version++;
    for (const marker of markers)
      assert.ok(
        !completionNames(marker).has("testy:house"),
        `Stale suggestions remain at ${marker}`,
      );
    console.log(
      `Verified packed name types for ${adapters.length} adapters and React JSX completion, including the empty-declaration guard.`,
    );
  } finally {
    service.dispose();
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
