import { describe, it, expect, vi, beforeEach } from "vitest";
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

  it("resolves hugeicons from @hugeicons/core-free-icons before the iconify fallback", () => {
    const fixture = makeFixture();
    fixture.write(
      join("@hugeicons", "core-free-icons", "dist", "cjs", "ArrowLeft01Icon.js"),
      `module.exports = [["path", { d: "M15 6C15 6 9 10.4 9 12", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.5", key: "0" }]];`,
    );
    fixture.write(
      join("@hugeicons", "core-free-icons", "dist", "cjs", "AArrowDownIcon.js"),
      `module.exports = [["path", { d: "m2", fill: "currentColor", fillRule: "evenodd", key: "0" }]];`,
    );
    fixture.write(
      join("@hugeicons", "core-free-icons", "dist", "cjs", "ZodiacTaurusIcon.js"),
      `module.exports = [["circle", { cx: "12", cy: "15", r: "6", key: "0" }], ["path", { d: "m6", key: "1" }]];`,
    );
    fixture.write(
      join("@iconify-json", "hugeicons", "icons.json"),
      JSON.stringify({
        prefix: "hugeicons",
        width: 24,
        height: 24,
        icons: { "arrow-left-01": { body: `collection-fallback` } },
      }),
    );
    expect(resolveIconSource("hugeicons:arrow-left-01", { searchPaths: [fixture.root] })).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M15 6C15 6 9 10.4 9 12" stroke="currentColor" stroke-linecap="round" stroke-width="1.5" /></svg>`,
    );
    expect(resolveIconSource("hugeicons:a-arrow-down", { searchPaths: [fixture.root] })).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m2" fill="currentColor" fill-rule="evenodd" /></svg>`,
    );
    expect(resolveIconSource("hugeicons:zodiac-taurus", { searchPaths: [fixture.root] })).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="15" r="6" /><path d="m6" /></svg>`,
    );
    expect(resolveIconSource("hugeicons:missing", { searchPaths: [fixture.root] })).toBeUndefined();
    rmSync(fixture.root, { recursive: true, force: true });
  });

  it("falls back to @iconify-json/hugeicons when the native package is missing", () => {
    const fixture = makeFixture();
    fixture.write(
      join("@iconify-json", "hugeicons", "icons.json"),
      JSON.stringify({
        prefix: "hugeicons",
        width: 24,
        height: 24,
        icons: {
          "1st-bracket": {
            body: `<path fill="none" stroke="currentColor" d="M9 4H6a2 2 0 00-2 2v12"/>`,
          },
          "all-application": { body: `stroke-icons` },
        },
        aliases: {
          "house-01": { parent: "all-application" },
          "home-12": { parent: "all-application", width: 12, height: 12 },
        },
      }),
    );
    expect(resolveIconSource("hugeicons:1st-bracket", { searchPaths: [fixture.root] })).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" d="M9 4H6a2 2 0 00-2 2v12"/></svg>`,
    );
    expect(resolveIconSource("hugeicons:house-01", { searchPaths: [fixture.root] })).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">stroke-icons</svg>`,
    );
    expect(resolveIconSource("hugeicons:home-12", { searchPaths: [fixture.root] })).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12">stroke-icons</svg>`,
    );
    expect(resolveIconSource("hugeicons:missing", { searchPaths: [fixture.root] })).toBeUndefined();
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

describe("catalog wildcards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const iconifyFixture = () => {
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
          ghost: { body: "<path d='gone'/>", hidden: true },
        },
        aliases: {
          star2: { parent: "star" },
          tall: { parent: "star", left: 1, top: 3, width: 32, height: 64 },
        },
      }),
    );
    return fixture;
  };

  it("expands a full-collection wildcard resolvable names only", () => {
    const fixture = iconifyFixture();
    expect(registerCatalogIcons(["dim:*"], { searchPaths: [fixture.root] })).toEqual([
      "dim:star",
      "dim:star2",
      "dim:tall",
      "dim:wide",
    ]);
    expect(resolveSvgSource("dim:wide")).toContain("<path d='m2'/>");
    rmSync(fixture.root, { recursive: true, force: true });
  });

  it("expands trailing-prefix wildcards", () => {
    const fixture = iconifyFixture();
    expect(registerCatalogIcons(["dim:star*"], { searchPaths: [fixture.root] })).toEqual([
      "dim:star",
      "dim:star2",
    ]);
    rmSync(fixture.root, { recursive: true, force: true });
  });

  it("dedupes and sorts mixed lists of wildcards and explicit names", () => {
    const fixture = iconifyFixture();
    expect(
      registerCatalogIcons(["dim:wide", "dim:star", "dim:*"], { searchPaths: [fixture.root] }),
    ).toEqual(["dim:star", "dim:star2", "dim:tall", "dim:wide"]);
    rmSync(fixture.root, { recursive: true, force: true });
  });

  it("warns when a wildcard matches nothing", () => {
    const fixture = iconifyFixture();
    const warnings: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((message) => {
      warnings.push(String(message));
    });
    expect(registerCatalogIcons(["dim:nope*"], { searchPaths: [fixture.root] })).toEqual([]);
    expect(warnings.join("\n")).toContain(
      '[@mhaadi/svg] catalog wildcard "dim:nope*" matched no installed icon names; is the icon package installed?',
    );
    rmSync(fixture.root, { recursive: true, force: true });
  });

  it("enumerates svgs shipped by icon packages", () => {
    const fixture = makeFixture();
    fixture.write(
      join("lucide-static", "icons", "house.svg"),
      "<svg viewBox='0 0 24 24'><path d='lucide'/></svg>",
    );
    fixture.write(
      join("lucide-static", "icons", "heart.svg"),
      "<svg viewBox='0 0 24 24'><path d='heart'/></svg>",
    );
    fixture.write(join("lucide-static", "icons", "notes.md"), "not a svg");
    expect(registerCatalogIcons(["lucide:*"], { searchPaths: [fixture.root] })).toEqual([
      "lucide:heart",
      "lucide:house",
    ]);
    rmSync(fixture.root, { recursive: true, force: true });
  });

  it("enumerates hugeicons modules as kebab names", () => {
    const fixture = makeFixture();
    fixture.write(
      join("@hugeicons", "core-free-icons", "dist", "cjs", "ArrowLeft01Icon.js"),
      `module.exports = [["path", { d: "m1", key: "0" }]];`,
    );
    fixture.write(
      join("@hugeicons", "core-free-icons", "dist", "cjs", "AArrowDownIcon.js"),
      `module.exports = [["path", { d: "m2", key: "0" }]];`,
    );
    fixture.write(
      join("@hugeicons", "core-free-icons", "dist", "cjs", "index.js"),
      `module.exports = {};`,
    );
    expect(registerCatalogIcons(["hugeicons:*"], { searchPaths: [fixture.root] })).toEqual([
      "hugeicons:a-arrow-down",
      "hugeicons:arrow-left-01",
    ]);
    rmSync(fixture.root, { recursive: true, force: true });
  });

  it("reports the size when a wildcard registers many bytes", () => {
    const fixture = iconifyFixture();
    const warnings: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((message) => {
      warnings.push(String(message));
    });
    registerCatalogIcons(["dim:*"], { searchPaths: [fixture.root] });
    expect(warnings.join("\n")).not.toContain("wildcard catalog icons");
    rmSync(fixture.root, { recursive: true, force: true });
  });
});
