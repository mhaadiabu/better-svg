import { describe, it, expect, beforeEach } from "vitest";
import { registerLocalSvgs, resolveSvgSource } from "./local";

describe("local svg registry", () => {
  beforeEach(() => {
    registerLocalSvgs({ "/src/assets/svg/registry-isolated.svg": "INIT" }, { override: true });
  });

  it("registers a path → url mapping and resolves by name", () => {
    registerLocalSvgs({ "/src/assets/svg/logo.svg": "/assets/logo.svg" });
    expect(resolveSvgSource("logo")).toBe("/assets/logo.svg");
  });

  it("overrides an existing entry when override is true (default)", () => {
    registerLocalSvgs({ "/src/assets/svg/logo.svg": "A" }, { override: true });
    expect(resolveSvgSource("logo")).toBe("A");
    registerLocalSvgs({ "/src/assets/svg/logo.svg": "B" }, { override: true });
    expect(resolveSvgSource("logo")).toBe("B");
  });

  it("keeps the existing entry when override is false", () => {
    registerLocalSvgs({ "/src/assets/svg/keepit.svg": "A" }, { override: true });
    registerLocalSvgs({ "/src/assets/svg/keepit.svg": "B" }, { override: false });
    expect(resolveSvgSource("keepit")).toBe("A");
  });

  it("falls back to the /assets/svg/<name>.svg path for unregistered names", () => {
    expect(resolveSvgSource("brand/icon")).toBe("/assets/svg/brand/icon.svg");
  });

  it("strips a trailing .svg via normalizeName", () => {
    registerLocalSvgs({ "/src/assets/svg/trail.svg": "T" });
    expect(resolveSvgSource("trail.svg")).toBe("T");
  });

  it("strips a leading slash via normalizeName", () => {
    registerLocalSvgs({ "/src/assets/svg/lead.svg": "L" });
    expect(resolveSvgSource("/lead")).toBe("L");
  });
});