# Plan 001: Add vitest harness + core characterization tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7e1b3b6..HEAD -- packages/svg/package.json packages/svg/tsconfig.json turbo.json package.json .github/workflows/deploy.yml`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `7e1b3b6`, 2026-06-23

## Why this matters

The repo ships a sanitization library with **zero automated tests** and **no
test runner**. The security-critical core (`packages/svg/src/core/url.ts`,
`ast.ts`, `local.ts`, `resolve.ts`) has no regression protection, and CI
(`deploy.yml`) runs only `check-types` + `build`. Plans 002–006 refactor and
fix this core; without a characterization harness first, those refactors have
no safety net and no way to prove they didn't break behavior. This plan
establishes the vitest harness, wires `pnpm test` into turbo + CI, and writes
characterization tests that pin the core's current (correct) behavior so
subsequent plans can flip specific assertions when they fix bugs.

## Current state

- `packages/svg/package.json` — the published package; has `build:js`,
  `build:svelte`, `build`, `check-types` scripts. **No `test` script.** No
  test-runner devDependencies.
- `turbo.json` — defines `build`, `lint`, `check-types`, `dev`, `deploy`,
  `destroy` tasks. **No `test` task.**
- `package.json` (root) — scripts: `dev`, `build`, `check-types`, `dev:web`,
  `deploy`, `destroy`, `check`. **No `test` script.**
- `.github/workflows/deploy.yml` — `check` job runs `pnpm check-types` then
  `pnpm build` (lines 26–27). No test step.
- `packages/svg/src/core/url.ts` — pure functions: `isInlineSvg`,
  `decodeDataUrl`, `isSafeUrl`, `hasUnsafeUrl`. No DOM dependency.
- `packages/svg/src/core/ast.ts` — `parseSvgString` (DOM path via
  `parseWithDom` + regex fallback `parseWithRegex`), `sanitizeNode`,
  `renderNode`, `parseAndSanitize`, `parseInlineStyle`, `splitAttributes`,
  `toCamelCase`, `domParserAvailable`. `domParserAvailable()` returns true
  when `window`/`document`/`DOMParser` exist (lines 46–49).
- `packages/svg/src/core/local.ts` — `registerLocalSvgs`, `resolveSvgSource`,
  module-level `localSvgByName` Map. `normalizeName` strips leading `/` and
  `.svg` (lines 9–13); `pathToName` strips `/src/assets/svg/` or
  `/app/assets/svg/` prefix (line 15); `resolveSvgSource` falls back to
  `/assets/svg/${name}.svg` (line 31).
- `packages/svg/src/core/resolve.ts` — `resolveMarkup` (inline → data: →
  fetch) and `resolveSource`. Uses global `fetch`, `Headers`, `AbortController`.

Repo conventions to match:
- Package manager is **pnpm** (`packageManager: pnpm@11.1.3`). Workspace
  catalog pins versions in `pnpm-workspace.yaml` (`catalog:` block).
- TypeScript is strict (`packages/config/tsconfig.base.json`:
  `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`).
- ESM throughout (`"type": "module"`). Test files must be ESM.
- The package already references the Vite ecosystem (`src/vite.ts`,
  `src/vite-env.d.ts`), so **vitest** is the idiomatic runner.

## Commands you will need

| Purpose   | Command                                        | Expected on success |
|-----------|------------------------------------------------|---------------------|
| Install   | `pnpm install`                                 | exit 0              |
| Typecheck | `pnpm check-types`                             | exit 0, no errors   |
| Test      | `pnpm -F @mhaadi/svg test`                     | all pass            |
| Test root | `pnpm test`                                    | all pass            |
| Lint      | `npx oxlint .`                                 | exit 0              |

## Scope

**In scope** (the only files you should modify or create):
- `packages/svg/package.json` — add `test` script + vitest devDeps.
- `packages/svg/vitest.config.ts` — create.
- `packages/svg/vitest.setup.ts` — create.
- `packages/svg/tsconfig.json` — exclude test files from the build `include`/`outDir`.
- `turbo.json` — add `test` task.
- `package.json` (root) — add `test` script.
- `packages/svg/src/core/url.test.ts` — create.
- `packages/svg/src/core/ast.test.ts` — create.
- `packages/svg/src/core/local.test.ts` — create.
- `packages/svg/src/core/resolve.test.ts` — create.
- `.github/workflows/deploy.yml` — add `pnpm test` step (defer the full CI
  hardening + oxlint step to Plan 005; here only add the test run).

**Out of scope** (do NOT touch):
- `packages/svg/src/svg.tsx`, `native.tsx`, `vue/**`, `svelte/**` — adapter
  behavior is covered by plans 002/003/006. This plan tests the **core** only.
