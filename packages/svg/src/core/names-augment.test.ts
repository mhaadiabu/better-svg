import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { generateCatalogNameTypes } from "./names-codegen";

const tsc = resolve(__dirname, "../../node_modules/.bin/tsc");
const packageRoot = resolve(__dirname, "../..");

// The union check is only true when the generated augmentation reaches
// CatalogSvgName; with no augmentation it is `never` and tsc fails.
const scratchCheck = `
/// <reference path="./fixture.d.ts" />
import type { CatalogSvgName } from "@mhaadi/svg/catalog-types";

type Expect<T extends true> = T;
type Known = Expect<"testy:house" extends CatalogSvgName ? true : false>;
export const known: Known = true;
`;

const scratchConfig = JSON.stringify({
  compilerOptions: {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    module: "nodenext",
    moduleResolution: "nodenext",
    target: "es2022",
    types: [],
    baseUrl: packageRoot,
    paths: { "@mhaadi/svg/catalog-types": ["src/core/names.ts"] },
  },
  files: ["check.ts", "fixture.d.ts"],
});

const writeScratch = (fixture: string) => {
  const dir = mkdtempSync(join(tmpdir(), "svg-augment-"));
  writeFileSync(join(dir, "fixture.d.ts"), fixture);
  writeFileSync(join(dir, "check.ts"), scratchCheck);
  writeFileSync(join(dir, "tsconfig.json"), scratchConfig);
  return dir;
};

const runTsc = (dir: string) =>
  spawnSync(tsc, ["-p", join(dir, "tsconfig.json")], { encoding: "utf8" });

describe("catalog name type augmentation", () => {
  it(
    "propagates generated unions into CatalogSvgName via module augmentation",
    () => {
      const dir = writeScratch(generateCatalogNameTypes([["testy", ["house", "zap"]]]));
      const run = runTsc(dir);
      if (run.status !== 0) {
        throw new Error(`tsc rejected the augmentation:\n${run.stdout}\n${run.stderr}`);
      }
      rmSync(dir, { recursive: true, force: true });
    },
    30_000,
  );

  it(
    "fails the same check without an augmentation, so the guard is not vacuous",
    () => {
      const dir = writeScratch(generateCatalogNameTypes([]));
      const run = runTsc(dir);
      expect(run.status, run.stdout + run.stderr).not.toBe(0);
      rmSync(dir, { recursive: true, force: true });
    },
    30_000,
  );
});
