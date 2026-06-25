# Plan 009: Cache the parsed SVG, not the markup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9af3c16..HEAD -- packages/svg/src/svg.tsx packages/svg/src/native.tsx packages/svg/src/vue/SVG.ts packages/svg/src/svelte/runtime.ts packages/svg/src/svelte/SVG.svelte packages/svg/src/core/sanitize.ts packages/svg/src/core/index.ts packages/svg/src/core/ast.ts packages/svg/src/svg.test.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (foundation for any future cache shape work)
- **Category**: perf, correctness
- **Planned at**: commit `9af3c16`, 2026-06-25

## Why this matters

Every adapter (`svg.tsx`, `native.tsx`, `vue/SVG.ts`, `svelte/runtime.ts`)
caches only the **raw markup string** and re-parses it with `DOMParser` on
every effect re-run. The cache prevents a network round-trip but does not
prevent the parse — which is the dominant per-render cost when many `<SVG>`
instances are mounted in a list. A parent re-render that passes a new
`fetchOptions` object identity (the common case in real apps) tears the
effect down, re-fetches (or hits the cache), and **always re-parses**.
`svg.tsx:80-92` calls `parseInlineSvg` on the cache-hit path; same in
`native.tsx:306-330`, `vue/SVG.ts:103-121`, `svelte/runtime.ts:76-83`. The
Svelte adapter additionally has a callback-tracking bug
(`SVG.svelte:30-41`): `$$props.onSvgLoad`/`onSvgError` are read inside the
`$effect` body before the `untrack` wraps `controller.load`, so inline
callbacks re-trigger the effect and the fetch+parse fires again. Vue's watch
deps exclude callbacks (`vue/SVG.ts:161-167`); React/Native use the latest-ref
pattern (plan 006). This plan: (a) caches the **parsed** `ParsedSvg` keyed on
`(source, sanitize)` so a cache hit skips `DOMParser` entirely, and (b) fixes
the Svelte callback-tracking bug by moving the prop reads inside `untrack`.

## Current state

- `packages/svg/src/core/sanitize.ts:11-56` — `parseInlineSvg(markup, sanitize)`
  allocates a new `DOMParser`, calls `parseFromString`, walks the tree, and
  returns `{ attrs, className, style, innerHTML }`. This is what every
  adapter calls.
- `packages/svg/src/core/index.ts:1-17` — re-exports `parseInlineSvg`,
  `resolveMarkup`, `resolveSource`, etc. No "parsed cache" abstraction exists.
- `packages/svg/src/svg.tsx:16` — `const svgCache = new Map<string, string>()`,
  module-level. Key = source URL. Value = raw markup.
- `packages/svg/src/svg.tsx:80-92` — `runWithCached(markup)` calls
  `parseInlineSvg(markup, sanitize)` on every effect run, even when
  `svgCache.has(resolvedSource)` is true.
- `packages/svg/src/svg.tsx:94-108` — cache-hit branch reads markup, runs
  it through `runWithCached` (which re-parses), then short-circuits without
  the network.
- `packages/svg/src/native.tsx:249,306-330` — same shape: `Map<string, string>`
  + `parseAndSanitize` on every read.
- `packages/svg/src/vue/SVG.ts:31,103-121,135` — same shape: `Map<string,
  string>` + `parseInlineSvg` on every read.
- `packages/svg/src/svelte/runtime.ts:30,76-83` — same shape: `Map<string,
  string>` + `parseSvgMarkup` (which calls `parseInlineSvg`) on every read.
- `packages/svg/src/svelte/SVG.svelte:30-41` — `$effect` body reads
  `$$props.src`, `$$props.name`, `$$props.fetchOptions`, `$$props.cache`,
  `$$props.sanitize`, `$$props.onSvgLoad`, `$$props.onSvgError` synchronously
  to build the `props` object, then wraps `controller.load(props, ...)` in
  `untrack`. Reads of `$$props.onSvgLoad`/`onSvgError` are tracked because
  they happen before `untrack` is entered. Svelte's effect tracking is
  read-based: any read of a `$state`/`$derived`/prop inside the effect
  callback re-runs the effect when that value changes. Inline callbacks
  (`onSvgLoad={() => …}`) have a new identity on every parent render, so
  the effect re-fires.
