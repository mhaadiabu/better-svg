# Plan 007: Auto-register catalog icons from source usage

> **Executor instructions**: This is a design + implementation plan written
> from the actual code in `packages/svg`. Read it fully before starting.
> It resolves the DX objection that users with N icons from one collection
> must list N exact names in one array. The design is opinionated: the
> rejected approaches at the bottom were rejected on purpose. If the code
> no longer matches the excerpts pinned in "Current state", treat that as
> a drift condition and re-derive the affected section before proceeding.
>
> **Drift check (run first)**:
> `git log -5 --oneline main -- packages/svg/src/vite/plugin.ts packages/svg/src/core/catalog.ts packages/svg/src/core/local.ts`
> then skim those files. This plan was written against main `42b0535`
> (2026-10-21, release `@mhaadi/svg 0.4.0 — pre-release steps (#43)`). The
> pinned excerpts are the transform hook, the appended registration call,
> `registerCatalogIcons`, and the `override: false` precedence in
> `registerLocalSvgs`. Nothing in 005 (sprites) or 006 (SVGO default) is a
> prerequisite; see "Dependency notes" in `plans/README.md`.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MEDIUM (the feature is a build-time heuristic; its two failure
  modes — silently missing usage and silently over-registering — must be
  designed against, not discovered)
- **Category**: DX
- **Depends on**: nothing. `svgo` / `precompiled` in the plugin are
  inherited as-is; if 006 changes their defaults after 0.4.0, scanned
  catalog icons pick the new defaults up for free.
- **Planned at**: commit `42b0535`, 2026-10-21
- **Feature motivation**: 0.4.0 added the icon catalog with manual
  registration. Registering 100 lucide icons means typing 100 exact
  strings in one array, and misses are silent (see "Failure handling"
  below). That is the registration-pain this plan removes for the
  Vite-plugin audience while keeping everything else working unchanged.

## Executive verdict

**Worth building.** The fix reuses machinery that already exists in the
repo end to end: the Vite plugin already scans build inputs and appends a
generated `registerLocalSvgs` call to every evaluation of
`@mhaadi/svg`'s local-registry module, and `resolveIconSource` already
resolves `collection:icon` from `node_modules` at build time. The new
work is one scan pass in the plugin that turns the strings it finds into
an _inline markup_ registration — no new runtime, no new module, no
transform of user code.

Core rules of the design:

1. **Scan source text, not syntax trees.** A cheap, allowlisted
   extension, ignore-listed file walk looks for literals that match the
   catalog name shape (`collection:icon`). Parse-level frameworks
   (React/Vue/Svelte/Astro) all spell the prop `name="..."`, but names
   legitimately also live in maps, config objects, and Angular
   string-bound bindings, and file extension + ignore lists plus the
   conservative name regex get there without a single AST dependency.
2. **Fail nothing by default; warn loudly; escalate only on request.**
   This mirrors the existing family: `registerCatalogIcons` never errors
   (miss → fetch fallback), `bundleCatalogIcons` fails fast and so does
   the plugin's `dirs`+`svgo` path. A heuristic that errors by default
   would one day break an unrelated build on a doc string. So: unresolved
   names and dynamic usage log warnings; `catalog: { strict: true }`
   turns unresolved-against-installed-collection into build errors.
3. **Registration stays `override: false`, after the `dirs` entries.**
   Local files and explicit `registerLocalSvgs` entries keep precedence
   exactly as documented today.
4. **Nothing ships that cannot read `node_modules` at render time.**
   React Native and plugin-less browser bundles keep
   `bundleCatalogIcons`; the scan only produces inline markup at build
   time, so it cannot regress those runtimes. Wildcards
   (`registerCatalogIcons(["lucide:*"])`) are added as the explicit
   escape hatch for "give me the whole collection", with honest bundle
   size.

## Why this matters

Today the catalog is 0.4.0's manual step:

```ts
registerCatalogIcons(["lucide:house", "lucide:arrow-right" /* ×98 more */]);
```

Three concrete costs, in order of pain:

1. **Typing N names.** A dashboard with 60 lucide icons pays 60 strings,
   and every long-lived codebase drifts toward "every icon anyone ever
   used" in that array.
2. **Silent misses.** A typo is invisible: `registerCatalogIcons` skips
   it, the name falls back to `/assets/svg/{name}.svg`, that 404s, and
   the adapter renders its `fallback` state. The docs' own advice is to
   diff the return array against the input — an affordance users do not
   actually use, and one the scan approach can replace with a badge in
   the terminal instead of a diff ritual.
3. **Context switching.** Icon usage lives in components; the mapping
   from a rendered `<SVG name>` to the registration call site is manual
   bookkeeping.

The Vite plugin already proves the repo's preferred shape for "zero
config DX": scan at build time, inline the result into the bundle. The
catalog just never got wired into that shape.

## Current state (pinned excerpts)

### 1. The plugin's transform appends registration to the local-registry module

`packages/svg/src/vite/plugin.ts:64-137` (shape after `configResolved`):

```ts
async transform(code, id) {
  const path = id.split("?")[0]!.replace(/\\/g, "/");
  if (
    !path ||
    !/(?:\/@mhaadi\/svg|\/packages\/svg)\/(?:dist|src)\/core\/local\.(?:js|ts)$/.test(path)
  )
    return;
  // ... walk `dirs`, svgo + precompiled pipelines, watchers ...
  const registration = precompiled
    ? JSON.stringify({ override: false, precompiled: Object.fromEntries(precompiled) })
    : "{ override: false }";
  return {
    code: `${code}\nregisterLocalSvgs(${JSON.stringify(Object.fromEntries(entries))}, ${registration});\n`,
    map: null,
  };
}
```

Two facts load the design:

- The transform target is **`@mhaadi/svg`'s own module**, filtered by a
  regex on its path (`core/local.(js|ts)` under `dist` or `src`), not
  user files. Registration piggybacks on a module every adapter already
  imports to resolve `name`, so the scan needs no new runtime entry.
- The plugin calls `this.addWatchFile(...)` on each `dirs` entry and
  wires `configureServer` to `invalidateAll()` + full reload. Scans need
  the same bones.

### 2. Catalog resolution is a build-time Node function

`packages/svg/src/core/catalog.ts:235-256`:

```ts
export const resolveIconSource = (name: string, options: CatalogOptions = {}) => { ... };
export const registerCatalogIcons = (names: readonly string[], options: CatalogOptions = {}) => {
  const registered: string[] = [];
  for (const name of names) {
    const markup = resolveIconSource(name, options);
    if (!markup) continue;
    registerLocalSvgs({ [name]: markup }, { override: false });
    registered.push(name);
  }
  return registered;
};
```

`resolveIconSource` is exactly the primitive the plugin needs — it is
pure Node fs, probes iconify data packages (`@iconify-json/<c>`,
`@iconify/json`) and file packages (`lucide-static`, `@tabler/icons`,
`@phosphor-icons/core`, `@hugeicons/core-free-icons`), and caches per
(name, roots). The plugin can call it directly; the generated code it
emits does **not** need `registerCatalogIcons` and does **not** need fs
at render time:

```ts
registerLocalSvgs({ "lucide:house": `<svg xmlns="...">...</svg>` }, { override: false });
```

This is the same trick the `dirs` scan already plays, applied to catalog
names.

### 3. Precedence lives in `registerLocalSvgs` and the call order

`packages/svg/src/core/local.ts:76-81`:

```ts
for (const [name, entry] of prepared) {
  if (!override && localSvgByName.has(name)) continue;
  ...
}
```

