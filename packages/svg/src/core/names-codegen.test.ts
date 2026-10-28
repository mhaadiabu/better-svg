import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateCatalogNameTypes, writeCatalogNameTypes } from "./names-codegen";

const digestOf = (content: string) => content.match(/^\/\/ digest: ([0-9a-f]+)$/m)?.[1];

describe("generated catalog name types", () => {
  it("augments the catalog-types module with sorted quoted unions", () => {
    const content = generateCatalogNameTypes([
      ["zeta", ["b", "a"]],
      ["alpha", ["x"]],
    ]);
    expect(content).toContain('import "@mhaadi/svg/catalog-types";');
    expect(content).toContain('declare module "@mhaadi/svg/catalog-types" {');
    expect(content).toContain('    "alpha": "x";');
    expect(content).toContain('    "zeta": "a" | "b";');
    expect(digestOf(content)).toMatch(/^[0-9a-f]{16}$/);
  });

  it("dedupes names and stays byte-identical across input order", () => {
    const first = generateCatalogNameTypes([["lucide", ["house", "zap"]]]);
    const second = generateCatalogNameTypes([["lucide", ["zap", "house", "house"]]]);
    expect(second).toContain('"lucide": "house" | "zap"');
    expect(second).toBe(first);
  });

  it("changes the digest when a name list changes", () => {
    const before = generateCatalogNameTypes([["lucide", ["house"]]]);
    const after = generateCatalogNameTypes([["lucide", ["house", "zap"]]]);
    expect(digestOf(after)).not.toBe(digestOf(before));
  });

  it("writes an empty interface when nothing is seen", () => {
    const content = generateCatalogNameTypes([]);
    expect(content).toContain("interface SvgCatalogIcons {}");
  });

  it("skips the write when the file already holds the content", () => {
    const root = mkdtempSync(join(tmpdir(), "svg-names-"));
    const file = join(root, "nested", "svg-catalog.d.ts");
    expect(writeCatalogNameTypes(file, [["testy", ["house"]]])).toBe("written");
    expect(readFileSync(file, "utf8")).toContain('"testy": "house"');
    expect(writeCatalogNameTypes(file, [["testy", ["house"]]])).toBe("unchanged");
    expect(writeCatalogNameTypes(file, [["testy", ["house", "zap"]]])).toBe("written");
    rmSync(root, { recursive: true, force: true });
  });
});