- `packages/svg/src/svg.test.tsx` — current tests cover cache-hit-prevents-
  refetch and effect-stability-for-inline-callbacks. Pattern: vitest +
  `@testing-library/react` + `vi.stubGlobal("fetch", ...)`. Extend this file
  for the new tests.

Repo conventions:
- Components live in `packages/svg/src/<adapter>.{ts,tsx}` and re-export
  `SVG` from there. Vue/Svelte are not under test; the Svelte fix is a one-line
  move; don't add a Svelte test runner in this plan.
- The cache is a module-level `Map`. All adapters share `Map<string, string>`
  in source, but each has its own declaration — they are *not* the same
  module instance. Don't unify them in this plan (out of scope); the parsed
  cache lives in core so future unification is one import change.
- `noUnusedLocals` is on (`@better-svg/config/tsconfig.base.json`).
- Style: no comments in source (per `AGENTS.md`).
- React/React Native use `React.useRef`/`React.useEffect`. Match that style.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `pnpm install`                   | exit 0              |
| Typecheck | `pnpm check-types`               | exit 0              |
| Test      | `pnpm -F @mhaadi/svg test`       | all pass (67 + new) |
| Lint      | `pnpm lint`                      | no new errors       |
| Build     | `pnpm -F @mhaadi/svg build`      | exit 0; `dist/` updates |

## Scope

**In scope** (the only files you should modify or create):
- `packages/svg/src/core/cache.ts` — **create.** Module-level parsed-SVG cache
  with the shape described in Step 1.
- `packages/svg/src/core/index.ts` — re-export the new cache helpers.
- `packages/svg/src/core/cache.test.ts` — **create.** Unit tests for the new
  cache (key shape, sanitize-as-part-of-key, `cacheParsedSvg`/`getCachedParsedSvg`
  symmetry, `clearSvgCache` works).
- `packages/svg/src/svg.tsx` — switch `svgCache` to use the new core cache.
  No behavior change beyond skipping the parse on cache hit.
- `packages/svg/src/native.tsx` — same.
- `packages/svg/src/vue/SVG.ts` — same.
- `packages/svg/src/svelte/runtime.ts` — same.
- `packages/svg/src/svelte/SVG.svelte` — move prop reads inside `untrack` so
  the `$effect` only tracks `src`/`name`/`fetchOptions`/`cache`/`sanitize`.
  Callbacks become untracked.
- `packages/svg/src/svg.test.tsx` — **extend.** Add a test that a second
  mount of the same URL with inline `fetchOptions` does not re-parse (assert
  `parseInlineSvg` spy or measure the cache hit on the second render).

**Out of scope** (do NOT touch):
- `packages/svg/src/core/sanitize.ts` — `parseInlineSvg` keeps its current
  shape. The cache is the only change.
- `packages/svg/src/core/ast.ts`, `url.ts`, `resolve.ts`, `local.ts` — no
  changes.
- `packages/svg/src/vite.ts` — no changes.
- `packages/svg/dist/**` — gitignored; built by `pnpm build`. Do not commit.
- `apps/web/**` — no changes.
- `packages/flutter/**` — no changes; the Flutter adapter has its own cache.
- LRU/size cap on the cache — explicitly deferred. Add a comment-free
  `// cache is bounded only by application lifetime; see plan 010 backlog`?
  **No** — the repo convention is "no comments in source." Leave it. Note in
  the plan's Maintenance notes.
- Unifying the four adapter-local caches into one shared module instance —
  deferred. The new core cache is shared via import, but each adapter still
  imports the same `Map` (Step 1). Confirm: each adapter must `import { ... }
  from "./core"` (or `"../core"` for the svelte runtime) and use the same
  named export. The current adapters each declare their own
  `const svgCache = new Map<string, string>()`; this plan replaces that with
  the shared core cache. They become one cache for the first time — this is
  a side effect of the change and is desirable, but not called out in
  individual adapter change descriptions below.