- `packages/flutter/**` — Dart; separate toolchain. Plan 004.
- `packages/ui/**` — dead package; Plan 007 removes it.
- `apps/web/**` — Astro app; no test harness needed for these plans.
- Do not change any core source behavior. If a test fails because of a real
  bug, mark it with a descriptive `it.skip(... "TODO(002): ...")` and note it
  in the report — do not "fix" the core here.

## Git workflow

- Branch: `advisor/001-vitest-harness`
- Commit per logical unit; conventional-commit style (repo uses
  `feat(scope):` / `fix(scope):` / `chore:` — see `git log --oneline`).
  Example: `test(svg): add vitest harness and core characterization tests`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Install vitest + happy-dom + react testing library into @mhaadi/svg

Add these to `packages/svg/package.json` `devDependencies`:
- `vitest` (latest 2.x — run `pnpm -F @mhaadi/svg add -D vitest@^2`)
- `happy-dom` (`pnpm -F @mhaadi/svg add -D happy-dom`)
- `@testing-library/react` (`pnpm -F @mhaadi/svg add -D @testing-library/react`)
- `@testing-library/jest-dom` (`pnpm -F @mhaadi/svg add -D @testing-library/jest-dom`)

Then add scripts to `packages/svg/package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```
Place them after the existing `check-types` script, preserving key order and
trailing commas to match the file's current style.

**Verify**: `pnpm install` → exit 0. `pnpm -F @mhaadi/svg exec vitest --version` → prints a 2.x version.

### Step 2: Create vitest config + setup file

Create `packages/svg/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: false,
  },
});
```