with the fetch fallback in `resolveSvgSource` (`local.ts:84-89`) using
`/assets/svg/{name}.svg`. Precedence today, in order: browser-side
`?raw` module registrations (vite.ts), user `registerLocalSvgs` calls,
plugin `dirs` scan, catalog registration, fetch fallback. The plugin
registers `dirs` with `override: false`, so any registration that lands
before it wins. A second appended call with `override: false` slots
catalog icons at the **bottom** of that ladder automatically.

### 4. Failure-handling precedent, in both directions

- `apps/web/src/pages/docs.astro:985` (catalog): "Registration **never
  errors**. A misspelled icon or collection name is silently skipped…"
- `packages/svg/src/core/bundle.ts:47-49` (bundle): a miss **fails the
  whole script** — `No source found for these catalog icons: …`.
- `plugin.ts` dirs+svgo path: bad discovered files **fail the build**
  with wrapped messages (`SVGO pass failed for "<name>": …`).

Auto-scan sits between the two. The right default for a heuristic that
runs against _all source files_ is warn (doc strings and comments
legitimately contain name-shaped strings); strict is opt-in when the
name is impossible to render (collection installed, icon absent).

### 5. The plugin's options (`docs.astro`, "Local discovery" + "Icon catalog")

`LocalSvgOptions = { dirs?, svgo?, precompiled? }`, validated up front
(absolute paths, globs, `..` rejected at plugin construction). Options
for the scan must extend this shape, not fork a second plugin, because
the Astro integration (`astro/integration.ts`) passes `LocalSvgOptions`
straight through.

## Design

### API sketch

```ts
type CatalogScanOptions = {
  /** Directories (relative to Vite root) holding source to scan. Default: ["."] */
  include?: string[];
  /** Additional ignored directories on top of the standard set. */
  exclude?: string[];
  /** Escalate unresolved names against installed collections to build errors. Default: false */
  strict?: boolean;
  /** Peak file size to read, bytes. Default: 524_288 */
  maxFileBytes?: number;
};

// LocalSvgOptions gains:
type LocalSvgOptions = {
  dirs?: string[];
  svgo?: SvgoOption;
  precompiled?: boolean;
  /** Omit/off: no scanning (today's behavior). true: defaults. */
  catalog?: boolean | CatalogScanOptions;
};
```

Usage (the whole setup for "no more manual registration"):

```ts
// astro.config.mjs or vite.config.ts — identical option surface
import svgs from "@mhaadi/svg/astro/integration";

export default defineConfig({ integrations: [svgs({ catalog: true })] });
```

`svgo` and `precompiled` are plugin-level and **inherited by scanned
catalog icons** — one option set remains, covering `dirs` and catalog
together. Note this widens today's documented svgo claim ("discovered
files are the only ones it touches") in M6 docs: plugin-registered
catalog markup is plugin-produced, which is the property the claim was
protecting.

Side feature, same PR, one milestone: wildcards in the manual API, for
runtimes outside the plugin's reach.

```ts
registerCatalogIcons(["lucide:*"]); // every name in the installed source
registerCatalogIcons(["lucide:arrow*"]); // trailing-`*` prefix match only
bundleCatalogIcons({ names: ["lucide:*"], out: "./src/icons/generated.ts" });
```

Expansion enumerates from the same probes resolve uses (iconify JSON
`icons` + `aliases` keys; `lucide-static` / `@tabler/icons` /
`@phosphor-icons/core` via `fs.readdir` of the probe directories;
hugeicons via its `dist/cjs` listing with the suffix stripped). One
wildcard, trailing position, matching a prefix — names in icon sets are
prefix-structured; a full glob engine is bundle code we do not need.

### Scan algorithm (M1/M2)

`packages/svg/src/vite/scan.ts` (new file, pure function, no Vite types):

```ts
export type ScanResult = {
  /** sorted unique collection:icon literals */
  names: string[];
  /** total literal hits including duplicates (for the log line) */
  references: number;
  /** template literals with a detected collection prefix — see warnings */
  dynamicHints: string[]; // rendered as "file:line" entries
};
export const scanCatalogNames = (root: string, options: ScanOptions): Promise<ScanResult>;
```