- Publishing 0.2.3 — out of scope. Plan 010 handles release.

## Git workflow

- Branch: `advisor/009-cache-parsed-svg`
- Commit style: conventional commits, `fix(svg): …` for the cache change,
  `fix(svelte): …` for the Svelte effect tracking, `test(svg): …` for the
  new tests. Match the repo style (see `git log --oneline -15`).
- Suggested commits (in order):
  1. `feat(svg): add shared parsed-SVG cache to core`
  2. `fix(svg): use parsed cache in React adapter`
  3. `fix(svg): use parsed cache in React Native adapter`
  4. `fix(svg): use parsed cache in Vue adapter`
  5. `fix(svg): use parsed cache in Svelte runtime`
  6. `fix(svelte): stop tracking onSvgLoad/onSvgError in $effect`
  7. `test(svg): cover parsed-cache hit and skip-parse on re-mount`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add the parsed-cache to core

Create `packages/svg/src/core/cache.ts`:

```ts
import { parseInlineSvg, type ParsedInlineSvg } from "./sanitize";

type CacheKey = string;

const cache = new Map<CacheKey, ParsedInlineSvg>();

const keyFor = (source: string, sanitize: boolean): CacheKey =>
  `${sanitize ? "s:" : "u:"}${source}`;

export const getCachedParsedSvg = (
  source: string,
  sanitize: boolean,
): ParsedInlineSvg | null => {
  const entry = cache.get(keyFor(source, sanitize));
  return entry ?? null;
};

export const cacheParsedSvg = (
  source: string,
  sanitize: boolean,
  parsed: ParsedInlineSvg,
): void => {
  cache.set(keyFor(source, sanitize), parsed);
};

export const clearSvgCache = (): void => {
  cache.clear();
};

export const __svgCacheSize = (): number => cache.size;

export const ensureParsedSvg = (
  source: string,
  markup: string,
  sanitize: boolean,
): ParsedInlineSvg | null => {
  const cached = getCachedParsedSvg(source, sanitize);
  if (cached) return cached;
  const parsed = parseInlineSvg(markup, sanitize);
  if (parsed) cacheParsedSvg(source, sanitize, parsed);
  return parsed;
};
```

Why this shape:
- Keyed on `(source, sanitize)`. Sanitize is part of the key because
  `parseInlineSvg` strips dangerous nodes when `sanitize=true`; caching
  the sanitized result under a key that ignores `sanitize` would return
  the sanitized version when the caller asked for `sanitize=false`.
  Two-key prefix (`s:`/`u:`) is the simplest way; same string length so
  no map-rebalance hot spot.
- `ensureParsedSvg` is the only function adapters need: pass the source
  and the markup, get back the parsed result, cached on second call. This
  is the parse-skip entry point.
- `clearSvgCache` is exported so tests can reset state. **Do not** export
  it from the package barrel (`core/index.ts`) — keep it internal to core
  for tests; if a consumer later asks for a clear API, add it then.
- `__svgCacheSize` is for tests/diagnostics. Prefixed `__` to signal
  "not a stable public API."

Update `packages/svg/src/core/index.ts` to add the `ensureParsedSvg` export
under the existing pattern. **Do not** export `clearSvgCache` or
`__svgCacheSize` from the barrel:

```ts
export { ensureParsedSvg } from "./cache";
```

**Verify**:
- `pnpm check-types` → exit 0.
- `pnpm -F @mhaadi/svg test` → 67 pass (no test changes yet, file is empty).

### Step 2: Unit-test the core cache

Create `packages/svg/src/core/cache.test.ts`. Pattern: model after
`packages/svg/src/core/sanitize.test.ts` (no React, no DOM mocking needed
beyond what happy-dom already provides for `parseInlineSvg`).

Required cases:
- `getCachedParsedSvg` returns `null` for an unknown source.
- `cacheParsedSvg` then `getCachedParsedSvg` returns the same object.
- `ensureParsedSvg` parses and caches on first call; second call with the
  same `(source, sanitize)` returns a structurally equal object **without**
  calling `parseInlineSvg` again. Use `vi.spyOn(sanitize, "parseInlineSvg")`
  from `vitest` to assert call count.
