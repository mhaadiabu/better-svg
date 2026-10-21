import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { scanCatalogNames } from "./scan";

const write = async (root: string, file: string, content: string) => {
  await mkdir(join(root, file, ".."), { recursive: true });
  await writeFile(join(root, file), content, "utf8");
};

describe("catalog usage scan", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "svg-scan-"));
  });

  it("collects collection:icon literals across scannable sources", async () => {
    await write(root, "src/ui/nav.tsx", `<SVG name="lucide:house" /><SVG name="lucide:house" />\n`);
    await write(
      root,
      "src/icons.ts",
      `export const icons = { home: "lucide:house", gear: "tabler:settings" };\n`,
    );
    await write(root, "src/pages/docs.mdx", 'usage: <SVG name="lucide:house" />\n');
    const result = await scanCatalogNames(root);
    expect(result.names).toEqual(["lucide:house", "tabler:settings"]);
    expect(result.files).toBe(3);
    expect(result.references).toBe(5);
    expect(result.filesBy.get("lucide:house")).toEqual([
      "src/icons.ts",
      "src/pages/docs.mdx",
      "src/ui/nav.tsx",
    ]);
    expect(result.dynamic).toEqual([]);
  });

  it("scans astro, vue, svelte, and html template surfaces", async () => {
    await write(root, "src/pages/index.astro", `<SVG name="phosphor:bell" />\n`);
    await write(root, "src/components/Nav.vue", `<SVG name="lucide:menu" />\n`);
    await write(root, "src/components/Toggle.svelte", `<SVG name="tabler:x" />\n`);
    await write(root, "src/app/widget.html", `<svg name="lucide:loader"></svg>\n`);
    const result = await scanCatalogNames(root);
    expect(result.names).toEqual(["lucide:loader", "lucide:menu", "phosphor:bell", "tabler:x"]);
  });

  it("skips standard directories, dot tooling dirs, and unlisted extensions", async () => {
    await write(root, "node_modules/pkg/index.ts", `name="lucide:house"\n`);
    await write(root, "dist/index.js", `name="lucide:house"\n`);
    await write(root, "build/tmp.js", `name="lucide:house"\n`);
    await write(root, "out/x.js", `name="lucide:house"\n`);
    await write(root, "output/x.js", `name="lucide:house"\n`);
    await write(root, "coverage/x.js", `name="lucide:house"\n`);
    await write(root, "vendor/pkg/index.mjs", `name="lucide:house"\n`);
    await write(root, ".git/hooks.sh", `name="lucide:house"\n`);
    await write(root, "src/keep.ts", `name="lucide:star"\n`);
    await write(root, "src/notes.md", `name="lucide:star"\n`);
    await write(root, "src/style.css", `a:after { content: "lucide:star"; }\n`);
    const result = await scanCatalogNames(root);
    expect(result.names).toEqual(["lucide:house", "lucide:star"]);
    expect(result.filesBy.get("lucide:star")).toEqual(["src/keep.ts"]);
    expect(result.filesBy.get("lucide:house")).toEqual(["vendor/pkg/index.mjs"]);
  });

  it("honors include, exclude, and maxFileBytes options", async () => {
    await write(root, "src/icons/a.tsx", `name="lucide:house"\n`);
    await write(root, "vendor/icons/b.ts", `name="lucide:star"\n`);
    await write(root, "src/tmp.tsx", `name="lucide:skipped-because-huge"\n`.repeat(400));
    const result = await scanCatalogNames(root, {
      include: ["src", "vendor"],
      exclude: ["src/tmp.tsx"],
      maxFileBytes: 90,
    });
    expect(result.names).toEqual(["lucide:house", "lucide:star"]);
    expect(result.files).toBe(2);
  });

  it("skips symlink loops and dedupes aliased files", async () => {
    await write(root, "src/lib/deep/c.tsx", `name="lucide:star"\n`);
    await symlink(join(root, "src/lib/deep"), join(root, "src/lib/loop"));
    const result = await scanCatalogNames(root);
    expect(result.names).toEqual(["lucide:star"]);
    expect(result.files).toBe(1);
    expect(result.filesBy.get("lucide:star")).toEqual(["src/lib/deep/c.tsx"]);
  });

  it("skips missing include directories instead of failing", async () => {
    await write(root, "src/main.ts", `name="lucide:house"\n`);
    const result = await scanCatalogNames(root, { include: ["src", "absent-app"] });
    expect(result.names).toEqual(["lucide:house"]);
  });

  it("matches catalog-like text only in the name alphabet", async () => {
    await write(
      root,
      "src/text.ts",
      [
        `console.log("https://example.com/?q=x");`,
        `console.log("HTTPS://impervious.com");`,
        `console.log("lucideHouse");`,
        `console.log("house");`,
        `console.log("lucide:");`,
        `console.log(":house");`,
        `console.log("lucide:HOUSE");`,
      ].join("\n"),
    );
    const result = await scanCatalogNames(root);
    expect(result.names).toEqual([]);
  });

  it("records template literals as dynamic hints", async () => {
    await write(root, "src/icons.ts", "const id = 1;\nexport const C = `lucide:${id}`;\n");
    const result = await scanCatalogNames(root);
    expect(result.names).toEqual([]);
    expect(result.dynamic).toEqual(["src/icons.ts:2 (`lucide:${id}`)"]);
  });

  it("leaves unrelated template literals alone", async () => {
    await write(root, "src/plain.ts", "const a = `hello-${name}`;\nconst b = `${prefix}:x`;\n");
    const result = await scanCatalogNames(root);
    expect(result.dynamic).toEqual([]);
  });
});
