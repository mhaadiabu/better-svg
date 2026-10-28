import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { bundleCatalogIcons } from "./bundle";
import { resolveSvgSource, registerLocalSvgs } from "./local";
import { resolveSource } from "./resolve";
import { isInlineSvg } from "./url";

const makeFixture = () => {
  const root = mkdtempSync(join(tmpdir(), "svg-bundle-"));
  const nodeModules = join(root, "node_modules");
  const write = (file: string, content: string) => {
    mkdirSync(join(nodeModules, file, ".."), { recursive: true });
    writeFileSync(join(nodeModules, file), content);
  };
  return { root, write, cleanup: () => rmSync(root, { recursive: true, force: true }) };
};

const fixtureIcons = () => {
  const fixture = makeFixture();
  fixture.write(
    join("@iconify-json", "dim", "icons.json"),
    JSON.stringify({
      prefix: "dim",
      width: 24,
      height: 24,
      icons: {
        star: { body: "<path d='m1'/>" },
        wide: { body: "<path d='m2'/>", left: 4, top: 2, width: 48, height: 12 },
      },
      aliases: { star2: { parent: "star" } },
    }),
  );
  return fixture;
};

describe("offline icon bundles", () => {
  it("throws when a requested name has no installed source", () => {
    const fixture = fixtureIcons();
    expect(() =>
      bundleCatalogIcons({ names: ["dim:star", "dim:missing"], searchPaths: [fixture.root] }),
    ).toThrow("dim:missing");
    expect(() =>
      bundleCatalogIcons({ names: ["ghost:star"], searchPaths: [fixture.root] }),
    ).toThrow("ghost:star");
    expect(() =>
      bundleCatalogIcons({ names: ["not-a-name"], searchPaths: [fixture.root] }),
    ).toThrow("not-a-name");
    fixture.cleanup();
  });

  it("round-trips an emitted module through the local registry", async () => {
    const fixture = fixtureIcons();
    const out = join(process.cwd(), ".bundle-fixture", "icons.mjs");
    const cleanup = join(process.cwd(), ".bundle-fixture");
    expect(() =>
      bundleCatalogIcons({
        names: ["dim:star", "dim:star2", "dim:wide", "dim:missing"],
        searchPaths: [fixture.root],
        out,
      }),
    ).toThrow("dim:missing");

    const bundle = bundleCatalogIcons({
      names: ["dim:star", "dim:star2", "dim:wide"],
      searchPaths: [fixture.root],
      out,
    });
    expect(bundle.file).toBe(out);
    expect(Object.keys(bundle.icons)).toEqual(["dim:star", "dim:star2", "dim:wide"]);
    expect(readFileSync(out, "utf8")).toBe(bundle.code);

    try {
      const module = await import(pathToFileURL(out).href);
      registerLocalSvgs(module.bundledIcons, { override: false });
      expect(resolveSvgSource("dim:star")).toBe(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d='m1'/></svg>`,
      );
      expect(resolveSvgSource("dim:star2")).toBe(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d='m1'/></svg>`,
      );
      expect(resolveSvgSource("dim:wide")).toBe(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 2 48 12"><path d='m2'/></svg>`,
      );
    } finally {
      rmSync(cleanup, { recursive: true, force: true });
    }
    fixture.cleanup();
  });

  it("uses a runtime-safe .ts export on request without touching the generated data", () => {
    const fixture = fixtureIcons();
    const result = bundleCatalogIcons({
      names: ["dim:star"],
      searchPaths: [fixture.root],
      format: "ts",
    });
    expect(result.code).toBe(
      `export const bundledIcons: Record<string, string> = {\n` +
        `  "dim:star": "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 24 24\\"><path d='m1'/></svg>",\n};\n`,
    );
    fixture.cleanup();
  });

  it("registers names resolvable by the react-native adapter without fs or network", () => {
    const fixture = fixtureIcons();
    const result = bundleCatalogIcons({
      names: ["dim:star", "dim:star2"],
      searchPaths: [fixture.root],
    });
    registerLocalSvgs(result.icons, { override: false });
    expect(resolveSource(undefined, "dim:star")).toSatisfy(isInlineSvg);
    expect(resolveSource(undefined, "dim:star2")).toSatisfy(isInlineSvg);
    fixture.cleanup();
  });

  it("normalizes .svg suffixes and whitespace in emitted keys", () => {
    const fixture = fixtureIcons();
    const result = bundleCatalogIcons({
      names: [" dim:star.svg ", "dim:star2"],
      searchPaths: [fixture.root],
    });
    expect(Object.keys(result.icons)).toEqual(["dim:star", "dim:star2"]);
    expect(() =>
      bundleCatalogIcons({ names: [], searchPaths: [fixture.root], out: "icons.txt" }),
    ).toThrow("icons.txt");
    expect(() =>
      bundleCatalogIcons({ names: [], searchPaths: [fixture.root], out: "icons.cjs" }),
    ).toThrow("icons.cjs");
    expect(
      bundleCatalogIcons({ names: [], searchPaths: [fixture.root] }).code.startsWith(
        "export const bundledIcons: Record<string, string> = {",
      ),
    ).toBe(true);
    fixture.cleanup();
  });
});