Details that make or break it, decided here:

- **Name shape is conservative.** Literal regex:
  `\b([a-z][a-z0-9-]{1,30}):([a-z0-9][a-z0-9._-]{0,96})\b` — the same
  alphabet `core/catalog.ts`'s `collectionPattern` / `iconPattern`
  enforce, so a scanned name and a registered name cannot diverge.
  Over-matches (CSS classes, doc strings) are resolved-away: probes miss
  `nonexistent-collection:x` and it costs nothing after resolution.
- **Extension allowlist** (files exactly): `ts, tsx, js, jsx, mjs,
astro, vue, svelte, html, mdx`. This covers all six adapters' surfaces
  including Angular `.html` templates and inline `template:` strings
  (containing `.ts`). Files outside the list are simply not read.
- **Ignore list is fixed and standard**: `node_modules`, `.git`,
  `dist`, `build`, `out`, `output`, `coverage`, `.astro`, `.svelte-kit`,
  `.next`, `.nuxt`, `.output`, `.vite`, `.turbo`, `.cache`,
  `__snapshots__` — plus user `exclude`. Depth-first walk of `include`
  dirs, skipping symlink loops (the `dirs` walk has the ancestor-set
  pattern to copy), files > `maxFileBytes` skipped and counted.
- **Cost ceiling.** One read per file, one pass, no AST. A 500-file app
  is a few MB read, tens of ms. The scan runs once per plugin instance
  in `transform` (cached in a closure `ScanResult`) and is invalidated
  by the watcher — it must NOT re-run per chunk/SSR evaluation.
- **Prop renaming is out of scope.** Every adapter spells the runtime
  prop `name`; the scan does not grow a configurable prop alias.

### Generated code and precedence (M2)

In `transform`, when scanning is on, resolve every scanned name and
append a second registration right after the `dirs` one:

```js
// existing appended call (dirs, svgo, precompiled) — unchanged
registerLocalSvgs({ "social/github": "<svg …>" }, { /* {override:false[, precompiled]} */ });
// new appended call (catalog, override:false)
registerLocalSvgs({ "lucide:house": "<svg …>" }, { override: false { + precompiled when on } });
```

Why this shape holds up:

- **Precedence.** Both calls are `override: false`, in order:
  user code → `dirs` → catalog names already present in the registry
  (from a prior manual registration or a dir file) are skipped. The
  documented ladder is preserved; auto-registration can only fill
  bottoms.
- **SSR + client.** Both attach to the same module evaluation; SSR dev
  and RSC/hermetic cases are already covered by the plugin's
  `ssr.noExternal` / `optimizeDeps.exclude` config hook.
- **Precompiled mode.** The precompiled map is built per call today and
  validated at registration (`local.ts` requires a matching markup
  entry, inline-only, re-sanitizes and rejects malformed trees with a
  build error). Catalog markup flows through the same builder — the
  runtime validation contract stays intact and no second code path
  exists to maintain.

Resolution misses during scan are classified, not swallowed (next
section). A fully-empty scan emits no second call (byte-identical
behavior to `catalog` off, avoiding a dangling `registerLocalSvgs({})`).

### Warnings and strictness (M3)

No heuristic errors by default. Three classifications, printed from the
plugin:

1. **Installed collection, unknown icon** (typo territory):
   ```
   [@mhaadi/svg] catalog names did not resolve (lucide installed:
   lucide:hous). Check spelling; the name will 404 and render the
   fallback state. (2 hits: src/ui/nav.tsx, src/settings.tsx)
   ```
   `catalog: { strict: true }` escalates to a thrown error at transform
   time, message mirroring the bundle convention:
   `No source found for these catalog icons: lucide:hous… install
instructions for @iconify-json/<c>` is NOT appended here (it is
   installed) — the message points at spelling and the files involved.
