import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveIconSource, registerCatalogIcons } from "./catalog";
import { resolveSvgSource, registerLocalSvgs } from "./local";

const makeFixture = () => {
  const root = mkdtempSync(join(tmpdir(), "svg-catalog-"));
  const nodeModules = join(root, "node_modules");
  const write = (file: string, content: string) => {
    mkdirSync(join(nodeModules, file, ".."), { recursive: true });
    writeFileSync(join(nodeModules, file), content);
  };
  return { root, nodeModules, write };
};

describe("icon catalog", () => {
  it("rejects malformed names", () => {
    expect(resolveIconSource("", { searchPaths: ["/x"] })).toBeUndefined();
    expect(resolveIconSource("house", { searchPaths: ["/x"] })).toBeUndefined();
    expect(resolveIconSource("lucide:", { searchPaths: ["/x"] })).toBeUndefined();
    expect(resolveIconSource(":house", { searchPaths: ["/x"] })).toBeUndefined();
    expect(resolveIconSource("lucide", { searchPaths: ["/x"] })).toBeUndefined();
    expect(resolveIconSource("lu cide:house", { searchPaths: ["/x"] })).toBeUndefined();
    expect(resolveIconSource("lucide:house:x", { searchPaths: ["/x"] })).toBeUndefined();
  });

  it("returns undefined when no installed package matches", () => {
    expect(resolveIconSource("lucide:house", { searchPaths: ["/nonexistent"] })).toBeUndefined();
  });

  it("resolves from @iconify-json packages", () => {
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
        aliases: {
          star2: { parent: "star" },
          tall: { parent: "star", left: 1, top: 3, width: 32, height: 64 },
        },
      }),
    );
    expect(resolveIconSource("dim:star", { searchPaths: [fixture.root] })).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d='m1'/></svg>`,
    );
    expect(resolveIconSource("dim:wide", { searchPaths: [fixture.root] })).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 2 48 12"><path d='m2'/></svg>`,
    );
    expect(resolveIconSource("dim:star2", { searchPaths: [fixture.root] })).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d='m1'/></svg>`,
    );
    expect(resolveIconSource("dim:tall", { searchPaths: [fixture.root] })).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="1 3 32 64"><path d='m1'/></svg>`,
    );
    expect(resolveIconSource("dim:wide.svg", { searchPaths: [fixture.root] })).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 2 48 12"><path d='m2'/></svg>`,
    );
    expect(resolveIconSource("dim:missing", { searchPaths: [fixture.root] })).toBeUndefined();
    rmSync(fixture.root, { recursive: true, force: true });
  });

  it("rejects collections whose shapes are malformed", () => {
    const fixture = makeFixture();
    fixture.write(join("@iconify-json", "bad1", "icons.json"), "{not json");
    fixture.write(
      join("@iconify-json", "bad2", "icons.json"),
      JSON.stringify({ prefix: "bad2", icons: ["not-an-object"] }),
    );
    fixture.write(
      join("@iconify-json", "bad3", "icons.json"),
      JSON.stringify({ prefix: "bad3", icons: { x: { body: "<path/>" } }, aliases: [] }),
    );
    expect(resolveIconSource("bad1:x", { searchPaths: [fixture.root] })).toBeUndefined();
    expect(resolveIconSource("bad2:x", { searchPaths: [fixture.root] })).toBeUndefined();
    expect(resolveIconSource("bad3:x", { searchPaths: [fixture.root] })).toBeUndefined();
    rmSync(fixture.root, { recursive: true, force: true });
  });

  it("resolves from the @iconify/json monolithic package", () => {
    const fixture = makeFixture();
    fixture.write(
      join("@iconify", "json", "json", "mono.json"),
      JSON.stringify({ prefix: "mono", icons: { ball: { body: "<circle/>" } } }),
    );
    expect(resolveIconSource("mono:ball", { searchPaths: [fixture.root] })).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle/></svg>`,
    );
    rmSync(fixture.root, { recursive: true, force: true });
  });

  it("probes lucide-static, tabler outline then filled, and phosphor regular", () => {
    const fixture = makeFixture();
    fixture.write(
      join("lucide-static", "icons", "house.svg"),
      "<svg viewBox='0 0 24 24'><path d='lucide'/></svg>",
    );
    fixture.write(
      join("@tabler", "icons", "icons", "outline", "settings.svg"),
      "<svg viewBox='0 0 24 24'><path d='outline'/></svg>",
    );
    fixture.write(
      join("@tabler", "icons", "icons", "filled", "heart.svg"),
      "<svg viewBox='0 0 24 24'><path d='filled'/></svg>",
    );
    fixture.write(
      join("@phosphor-icons", "core", "assets", "regular", "bell.svg"),
      "<svg viewBox='0 0 256 256'><path d='phosphor'/></svg>",
    );
    expect(resolveIconSource("lucide:house", { searchPaths: [fixture.root] })).toContain("lucide");
    expect(resolveIconSource("tabler:settings", { searchPaths: [fixture.root] })).toContain(
      "outline",
    );
    expect(resolveIconSource("tabler:heart", { searchPaths: [fixture.root] })).toContain("filled");
    expect(resolveIconSource("phosphor:bell", { searchPaths: [fixture.root] })).toContain(
      "phosphor",
    );
    rmSync(fixture.root, { recursive: true, force: true });
  });

  it("prefers @iconify-json data over plain package probes", () => {
    const fixture = makeFixture();
    fixture.write(
      join("@iconify-json", "lucide", "icons.json"),
      JSON.stringify({
        prefix: "lucide",
        icons: { house: { body: "<path d='json'/>" } },
      }),
    );
    fixture.write(
      join("lucide-static", "icons", "house.svg"),
      "<svg viewBox='0 0 24 24'><path d='static'/></svg>",
    );
    expect(resolveIconSource("lucide:house", { searchPaths: [fixture.root] })).toContain("json");
    rmSync(fixture.root, { recursive: true, force: true });
  });

  it("caches resolution per search context", () => {
    const fixture = makeFixture();
    fixture.write(
      join("@iconify-json", "cache", "icons.json"),
      JSON.stringify({ prefix: "cache", icons: { hit: { body: "<path/>" } } }),
    );
    expect(resolveIconSource("cache:hit", { searchPaths: [fixture.root] })).toContain("path");
    rmSync(fixture.root, { recursive: true, force: true });
    expect(resolveIconSource("cache:hit", { searchPaths: [fixture.root] })).toContain("path");
  });

  it("registers resolved icons into the local registry without overriding local svgs", () => {
    const fixture = makeFixture();
    fixture.write(
      join("@iconify-json", "reg", "icons.json"),
      JSON.stringify({ prefix: "reg", icons: { pin: { body: "<path/>" } } }),
    );
    registerLocalSvgs({ "reg:pin": "LOCAL" }, { override: true });
    expect(
      registerCatalogIcons(["reg:pin", "reg:missing"], { searchPaths: [fixture.root] }),
    ).toEqual(["reg:pin"]);
    expect(resolveSvgSource("reg:pin")).toBe("LOCAL");
    expect(registerCatalogIcons(["reg:pin"], { searchPaths: [fixture.root] })).toEqual(["reg:pin"]);
    expect(resolveSvgSource("reg:pin")).toBe("LOCAL");
    rmSync(fixture.root, { recursive: true, force: true });
  });
});