Create `packages/svg/vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

**Verify**: `pnpm -F @mhaadi/svg exec vitest run --passWithNoTests` → exit 0 (no tests yet, passes).

### Step 3: Keep test files out of the published build

Edit `packages/svg/tsconfig.json` — the current `include` is
`["src/**/*.ts", "src/**/*.tsx"]` and `exclude` is
`["node_modules", "dist", "src/**/*.svelte", "scripts"]`. Add `"src/**/*.test.ts"`,
`"src/**/*.test.tsx"`, and `"vitest.config.ts"`, `"vitest.setup.ts"` to the
`exclude` array so `tsc -p tsconfig.json` (the build) never emits test files
into `dist/`.

Current `tsconfig.json`:
```json
{
  "extends": "@better-svg/config/tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "types": [],
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist", "src/**/*.svelte", "scripts"]
}
```

**Verify**: `pnpm -F @mhaadi/svg run build` → exit 0. Confirm
`ls packages/svg/dist` contains **no** `*.test.js` files.

### Step 4: Wire turbo + root test script

Add a `test` task to `turbo.json` (after the `check-types` task), matching the
existing task shape. Turbo should not cache test results long-term but a
`dependsOn: ["^build"]` is unnecessary — keep it simple:
```json
"test": {
  "dependsOn": ["^build"]
}
```
Actually, test files import from `src/` directly (not `dist/`), so no build
dependency is needed. Use:
```json
"test": {}
```

Add to root `package.json` `scripts` (after `check-types`):
```json
"test": "turbo test"
```

**Verify**: `pnpm test` → turbo runs `@mhaadi/svg:test` (passes with no tests
because of `--passWithNoTests` default? No — `vitest run` with no matching
files exits 1 by default). To keep `pnpm test` green during this step, Step 5
(writing the first test) must complete before this verify. Run Step 5 first,
then `pnpm test`.

### Step 5: Write `src/core/url.test.ts`

Characterize `url.ts`. Use vitest (`import { describe, it, expect } from "vitest"`).
Cases (assert current behavior — these functions are already correct):
- `isInlineSvg`: `"<svg/>"` → true; `"<?xml ...?>"` → true; `"data:image/svg+xml,..."` → false; `"  <svg"` → true (trims).
- `decodeDataUrl`: `data:image/svg+xml,<svg/>` → `<svg/>`; `data:image/svg+xml;base64,PHN2Zy8+` → `<svg/>`; non-svg data URL → null; bad base64 → null (throws caught).
- `isSafeUrl`: `""` → true; `"#frag"` → true; `"//cdn.example.com/x"` → true; `"http://x"` → true; `"https://x"` → true; `"blob:..."` → true; `"data:image/png,..."` → true; `"data:image/svg+xml,..."` → true; `"javascript:alert(1)"` → **false**; `"javascript:"` → false; `"vbscript:x"` → false; `"relative/path.svg"` → true (no scheme); `"#"` → true.
- `hasUnsafeUrl`: `"fill:url(#grad)"` → false (safe); `"fill:url(javascript:alert(1))"` → true; `"fill:url(http://x)"` → false; `"color:red"` → false; `"fill:url(#a) url(javascript:x)"` → true (mixed).

**Verify**: `pnpm -F @mhaadi/svg test src/core/url.test.ts` → all pass.

### Step 6: Write `src/core/ast.test.ts`

Characterize `ast.ts`. happy-dom provides `DOMParser`, so `domParserAvailable()`
is true in tests (the DOM path is exercised). Cases:
- `toCamelCase`: `"stroke-width"` → `"strokeWidth"`; `"--my-var"` → `"--my-var"`; `"-x"` → `"x"` (leading dash stripped).
- `parseInlineStyle`: `"fill:red;stroke:blue"` → `{ fill: "red", stroke: "blue" }`; `"--brand:red"` → `{ "--brand": "red" }` (custom props preserved); `"  "` → `{}`; `"fill:"` → `{}` (no value).
- `parseSvgString` (DOM path): `"<svg viewBox='0 0 24 24'><rect/></svg>"` → root tag `svg`, one child `rect`. Malformed `"<svg><rect>"` (no close) → still returns a node (DOMParser is lenient) — assert `root !== null` and `root.tag === "svg"`. `"not svg"` → null.
- `sanitizeNode`: build a node `{ tag: "svg", attrs: [], children: [{ tag: "script", attrs: [], children: [] }, { tag: "rect", attrs: [{ name: "onclick", value: "x" }, { name: "fill", value: "red" }], children: [] }] }`. After `sanitizeNode`: script child removed; `onclick` attr removed; `fill` kept.
- `sanitizeNode` href: child with `href: "javascript:alert(1)"` → removed; `href: "#frag"` → kept; `href: "https://x"` → kept.
- `sanitizeNode` style: `style: "fill:url(javascript:x)"` → removed; `style: "fill:url(#g)"` → kept.
- `renderNode`: round-trip a sanitized node → string contains `fill="red"`, no `onclick`, no `<script`.
- `parseAndSanitize(markup, true)`: `"<svg><script>x</script><rect onclick='y'/></svg>"` → no `<script`, no `onclick` in rendered.
- `parseAndSanitize(markup, false)`: same input → script node **kept** (sanitize off) — assert the rendered string contains `<script`.

If any case reveals a core bug (none expected — core is correct), `it.skip` it
with a `TODO` comment and report; do not fix.

**Verify**: `pnpm -F @mhaadi/svg test src/core/ast.test.ts` → all pass (skipped tests, if any, are reported).

### Step 7: Write `src/core/local.test.ts`

Characterize `local.ts`. Note: `localSvgByName` is module-level and persists
across tests in the same file — design tests to register unique names per test
or use `beforeEach`/`afterEach` to call `registerLocalSvgs` with known keys.
Cases:
- `registerLocalSvgs({ "/src/assets/svg/logo.svg": "/assets/logo.svg" })` then `resolveSvgSource("logo")` → `"/assets/logo.svg"`.
- `registerLocalSvgs({ "/src/assets/svg/logo.svg": "A" }, { override: true })` then again with `"B"` override:true → `resolveSvgSource("logo")` → `"B"`.
- Same but second call `override:false` → stays `"A"`.
- `resolveSvgSource("brand/icon")` (unregistered) → `"/assets/svg/brand/icon.svg"` (fallback path).
- `resolveSvgSource("logo.svg")` → resolves as if `logo` (`.svg` stripped by `normalizeName`).
- `resolveSvgSource("/logo")` → leading slash stripped.

**Verify**: `pnpm -F @mhaadi/svg test src/core/local.test.ts` → all pass.

### Step 8: Write `src/core/resolve.test.ts`

Characterize `resolve.ts`. Mock global `fetch` with `vi.stubGlobal("fetch", vi.fn())`
and restore with `vi.unstubAllGlobals()` in `afterEach`. `happy-dom` provides
`Headers`, `AbortController`, `DOMParser`. Cases:
- `resolveMarkup("<svg/>", { signal, cache: false })` → returns `"<svg/>"` (inline, no fetch). Assert fetch not called.
- `resolveMarkup("data:image/svg+xml,<svg/>", { signal, cache: false })` → returns `"<svg/>"` (decoded). No fetch.
- `resolveMarkup("data:image/svg+xml;base64,PHN2Zy8+", { signal, cache: false })` → `"<svg/>"`.
- `resolveMarkup("https://example.com/x.svg", { signal: new AbortController().signal, cache: false })` with `fetch` mocked to return `new Response("<svg/>", { status: 200, headers: { "Content-Type": "image/svg+xml" } })` → resolves to `"<svg/>"`. Assert `fetch` called once with the URL and that an `Accept: image/svg+xml` header was set (inspect the mock call's second arg `.headers`).
- Non-ok response: `fetch` returns `new Response("", { status: 404 })` → `resolveMarkup` rejects with `Error("Failed to fetch SVG: 404 ...")`.
- Empty source: `resolveMarkup("   ", { signal, cache: false })` → rejects with `Error("SVG src is required.")`.
- `resolveSource(src, name)`: `resolveSource("url", undefined)` → `"url"`; `resolveSource(undefined, "logo")` → result of `resolveSvgSource("logo")`; `resolveSource(undefined, undefined)` → `undefined`.

**Verify**: `pnpm -F @mhaadi/svg test src/core/resolve.test.ts` → all pass.

### Step 9: Run everything together + wire CI test step

**Verify**:
- `pnpm -F @mhaadi/svg test` → all tests pass.
- `pnpm test` → turbo runs the test task, all pass.
- `pnpm check-types` → exit 0 (test files typecheck under the base tsconfig; if `vitest/globals` types are missing, add `"vitest/globals"` to a `types` field in `vitest.config.ts` test options — but we set `globals: false` and import from `vitest` explicitly, so types resolve from the package).
- `pnpm -F @mhaadi/svg run build` → exit 0, no test files in `dist/`.
- `npx oxlint .` → exit 0 (test files follow the same lint rules; if oxlint flags `it`/`expect` as unused, ensure imports are used — they will be).

Edit `.github/workflows/deploy.yml` `check` job: add a `pnpm test` step after
`pnpm check-types` and before `pnpm build`. Current lines 25–27:
```yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm check-types
      - run: pnpm build