2. **Collection with no installed probe package:**
   ```
   [@mhaadi/svg] collection "lucide" is referenced (e.g. lucide:hover in
   src/ui/page.tsx) but no source package is installed. Add
   @iconify-json/lucide (or lucide-static) to devDependencies and rerun.
   ```
   Detecting "installed" without a per-collection network call: success
   of any probe file read for that collection under the configured roots
   (the walk `nodeModuleRoots` already produces).
3. **Dynamic usage** (scanned only, never resolved): include
   `dynamicHints` — a template literal containing `${` plus a detected
   collection prefix:
   ```
   [@mhaadi/svg] dynamic catalog name at src/icons.tsx:18 (template
   `lucide:${id}`). Name scanning cannot resolve it; a miss falls back to
   /assets/svg/{name}.svg. Register these at runtime with
   registerCatalogIcons.
   ```
   This warning only fires for collection prefixes seen elsewhere in the
   same scan — it costs one regex pass over a small candidate set and
   keeps noise low (docs pages that quote icons stay quiet).

All three collapse to one deduplicated log line per classification per
build, prefixed with the plugin name, never thrown (except strict #1).
There is no `report: false`. The log line is the feature's
self-description; `catalog: false` is the only off switch.

### HMR / watch (M4)

- `configureServer`: extend the existing refresh handler. A file event
  on a scanned (allowlisted extension, in-scope) path schedules one
  debounced rescan (~50 ms). If the resolved-and-classified outcome is
  byte-different (name set changed), do what the `dirs` scan does:
  `moduleGraph.invalidateAll()` + `ws full-reload`; otherwise do
  nothing. Watch cost stays per-directory (`addWatchFile` on scanned
  directories only).
- Rollup build-mode watch (`vite build --watch`) deliberately keeps
  today's behavior — no rebuild trigger for source usage changes.
  Document it; dev is the audience.

### Wildcard expansion (M5)

`core/catalog.ts` gains an internal `expandCatalogNames(names, roots)`
applied in `registerCatalogIcons` and `bundleCatalogIcons`:

- `col:*` → every name the installed source can serve for `col`
  (iconify: `icons` + `aliases` keys minus `hidden`; file packages:
  sorted `readdir` of the probe dirs; hugeicons: `dist/cjs` listing).
  This is a _list_ operation per collection, not per-icon.
- `col:prefix*` → filter of the above.
- Mixed lists (`["lucide:*", "tabler:settings"]`) expand and dedupe,
  sorted, deterministic.
- Bundle-size honesty: expansion logs to console when the collection
  count exceeds 250 names or the summed markup length exceeds 256 KB:
  `[@mhaadi/svg] registered 1497 lucide icons (~612 KB of markup)`.

Numbers are estimates, not research-grade: a lucide body is ~250-700 B
(~150 B gz); 100 icons ≈ 30-50 KB raw; whole-collection wildcards are
hundreds of KB and only worth it for exhaustive UIs or precompiled
build-script loops. The log line exists so nobody acquires 612 KB of
dead icons silently.

### Rejected approaches (why, so nobody reopens them)

- **On-demand dev resolution** (resolve any name in dev, scan in prod):
  rejected. It makes behavior depend on `import.meta.env.SSR` inside a
  shared module, reintroduces fs reads into a module that also ships in
  browser bundles, splits the fallback contract per environment, and
  solves dev typos worse than an HMR rescan that surfaces the terminal
  warning live. The plugin's dev path already re-runs the scan and
  reloads on new usages, so dev DX needs nothing here.
- **Prop-position parsing or transform rewrites** (unplugin-style
  rewriting of `name="…"` to inline markup or imports): rejected. It
  must be correct per framework (JSX, Vue templates, Svelte, Astro,
  Angular HTML), breaks on every dynamic form with an unrecoverable
  compile error, adds a transform-cache invalidation story, and buys
  nothing the registration approach does not already provide (inline
  markup, no fetch, no per-icon import). A prop-position regex is not
  component-agnostic either — `<meta name="description">` in the same
  file is an immediate false positive.
- **New runtime registered per resolution**: rejected (fs can't exist in
  browser bundles; the constraint is respected by inlining markup).
- **"Just import the icon package"** (unplugin-icons style): rejected —
  it is per-icon again, which is the problem the catalog exists to
  remove.

## Edge cases (make-or-break list)

1. **Docs/static sites using literal icon names in prose** (this repo's
   own `docs.astro` had it): over-matched names resolve against missing
   collections → classified #2, one info line per collection per build,
   not an error. `exclude` exists for sites that stay silent.
2. **Typo in an installed collection**: classified #1. In default mode
   the user sees a warning line instead of today's _nothing_; that is
   strictly better than 0.4.0's diff-the-return-array affordance being
   gone. `strict: true` makes CI fail — this is the setting the repo's
   fail-fast philosophy lives under.
3. **Dynamic names**: unresolved at scan, fallback chain intact (fetch
   → 404 → adapter `fallback`), plus the dynamic-usage warning pointing
   to `registerCatalogIcons` for this case.
4. **Names built by string concatenation** (`["lucide:", icon].join()`):
   rarest case; invisible to the scan no matter how it is spelled. Same
   fallback as today's miss. Accepted residual risk; not worth an
   esoteric detector.
5. **Same icon name in a `dirs` file** (`src/assets/svg/lucide/house.svg`
   == `lucide/house`, NOT `lucide:house`): no collision — path-derived
   names use `/`; catalog names use `:` — scanned catalog entries for
   `lucide:house` degrade to the fetch fallback and the dir win, as
   documented (today).
6. **Alien content matching the shape** (URLs and fragments): a URL
   like `https://example.com/?q=x` puts `//example.com` after the
   colon, and `/` is not in the name alphabet → not matched. CSS values
   (`cursor:pointer`) resolve against nothing and cost one miss. This
   is why the regex is names-alphabet-only.
7. **Monorepo / turbo caching**: the scan's effects live in the emitted
   bundle modules (the transform output), which turbo caches with the
   build. Nothing to wire; this is why registration-inline (not a
   runtime fs touch) matters for caching consumers.
8. **Symbolic links**: follow file symlinks, skip loops, exactly like
   the `dirs` walk (ancestor set + `realpath`).
9. **`catalog: false` / omitted option**: plugin byte-identical to
   today. Existing consumers are untouched without opt-in.

## Milestones

Ordered, not parallel. M1-M3 are the feature spine; each lands with its
tests; package bump (`@mhaadi/svg` 0.5.0, minor) and changelog land in
the same PR as M6 per repo rules.

**Landed**: M1-M6 executed on `advisor/007-catalog-auto-registration`
(commits `047a7b8` scan core, `97edce7` plugin wiring, classification,
warnings, and dev rescan, `b78ede8` wildcards, `d146134` docs,
`a6bb1ce` release bump). Deviations from the text below are recorded in
"Implementation notes" at the bottom of this file.

### M1 — scan core (`feat(svg)`, branch `advisor/007-catalog-auto-registration`)

New `packages/svg/src/vite/scan.ts` with `scanCatalogNames` + tests
(`vite/scan.test.ts`, temp fixtures like `plugin.test.ts` does): shape
matching, ignore lists, extension filter, `maxFileBytes`, symlink-loop
skip, dedupe+sort determinism.

### M2 — plugin wiring (`feat(svg)`)

`vite/plugin.ts`: `catalog` option shape validation at construction
(mirror `dirs` errors: `"catalog.include entries must be relative paths
without globs or '..'."`), scan + resolve in `transform` (cached scan
result per instance), appended second registration call, svgo /
precompiled inheritance, one-line count log
(`auto-registered 12 catalog icons from 9 source files (lucide×10,
tabler×2)`). Zero catalog entries → no second call. Tests in
`vite/plugin.test.ts`: appended name present, precedence vs `dirs`
entry, precompiled variant round-trips, `catalog: false` unchanged.

### M3 — classification and strictness (`feat(svg)`)

The three warning classifiers + `strict` escalation, with exact message
text above, tests asserting each class via temp fixtures (installed /
not-installed probes are fixture-root simple). Capture plugin warnings
in tests without crashing vitest console handling.

### M4 — dev HMR redraw (`feat(svg)`)

Debounced rescan on source-file events, reload only on outcome change,
watch-per-directory, tests where feasible (the watcher surface is thin;
document what is manually verified instead of faking coverage).

### M5 — wildcards (`feat(svg)`)

`expandCatalogNames` + trailing-`*` semantics + size log, `readdir`
probes per collection type; `core/catalog.test.ts` and
`core/bundle.test.ts` additions (fixture root has tiny
iconify-json/lucide-static stand-ins already used by both suites).

### M6 — docs + release (`feat(svg)` finalize)

- README: option documented in the Vite plugin table + catalog section;
  wildcards; strict mode; React Native unchanged paragraph.
- `apps/web/src/pages/docs.astro`: new subsection under "Icon catalog"
  ("Automatic registration") and a widening sentence under the `svgo`
  card; cross-link from "Local discovery".
- `packages/svg/package.json` → 0.5.0 minor + `CHANGELOG.md` entry
  (consumer tone). GitHub release body mirrors it at tag time — this
  release **requires** the tag per repo release rules; no `svg_flutter`
  or `@better-svg/*` impact (internal packages untouched).

## Verification

- [ ] M1: `pnpm run test` green with `vite/scan.test.ts` (≥ 10 cases:
      shape, ignores, extensions, maxBytes, symlink loops, dedupe+sort).
- [ ] M2: `vite/plugin.test.ts` asserts the scanned name lands in the
      appended call, precedence tests pass, `catalog:false` output identical
      to before (characterization: run transform with and without the
      feature flag, diff strings).
- [ ] M3: each classification asserts its exact message; `strict: true`
      throws with bundle-style text on typo case and does NOT throw on
      not-installed case.
- [ ] M5: `"lucide:*"` fixture expansion = manually counted fixture
      set; size log fires above the thresholds; explicit names still fail
      the bundle script on miss.
- [ ] `pnpm run check-types`, `pnpm run lint`, `pnpm run test`,
      `pnpm run build` all green (repo standard, from root).
- [ ] Scan latency note: measure `scanCatalogNames` on the repo's own
      `apps/web/src` + `packages` to sanity-check; target ≤ 100 ms here, ≤
      200 ms on a 500-file distraction set. Report the number; don't ship
      silently slow.
- [ ] `plans/README.md` status row updated for this plan by whoever
      executes it (the planner does not track their own row).

## Implementation notes (executed 2026-10-21)

Recorded decision deltas, so nobody diffs the plan against the code and
suspects drift:

- **`searchPaths` added to `CatalogScanOptions`.** Not in the API sketch
  above. Reasons: tests need a fixture root instead of `process.cwd()`,
  and monorepos keep icon sources outside the project root. Without it,
  resolution defaults to the project root, matching how
  `resolveIconSource` already treats `catalog.searchPaths`.
- **Scan is policy-free, the plugin classifies.** `ScanResult.dynamic`
  returns unfiltered template-literal hints (`file:line` + snippet +
  collection). The plugin keeps a hint only when the collection appears
  in static names or is installed, so prose-only collections stay quiet.
  The plan pinned the filter inside the scan; moving it out kept the
  scan unit-testable and the filtering visible in classification tests.
- **Extensions are a fixed list, not an option.** `ScanOptions.extensions`
  exists for tests; the plugin option surface has no knob for it. Broaden
  later only with evidence.
- **`exclude` matches paths**, directories or files, resolved against the
  project root and prefix-matched. The plan's wording implied directories.
- **hugeicons wildcard enumeration** reads `@hugeicons/core-free-icons`
  `dist/cjs`, strips the `Icon.js` suffix, round-trips PascalCase to
  kebab (digit runs keep their dash: `ArrowLeft01` → `arrow-left-01`,
  `AArrowDown` → `a-arrow-down`, `1stBracket` → `1st-bracket`), then keeps
  only names that resolve through the package's own probe. Non-kebab-round-trip
  module names are dropped, not guessed.
- **Latency, measured** (`scanCatalogNames`, cold plugin bundle, three
  runs): `apps/web` 21-29 ms for 13 files / 92 names; synthetic 500-file
  set 49-73 ms for 501 files; repo root (node_modules and caches ignored,
  `.turbo`+`plans` excluded) 14 ms for 71 files. All under the ≤ 100 ms /
  ≤ 200 ms targets. One caveat worth repeating: `apps/web` reports 92
  names because docs pages quote icon names in prose — a docs site that
  enables the scan needs `exclude` (or a narrow `include`), which is the
  hedge this design already ships, not a new failure mode.
- **Count line** prints once per outcome (deduped per plugin instance),
  pluralized, e.g. `auto-registered 1 catalog icon from 1 source file
(testy: 1)`.
- **Dev rescan** debounces 50 ms, compares the outcome signature
  (resolved names + typo names), and reloads only when it changes. Watch
  cost is per-directory via `addWatchFile` on scanned directories, per
  plan; the per-file `addWatchFile` calls stay on the SVG `dirs` side
  where they already were.

## Out of scope, explicitly

- Bundlers without a Vite-plugin equivalent (webpack / turbopack RSC
  `next build`): users there keep the manual `registerCatalogIcons` +
  `bundleCatalogIcons` flow. A shared unplugin core is attractive after
  the Vite version proves the heuristics — not before.
- Runtime resolver hook ("register a custom resolver function"): a
  separate, orthogonal feature request.
- Scanning **inside** `lang="ts"` blocks of a component file — already
  covered by full-text scanning; nothing to do.
- md-format scanning beyond `.mdx` (plain `.md` files are prose).
- Watching node_modules for icon-package changes — probes are read
  once per build and never watched; icon-package updates are install
  and uninstall events, and a dev-server restart picks them up.
  Documented behavior, not wired.

## Open questions for the maintainer

1. **Default `include`.** Whole project root (`["."]`, standard ignores)
   is the zero-config answer and matches this plan — confirm it is not
   too broad for, e.g., intranet repos with huge static CMS dirs (the
   `exclude` + `maxFileBytes` hedges are already in the API).
2. **Severity ladder when miss-avoidance is possible.** A stricter
   default (`strict: true` out of the box) catches typos harder but
   risks failing builds on prose, READMEs, or generated docs that quote
   icon names. Argued for warn-by-default: anyone who wants CI teeth
   sets `strict` in one line.

## STOP conditions

Stop and report — do not improvise — if any of these turn out false:

- The transform target of `plugin.ts` is no longer `core/local.(js|ts)`
  of `@mhaadi/svg` itself (regex or module layout changed), or the
  appended-registration shape moved into a different module.
- `resolveIconSource` became async / gained a different signature (the
  plan's registration is currently synchronous-in-transform).
- `registerLocalSvgs` no longer skips already-present names under
  `override: false` (the precedence contract changed), or precompiled
  catalog entries break the "markup entry must exist" validation pair.
- Scan+resolve on a realistic app (repo reference set) exceeds 1 s —
  report numbers instead of silently shipping a slow heuristic.
- Escalation experiment: when `strict: true` is exercised, a name that
  iconify docs list as public resolves nothing — that is a probe bug,
  not a user error; report with the collection + name.