- `ensureParsedSvg` with the same source but different `sanitize` returns
  distinct entries. Assert both keys are populated by spying on `parseInlineSvg`
  and verifying it was called twice.
- `clearSvgCache` empties the map.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as sanitize from "./sanitize";
import {
  cacheParsedSvg,
  clearSvgCache,
  ensureParsedSvg,
  getCachedParsedSvg,
} from "./cache";

const MARKUP = '<svg viewBox="0 0 24 24"><rect width="10" height="10"/></svg>';

beforeEach(() => {
  clearSvgCache();
  vi.restoreAllMocks();
});

describe("ensureParsedSvg", () => {
  it("returns null for malformed markup", () => {
    expect(ensureParsedSvg("s1", "not svg", true)).toBeNull();
  });

  it("parses and caches on first call", () => {
    const spy = vi.spyOn(sanitize, "parseInlineSvg");
    const first = ensureParsedSvg("s2", MARKUP, true);
    expect(first).not.toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("returns the cached parsed result on the second call (no re-parse)", () => {
    const spy = vi.spyOn(sanitize, "parseInlineSvg");
    const first = ensureParsedSvg("s3", MARKUP, true);
    const second = ensureParsedSvg("s3", MARKUP, true);
    expect(second).toEqual(first);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("treats sanitize as part of the key", () => {
    const spy = vi.spyOn(sanitize, "parseInlineSvg");
    ensureParsedSvg("s4", MARKUP, true);
    ensureParsedSvg("s4", MARKUP, false);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("round-trips a sanitized result through getCachedParsedSvg", () => {
    const parsed = ensureParsedSvg("s5", MARKUP, true);
    expect(parsed).not.toBeNull();
    expect(getCachedParsedSvg("s5", true)).toEqual(parsed);
    expect(getCachedParsedSvg("s5", false)).toBeNull();
  });

  it("clearSvgCache empties the cache", () => {
    ensureParsedSvg("s6", MARKUP, true);
    clearSvgCache();
    expect(getCachedParsedSvg("s6", true)).toBeNull();
  });
});
```

**Verify**: `pnpm -F @mhaadi/svg test src/core/cache.test.ts` → all 6 tests pass.

### Step 3: Switch the React adapter to the parsed cache

In `packages/svg/src/svg.tsx`:

1. Add `ensureParsedSvg` to the import from `"./core"`:

```ts
import { ensureParsedSvg, parseInlineSvg, resolveMarkup, resolveSource, type SvgNameInput } from "./core";
```

2. **Delete** the module-level `const svgCache = new Map<string, string>();`
   at line 16. (Replaced by the shared core cache.)

3. Replace the cache-hit branch (lines 94-108) to use `ensureParsedSvg`:

```ts
if (cache) {
  const cached = getCachedParsedSvg(resolvedSource, sanitize);
  if (cached) {
    setContent({
      attrs: cached.attrs,
      className: cached.className,
      style: cached.style as React.CSSProperties | undefined,
      innerHTML: cached.innerHTML,
    });
    setIsLoading(false);
    onLoadRef.current?.(getCachedMarkup(resolvedSource) ?? "");
    return () => {
      active = false;
      controller.abort();
    };
  }
}
```

Wait — the cache holds the parsed `ParsedInlineSvg`, not the markup. But
`onLoadRef.current?.(markup)` is called with the raw markup string (so the
caller can use it, e.g. for SSR transfer). The current code calls
`onLoadRef.current?.(markup)` in `runWithCached` with the markup argument
it was given; in the fetch path it calls `onLoadRef.current?.(markup)` with
the freshly-fetched markup.

**Decision: keep the markup-only cache for `onSvgLoad` callbacks, AND add
the parsed cache to skip the parse.** Two-tier: the existing `Map<string,
string>` for markup stays, and the new parsed cache is added. Reasoning:
- `onSvgLoad` is documented to receive the raw markup string. Callers
  (e.g. SSR, telemetry) may pass it through. If we drop the markup cache
  and re-fetch to recover the markup, that's a regression for the
  cache-on callback.
- The parsed cache lives in core. The markup cache lives in the adapter.
  Both keyed on source. They're independent and both can be kept.

So the cleaner shape is:

- **Keep the adapter's `Map<string, string>` for the markup** (the
  callback-receives-markup contract is part of the public API).
- **Add `ensureParsedSvg` so the parse is skipped on cache hit** (the
  perf win).

That means: do NOT delete the markup cache. The change is just to wrap
`parseInlineSvg(markup, sanitize)` with `ensureParsedSvg(resolvedSource, markup, sanitize)`
inside `runWithCached`.

Replace `runWithCached` (lines 80-92):

```ts
const runWithCached = (markup: string) => {
  const inline = ensureParsedSvg(resolvedSource, markup, sanitize);
  if (!inline) throw new Error("SVG markup is invalid or unavailable in this environment.");
  const parsed: ParsedSvg = {
    attrs: inline.attrs,
    className: inline.className,
    style: inline.style as React.CSSProperties | undefined,
    innerHTML: inline.innerHTML,
  };
  setContent(parsed);
  setIsLoading(false);
  onLoadRef.current?.(markup);
};
```

Note: `runWithCached` now passes `markup` (still the raw string) to
`onLoadRef.current`, preserving the contract. The parse is skipped on
the second and subsequent calls because `ensureParsedSvg` hits the core
cache.

Imports: keep `parseInlineSvg` removed (no longer used here).

**Verify**:
- `pnpm check-types` → exit 0.
- `pnpm -F @mhaadi/svg test` → 67 + 6 = 73 tests pass.
- `grep -n "parseInlineSvg" packages/svg/src/svg.tsx` → no matches.

### Step 4: Apply the same change to `native.tsx`

In `packages/svg/src/native.tsx`:

1. Add `ensureParsedSvg` to the import from `"./core"`:

```ts
import { ensureParsedSvg, parseAndSanitize, resolveMarkup, resolveSource, type SvgAttribute, type SvgNameInput, type SvgNode } from "./core";
```

2. In `finish` (lines 306-314), swap `parseAndSanitize(markup, sanitize)` for
   the same keying as the React adapter. But: `native.tsx` uses
   `parseAndSanitize` (returns `SvgNode | null`) not `parseInlineSvg`
   (returns `ParsedInlineSvg | null`). The core cache stores
   `ParsedInlineSvg`. So the React/Native adapters don't share a parsed
   cache directly.

Two options:
- (a) Change `native.tsx` to use `parseInlineSvg` and adapt the
  `SvgNode`-tree output it currently uses for `react-native-svg`.
- (b) Add a second core cache keyed on `parseAndSanitize`'s output.

(a) is a much bigger refactor (the whole `renderSvgNode` tree in
`native.tsx:212-228` is built on `SvgNode`, not `ParsedInlineSvg`). It
would also change the React Native render path's behavior, which is out
of scope.

(b) is the smaller, lower-risk change: add a separate `ensureParsedNode`
helper that wraps `parseAndSanitize`. Two caches, same keying convention.

For React Native the `parseAndSanitize` is on the cache-hit path
(`native.tsx:316-330`). The same DOMParser cost applies. Add the helper:

In `packages/svg/src/core/cache.ts`, **append** (don't change existing exports):

```ts
import { parseAndSanitize, type SvgNode } from "./ast";

const nodeCache = new Map<CacheKey, SvgNode>();

export const ensureParsedNode = (
  source: string,
  markup: string,
  sanitize: boolean,
): SvgNode | null => {
  const entry = nodeCache.get(keyFor(source, sanitize));
  if (entry) return entry;
  const node = parseAndSanitize(markup, sanitize);
  if (node) nodeCache.set(keyFor(source, sanitize), node);
  return node;
};

export const __svgNodeCacheSize = (): number => nodeCache.size;
```

Update `packages/svg/src/core/index.ts` to add the export:

```ts
export { ensureParsedNode } from "./cache";
```

In `packages/svg/src/native.tsx` `finish`:

```ts
const finish = (markup: string) => {
  const parsed = ensureParsedNode(resolvedSource, markup, sanitize);
  if (!parsed) {
    throw new Error("SVG markup is invalid.");
  }
  setContent(parsed);
  setIsLoading(false);
  onLoadRef.current?.(markup);
};
```

**Verify**:
- `pnpm check-types` → exit 0.
- `pnpm -F @mhaadi/svg test` → 73 pass.
- `grep -n "parseAndSanitize" packages/svg/src/native.tsx` → no matches
  (the import is removed too).

### Step 5: Apply the same change to `vue/SVG.ts`

`vue/SVG.ts` calls `parseInlineSvg` directly (lines 105, 135) and wraps
it in a per-instance `styleText` conversion. Switch to `ensureParsedSvg`:

```ts
import { ensureParsedSvg, resolveMarkup, resolveSource, toCamelCase, type SvgNameInput } from "../core";
```

Replace both call sites:

- Line 105 (cache-hit branch): `const inline = ensureParsedSvg(resolved, cached, props.sanitize ?? true);`
- Line 135 (fetch branch): `const inline = ensureParsedSvg(resolved, markup, props.sanitize ?? true);`

The `runWithCached`/`fetch` flow otherwise stays the same.

**Verify**:
- `pnpm check-types` → exit 0.
- `pnpm -F @mhaadi/svg test` → 73 pass.

### Step 6: Apply the same change to `svelte/runtime.ts`

`runtime.ts:39-51` defines `parseSvgMarkup` which wraps `parseInlineSvg` and
the `styleText` conversion. Used at lines 78 and 99. Switch to `ensureParsedSvg`:

```ts
import { ensureParsedSvg, resolveMarkup, resolveSource, type SvgNameInput } from "../core";
```

Replace `parseSvgMarkup` body:

```ts
export const parseSvgMarkup = (source: string, markup: string, sanitize: boolean): ParsedSvg | null => {
  const inline = ensureParsedSvg(source, markup, sanitize);
  if (!inline) return null;
  const styleText = inline.style
    ? Object.entries(inline.style).map(([k, v]) => `${k}:${v}`).join(";")
    : undefined;
  return {
    attrs: inline.attrs,
    className: inline.className,
    style: styleText,
    innerHTML: inline.innerHTML,
  };
};
```

The signature changes from `(markup, sanitize)` to `(source, markup, sanitize)`.
The two call sites become:

- Line 78: `const parsed = parseSvgMarkup(resolved, cached, props.sanitize ?? true);`
- Line 99: `const parsed = parseSvgMarkup(resolved, markup, props.sanitize ?? true);`

**Verify**:
- `pnpm check-types` → exit 0 (this may surface a call-site error in
  `SVG.svelte` if it uses the old shape — fix there as part of Step 7).
- `pnpm -F @mhaadi/svg test` → 73 pass.

### Step 7: Fix the Svelte `$effect` callback-tracking bug

In `packages/svg/src/svelte/SVG.svelte:30-41`:

```svelte
$effect(() => {
  const props: SvelteSvgProps = {
    src,
    name,
    fetchOptions,
    cache,
    sanitize,
    onSvgLoad,
    onSvgError,
  };
  untrack(() => controller.load(props, (next) => (state = next)));
});
```

`onSvgLoad` and `onSvgError` are read **synchronously** to build the
object literal, so Svelte's effect tracking sees those reads and re-runs
the effect when they change. `untrack` only wraps the `controller.load`
call, not the object construction.

Move the callback reads inside the `untrack` block. The `src`/`name`/
`fetchOptions`/`cache`/`sanitize` reads must stay outside `untrack` so
the effect re-fires on those. Use a separate `untrack` block for the
callbacks:

```svelte
$effect(() => {
  const stable: SvelteSvgProps = {
    src,
    name,
    fetchOptions,
    cache,
    sanitize,
    onSvgLoad: untrack(() => onSvgLoad),
    onSvgError: untrack(() => onSvgError),
  };
  controller.load(stable, (next) => (state = next));
});
```

This reads `src`/`name`/`fetchOptions`/`cache`/`sanitize` synchronously
(tracked) and reads `onSvgLoad`/`onSvgError` only inside `untrack`
(untracked). Inline callbacks no longer re-trigger the effect.

Svelte 5's `untrack` takes a thunk and returns the thunk's return value.
The `props` object passed to `controller.load` is built once per effect
fire, with the latest `untrack`-ed callback identities. This is the
svelte-5 equivalent of React's latest-ref pattern (plan 006).

Also: `controller.load` in `runtime.ts:63` reads
`props.onSvgLoad?.(cached)` and `props.onSvgLoad?.(markup)` —
those reads are inside `runtime.ts` and happen *after* the effect
finishes, so they are not tracked. Good.

**Verify**:
- `pnpm check-types` → exit 0.
- `pnpm -F @mhaadi/svg test` → 73 pass (Svelte has no test runner, so
  this is the typecheck-level check).

### Step 8: Add a React regression test for parse-skip

Extend `packages/svg/src/svg.test.tsx`. Add a test that the parse path is
not re-run on a second mount of the same URL. The cleanest assertion is
to spy on `parseInlineSvg` from the core and verify it was called once
across two mounts:

```tsx
import * as core from "./core";

it("does not re-parse cached SVG on second mount of the same URL", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(SVG_MARKUP, { status: 200, headers: { "Content-Type": "image/svg+xml" } }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const parseSpy = vi.spyOn(core, "parseInlineSvg");
  const url = "https://example.com/parse-skip.svg";

  const { unmount } = render(<SVG src={url} />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(parseSpy).toHaveBeenCalledTimes(1));
  unmount();

  render(<SVG src={url} />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  // The parse is skipped on the second mount because the core cache returns
  // the previously-parsed result. parseInlineSvg stays at 1.
  await new Promise((r) => setTimeout(r, 10));
  expect(parseSpy).toHaveBeenCalledTimes(1);

  parseSpy.mockRestore();
});
```

Note: `ensureParsedSvg` internally calls `parseInlineSvg` only on a miss.
After Step 1, the core cache holds the parsed result. The first mount
populates the cache; the second mount reads from it. The spy on
`parseInlineSvg` confirms it ran exactly once across both mounts.

The `clearSvgCache` test helper from Step 2 lets the test be hermetic if
you `clearSvgCache` in a `beforeEach` — but `vi.spyOn` on a re-imported
function across `vi.restoreAllMocks()` and the test file's module
isolation should already be enough. If the test is flaky, add
`clearSvgCache` to a `beforeEach` (import from `core`).

**Verify**: `pnpm -F @mhaadi/svg test src/svg.test.tsx` → 4 tests pass
(2 from plan 003 + 1 effect-stability from plan 006 + 1 new).

### Step 9: Full verification

- `pnpm check-types` → exit 0.
- `pnpm -F @mhaadi/svg test` → 67 (existing) + 6 (cache unit) + 1 (React
  parse-skip) = 74 pass, 1 skipped.
- `pnpm lint` → no new errors.
- `pnpm -F @mhaadi/svg build` → exit 0; `dist/` reflects the source.
- `git status` shows only the in-scope files modified.

## Test plan

- `packages/svg/src/core/cache.test.ts` — 6 unit tests covering keying,
  parse-skip, sanitize-as-part-of-key, and clear. Pattern: model after
  `packages/svg/src/core/sanitize.test.ts`.
- `packages/svg/src/svg.test.tsx` — 1 new test: parse-skip on second
  mount. Pattern: model after the existing `svg.test.tsx` tests in the
  same file (plan 003 + plan 006).
- Vue and Svelte have no test runners in this repo; their typecheck
  passes are the only verification. That's consistent with the rest of
  the repo (the Svelte/Vue adapters have no adapter-level tests today;
  the core tests cover `parseInlineSvg` and `parseAndSanitize`).
- React Native has no test runner (`react-native-svg` import); same
  constraint as the existing code. The change is mechanical — same
  `ensureParsedSvg` shape as the React adapter, just on a different
  output type.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check-types` exits 0
- [ ] `pnpm -F @mhaadi/svg test` exits 0; new `cache.test.ts` has 6 passing tests; `svg.test.tsx` has 4 passing tests (one new)
- [ ] `grep -n "parseInlineSvg" packages/svg/src/svg.tsx packages/svg/src/vue/SVG.ts packages/svg/src/svelte/runtime.ts` returns no matches (parseInlineSvg only invoked from core/cache.ts)
- [ ] `grep -n "parseAndSanitize" packages/svg/src/native.tsx` returns no matches
- [ ] `grep -n "onSvgLoad: untrack\|onSvgError: untrack" packages/svg/src/svelte/SVG.svelte` matches (the Svelte effect fix)
- [ ] `pnpm lint` introduces no new errors
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 009 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The current code excerpts in this plan don't match what's on disk
  (drift check above covers this — if any diff shows edits, re-read
  the live code and adapt the change; don't proceed with stale
  assumptions).
- `parseInlineSvg` is used elsewhere in `svg.tsx`/`vue/SVG.ts`/
  `runtime.ts` than the line numbers cited — the executor may have
  missed a call site. Grep to confirm before editing.
- `untrack` from `svelte` is not importable in the Svelte version
  pinned (`svelte ^5.56.3`). If unavailable, STOP — the Svelte fix
  needs a different mechanism (e.g. `$state.snapshot(onSvgLoad)` or
  reading via `$state.frozen`) and should not be improvised.
- The test in Step 8 is flaky because `parseInlineSvg` is re-exported
  through `core/index.ts` and `vi.spyOn` on the re-export doesn't
  intercept the internal call. STOP and report; the fix is to spy
  on `sanitize.parseInlineSvg` directly (`import * as sanitize from
  "./core/sanitize"; vi.spyOn(sanitize, "parseInlineSvg")`) and adapt
  the cache helper to use the imported binding.
- `pnpm -F @mhaadi/svg test` shows fewer than 67 passing tests at the
  start of Step 9 — a test from a prior plan is broken. STOP and
  report.
- `pnpm -F @mhaadi/svg build` produces a `dist/` whose file list or
  size has changed unexpectedly (e.g. the new helper accidentally
  pulls in a transitive dep). STOP and report the diff.

## Maintenance notes

- **The cache is module-level and unbounded.** This is unchanged from
  before. The LRU cap is a follow-up — see plan backlog. Anyone
  consuming `@mhaadi/svg` in an app with thousands of distinct remote
  SVGs will see unbounded memory growth.
- **The cache is shared across all four adapters via the new core
  module.** A `<SVG>` (React) and a `<SVG>` (Svelte) mounting the same
  URL share the parsed result. That's a nice property that fell out
  of moving the cache to core; it also means a `clearSvgCache` call
  affects all four adapters. No public clear API is exposed; if a
  consumer needs one, add it as a `core` export in a follow-up plan.
- **Sanitize is part of the key.** A consumer that flips
  `sanitize={true}` to `sanitize={false}` (or vice versa) for the same
  URL does not get a cache hit — the parse re-runs. This is correct
  (the parsed outputs differ) and matches the new shape.
- **The React Native adapter has its own parsed cache
  (`nodeCache`)** because `parseAndSanitize` returns `SvgNode`, not
  `ParsedInlineSvg`. Unifying would require restructuring
  `renderSvgNode` (lines 186-228) to consume `ParsedInlineSvg`, which
  is out of scope.
- **Svelte effect tracking is now correct.** Inline callbacks no longer
  re-trigger the effect. The `untrack` pattern matches React's
  latest-ref (plan 006). Future contributors must keep the callback
  reads inside `untrack` or the bug returns.
- **Reviewer focus:**
  - Step 3 must preserve the `onSvgLoad(markup)` contract: the
    callback still receives the raw markup string, not the parsed
    object. Verify by reading the diff for `runWithCached` end-to-end.
  - Step 4 must keep the `SvgNode` shape consumed by
    `renderSvgNode` intact. The cache is a transparent memoization;
    the consumer doesn't change.
  - Step 7 must read `onSvgLoad`/`onSvgError` inside `untrack` (not
    before). A regression would put the reads back into the
    tracked dependency set and silently re-introduce the
    callback-tracking bug.