```
Insert `- run: pnpm test` between `check-types` and `build`. (Plan 005 will
add the oxlint step and finalize CI.)

**Verify**: `grep -n "pnpm test" .github/workflows/deploy.yml` → one match in the `check` job.

## Test plan

All tests are new, written in this plan. No existing test to model after (this
plan establishes the pattern). Future plans (002, 003, 006) add tests in the
same style: `import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm install` exits 0
- [ ] `pnpm -F @mhaadi/svg test` exits 0 — at least 25 assertions across
      `url.test.ts`, `ast.test.ts`, `local.test.ts`, `resolve.test.ts`
- [ ] `pnpm test` (root, turbo) exits 0
- [ ] `pnpm check-types` exits 0
- [ ] `pnpm -F @mhaadi/svg run build` exits 0 and `ls packages/svg/dist`
      contains **no** `*.test.*` files
- [ ] `npx oxlint .` exits 0 (or only the pre-existing
      `packages/infra/alchemy.run.ts:3` unused-import error, which Plan 005
      fixes — no NEW lint errors from this plan)
- [ ] `grep -n "pnpm test" .github/workflows/deploy.yml` returns one match
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (the codebase has drifted since this plan was written).
- `pnpm -F @mhaadi/svg add -D vitest happy-dom @testing-library/react @testing-library/jest-dom`
  fails (registry/network error) — report the exact error.
- A characterization test reveals a **core** bug (not an adapter bug). Core is
  expected correct; if it isn't, STOP and report which function/behavior is
  wrong rather than "fixing" it (fixes belong to 002/003/004/006).
- `vitest run` with no test files exits non-zero and you haven't written tests
  yet — write the tests (Step 5+) before relying on `pnpm test`.
- `tsc -p tsconfig.json` tries to emit test files into `dist/` after the
  tsconfig exclude edit — double-check the exclude globs; if it still emits
  them, STOP and report.

## Maintenance notes

- **Future plans add tests using this harness.** 002 adds
  `core/sanitize.test.ts` (or updates `ast.test.ts`); 003 adds
  `svg.test.tsx` (React cache, uses `@testing-library/react`); 006 adds an
  effect-stability test in the same file.
- **happy-dom vs jsdom:** happy-dom is lighter and sufficient for DOMParser +
  RTL. If a future test needs jsdom-specific behavior (e.g. layout), switch
  `environment` per-file with `// @vitest-environment jsdom`.
- **Watch in review:** confirm the tsconfig exclude actually keeps test files
  out of the published `dist/` — a stray `url.test.js` in the npm package
  would bloat it and is the most likely silent failure.
- **CI:** Plan 005 will add the oxlint gate and tighten CI; this plan only
  adds the `pnpm test` line so the harness runs in CI from the start.
