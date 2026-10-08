import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const packedJson = JSON.parse(
  execFileSync("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], {
    cwd: fileURLToPath(root),
    encoding: "utf8",
  }),
);
const [packed] = Array.isArray(packedJson) ? packedJson : Object.values(packedJson);
const files = new Set(packed.files.map(({ path }) => path));
const maps = [...files].filter((path) => path.endsWith(".map"));
assert.ok(maps.length > 0, "Build the package before checking sourcemaps.");

const missing = [];
for (const path of maps) {
  const map = JSON.parse(await readFile(new URL(path, root), "utf8"));
  for (const [index, source] of map.sources.entries()) {
    if (typeof map.sourcesContent?.[index] === "string") continue;
    const target = posix.normalize(posix.join(posix.dirname(path), map.sourceRoot ?? "", source));
    if (!files.has(target)) missing.push(`${path}: ${target}`);
  }
}
assert.equal(missing.length, 0, `Sourcemaps reference unpublished sources:\n${missing.join("\n")}`);
assert.ok(
  ![...files].some((path) => /\.test\.tsx?$/.test(path)),
  "The published package must not include test files.",
);
console.log(`Verified ${maps.length} published sourcemaps.`);
