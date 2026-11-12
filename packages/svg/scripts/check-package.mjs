import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const temporary = await mkdtemp(join(tmpdir(), "svg-package-"));
try {
  const archiveJson = JSON.parse(
    execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", temporary], {
      cwd: fileURLToPath(root),
      encoding: "utf8",
    }),
  );
  const [archive] = Array.isArray(archiveJson) ? archiveJson : Object.values(archiveJson);
  execFileSync("tar", ["-xzf", join(temporary, archive.filename), "-C", temporary]);
  const packageRoot = join(temporary, "package");
  await symlink(
    fileURLToPath(new URL("node_modules/", root)),
    join(packageRoot, "node_modules"),
    "junction",
  );
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'for (const entry of ["local", "catalog", "vite/plugin", "astro/integration"]) await import(`@mhaadi/svg/${entry}`);',
    ],
    { cwd: packageRoot, stdio: "pipe" },
  );
  console.log("Verified packed Node ESM entry points without a bundler.");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