describe("offline icon bundle wildcards", () => {
  it("expands wildcards into the bundled data module", () => {
    const fixture = fixtureIcons();
    const result = bundleCatalogIcons({ names: ["dim:*"], searchPaths: [fixture.root] });
    expect(Object.keys(result.icons)).toEqual(["dim:star", "dim:star2", "dim:wide"]);
    expect(result.code).toContain('"dim:star"');
    expect(result.code).toContain('"dim:wide"');
    fixture.cleanup();
  });

  it("expands prefix wildcards but still fails fast on explicit misses", () => {
    const fixture = fixtureIcons();
    expect(
      Object.keys(bundleCatalogIcons({ names: ["dim:sta*"], searchPaths: [fixture.root] }).icons),
    ).toEqual(["dim:star", "dim:star2"]);
    expect(() =>
      bundleCatalogIcons({
        names: ["dim:*", "dim:typo", "ghost:star"],
        searchPaths: [fixture.root],
      }),
    ).toThrow("No source found for these catalog icons: dim:typo, ghost:star");
    fixture.cleanup();
  });
});

describe("offline icon bundle name types", () => {
  it("emits name types scoped to the bundled set", () => {
    const fixture = fixtureIcons();
    const types = join(fixture.root, "svg-catalog.d.ts");
    const result = bundleCatalogIcons({
      names: ["dim:star", "dim:star2", "dim:wide"],
      searchPaths: [fixture.root],
      types,
    });
    expect(result.types).toBe(types);
    const content = readFileSync(types, "utf8");
    expect(content).toContain('import "@mhaadi/svg/catalog-types";');
    expect(content).toContain('"dim": "star" | "star2" | "wide"');
    fixture.cleanup();
  });

  it("writes the types file next to the bundle in script mode by default", () => {
    const fixture = fixtureIcons();
    const previous = process.cwd();
    process.chdir(fixture.root);
    try {
      const result = bundleCatalogIcons({
        names: ["dim:star"],
        searchPaths: [fixture.root],
        out: "icons.ts",
      });
      expect(result.types).toBe(join(fixture.root, "svg-catalog.d.ts"));
      expect(existsSync(join(fixture.root, "svg-catalog.d.ts"))).toBe(true);
    } finally {
      process.chdir(previous);
    }
    fixture.cleanup();
  });

  it("keeps in-memory bundling free of file writes and honors types: false", () => {
    const fixture = fixtureIcons();
    const previous = process.cwd();
    process.chdir(fixture.root);
    try {
      expect(
        bundleCatalogIcons({ names: ["dim:star"], searchPaths: [fixture.root] }).types,
      ).toBeUndefined();
      expect(existsSync(join(fixture.root, "svg-catalog.d.ts"))).toBe(false);
      bundleCatalogIcons({
        names: ["dim:star"],
        searchPaths: [fixture.root],
        out: "icons.ts",
        types: false,
      });
      expect(existsSync(join(fixture.root, "svg-catalog.d.ts"))).toBe(false);
    } finally {
      process.chdir(previous);
    }
    fixture.cleanup();
  });
});
