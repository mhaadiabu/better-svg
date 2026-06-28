# Plan 011: LRU cap the parsed-SVG cache

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9af3c16..HEAD -- packages/svg/src/core/cache.ts packages/svg/src/core/index.ts packages/svg/src/core/cache.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/009-cache-parsed-svg.md (assumes the parsed cache
  introduced by 009 is in place)
- **Category**: perf, memory
- **Planned at**: commit `9af3c16`, 2026-06-25

## Why this matters

Plan 009 introduces a module-level parsed-SVG cache
(`packages/svg/src/core/cache.ts`) shared across all four adapters. The
cache is a `Map` with no eviction policy. For an application rendering
thousands of distinct remote SVGs (e.g. a CMS-backed icon browser, a
gallery app, a user-generated-avatar feed) the map grows unbounded for
the lifetime of the page. Each entry holds a `ParsedInlineSvg` or
`SvgNode` — small per entry, but the total can be megabytes on a
content-heavy site. The fix is a bounded LRU: when the cache exceeds a
size threshold, evict the least-recently-accessed entry. This is a
small, contained change to the core cache helper, with no public API
change.

## Current state

- `packages/svg/src/core/cache.ts` (introduced by plan 009) — has
  `cache: Map<CacheKey, ParsedInlineSvg>` and `nodeCache: Map<CacheKey,
  SvgNode>`. Both are unbounded. Exports: `getCachedParsedSvg`,
  `cacheParsedSvg`, `clearSvgCache`, `__svgCacheSize`, `ensureParsedSvg`,
  `ensureParsedNode`, `__svgNodeCacheSize`.
- `packages/svg/src/core/index.ts` — re-exports `ensureParsedSvg` and
  `ensureParsedNode` from `./cache`. Does **not** re-export `clearSvgCache`
  or the `__svgCacheSize` helpers (those are test-only).
- `packages/svg/src/core/cache.test.ts` (introduced by plan 009) — 6
  tests. Pattern: vitest + `vi.spyOn`.

The drift check covers plan 009's files. If they don't exist yet (plan
009 not landed), STOP and report — this plan assumes them.

Repo conventions:
- TypeScript strict, `noUnusedLocals` on.
- No comments in source.
- Tests use `vi.spyOn` for asserting internal call counts.
- Module-level `Map` is the existing pattern.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `pnpm install`                   | exit 0              |
| Typecheck | `pnpm check-types`               | exit 0              |
| Test      | `pnpm -F @mhaadi/svg test`       | all pass (74 + new) |
| Lint      | `pnpm lint`                      | no new errors       |

## Scope

**In scope** (the only files you should modify or create):
- `packages/svg/src/core/cache.ts` — replace the two unbounded `Map`s
  with bounded LRU-backed variants. Export the cap as a constant.
- `packages/svg/src/core/cache.test.ts` — extend with eviction tests.

**Out of scope** (do NOT touch):
- `packages/svg/src/core/index.ts` — no export change. `ensureParsedSvg`
  and `ensureParsedNode` keep their shape.
- `packages/svg/src/svg.tsx`, `native.tsx`, `vue/SVG.ts`,
  `svelte/runtime.ts`, `svelte/SVG.svelte` — adapters are unchanged.
  The LRU is transparent to them.
- `packages/svg/src/core/sanitize.ts`, `ast.ts`, `url.ts`, `resolve.ts`,
  `local.ts` — no changes.
- Making the cap user-configurable (e.g. a `setMaxCacheSize(n)` API).
  The cap is a constant; if a consumer needs tuning, that's a follow-up
  plan with a public API.
- LRU across tabs / persistence — out of scope. This is in-memory only.
- TTL / time-based eviction — out of scope. The LRU is size-bounded
  only. Time-based eviction is a different policy and a bigger change.

## Git workflow

- Branch: `advisor/011-cache-lru`
- Commit: `perf(svg): bound parsed-SVG cache with LRU eviction`
- Follow-up commits for tests if needed.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Replace the unbounded `Map`s with LRU

In `packages/svg/src/core/cache.ts`, replace the two `Map` declarations
with simple LRU wrappers. The LRU must support: `get`, `set`, `has`,
`clear`, `size`, plus a "touch on get" semantic so recently-read
entries are kept.

There are two reasonable approaches:

**(A) Hand-rolled LRU** using `Map`'s insertion-order guarantee: a `Map`
preserves insertion order; deleting and re-inserting on `get` moves the
key to the most-recently-used end. On eviction, delete the first
iterator entry (the oldest).

**(B) Use an LRU library** like `lru-cache` (npm). That adds a runtime
dependency. `@mhaadi/svg` currently has **zero runtime dependencies**
(confirmed via `npm view @mhaadi/svg deps: none`). Adding `lru-cache`
would break that property and surface in Socket's dependency surface
scan — which is exactly what plan 010 just cleaned up.

**Use approach (A).** Hand-rolled LRU using `Map` insertion order.
Zero new dependencies.

Replace the `cache` and `nodeCache` declarations with:

```ts
const PARSED_CACHE_LIMIT = 500;

const touch = <V>(map: Map<string, V>, key: string): V | undefined => {
  const value = map.get(key);
  if (value === undefined) return undefined;
  map.delete(key);
  map.set(key, value);
  return value;
};

const setBounded = <V>(map: Map<string, V>, key: string, value: V, limit: number): void => {
  if (map.has(key)) {
    map.delete(key);
  } else if (map.size >= limit) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
};
```

Update `getCachedParsedSvg` to use `touch`:

```ts
export const getCachedParsedSvg = (source: string, sanitize: boolean): ParsedInlineSvg | null => {
  const key = keyFor(source, sanitize);
  return touch(cache, key) ?? null;
};
```

Update `cacheParsedSvg` to use `setBounded`:

```ts
export const cacheParsedSvg = (source: string, sanitize: boolean, parsed: ParsedInlineSvg): void => {
  setBounded(cache, keyFor(source, sanitize), parsed, PARSED_CACHE_LIMIT);
};
```

`ensureParsedSvg` is unchanged structurally — it calls
`getCachedParsedSvg` (which now `touch`es) and `cacheParsedSvg` (which
now evicts). Reads are now LRU-aware.

Mirror the same pattern for `nodeCache` with the same limit (or a
separate constant `NODE_CACHE_LIMIT = 200` if the user wants to
differentiate — pick `200` for `nodeCache` since `SvgNode` trees are
larger per entry).

Wait — `nodeCache` is keyed on the same `keyFor` function and shares the
keyspace with the parsed cache only conceptually. They're two separate
maps. Both can use the same LRU shape; the limit is a per-map constant.
Use `PARSED_CACHE_LIMIT = 500` for `cache` and `NODE_CACHE_LIMIT = 200`
for `nodeCache`. Rationale: `SvgNode` trees carry the full AST and are
~2–5× larger per entry than `ParsedInlineSvg`; cap them lower to keep
the total memory bound reasonable.

Update `__svgCacheSize` and `__svgNodeCacheSize` — these already return
`map.size`, which now reflects the LRU-bounded size. No change.

`clearSvgCache` already calls `cache.clear()` — but the LRU-bounded
maps each have their own state. Update `clearSvgCache` to clear both:

```ts
export const clearSvgCache = (): void => {
  cache.clear();
  nodeCache.clear();
};
```

**Verify**:
- `pnpm check-types` → exit 0.
- `pnpm -F @mhaadi/svg test` → 74 pass (no behavior change for tests
  written against plan 009's surface).

### Step 2: Add LRU-specific tests

Extend `packages/svg/src/core/cache.test.ts` with three new tests:

```ts
import { ensureParsedNode, __svgNodeCacheSize } from "./cache";

describe("LRU eviction", () => {
  it("evicts the least-recently-used entry when the parsed cache is full", () => {
    clearSvgCache();
    for (let i = 0; i < 500; i++) {
      ensureParsedSvg(`s-evict-${i}`, "<svg><rect/></svg>", true);
    }
    expect(__svgCacheSize()).toBe(500);
    ensureParsedSvg("s-evict-new", "<svg><rect/></svg>", true);
    expect(__svgCacheSize()).toBe(500);
    expect(getCachedParsedSvg("s-evict-0", true)).toBeNull();
    expect(getCachedParsedSvg("s-evict-new", true)).not.toBeNull();
  });

  it("touches an entry on read so it is not evicted next", () => {
    clearSvgCache();
    for (let i = 0; i < 500; i++) {
      ensureParsedSvg(`s-touch-${i}`, "<svg><rect/></svg>", true);
    }
    getCachedParsedSvg("s-touch-0", true);
    ensureParsedSvg("s-touch-new", "<svg><rect/></svg>", true);
    expect(__svgCacheSize()).toBe(500);
    expect(getCachedParsedSvg("s-touch-0", true)).not.toBeNull();
    expect(getCachedParsedSvg("s-touch-1", true)).toBeNull();
  });

  it("evicts the node cache when full (lower limit)", () => {
    clearSvgCache();
    for (let i = 0; i < 200; i++) {
      ensureParsedNode(`n-evict-${i}`, "<svg><rect/></svg>", true);
    }
    expect(__svgNodeCacheSize()).toBe(200);
    ensureParsedNode("n-evict-new", "<svg><rect/></svg>", true);
    expect(__svgNodeCacheSize()).toBe(200);
    expect(ensureParsedNode("n-evict-0", "<svg><rect/></svg>", true)).not.toBeNull();
  });
});
```

The third test asserts that an evicted entry's source **can** re-populate
the cache (i.e. eviction doesn't poison the source key, it just removes
the parsed result). After eviction, calling `ensureParsedNode` with the
evicted source reparses and stores.

**Verify**:
- `pnpm -F @mhaadi/svg test src/core/cache.test.ts` → 9 tests pass
  (6 from plan 009 + 3 new).
- `pnpm -F @mhaadi/svg test` → all pass.

### Step 3: Full verification

- `pnpm check-types` → exit 0.
- `pnpm lint` → no new errors.
- `pnpm -F @mhaadi/svg test` → 74 + 3 = 77 pass.
- `pnpm -F @mhaadi/svg build` → exit 0; `dist/` reflects the source.

**Verify**:
- `git status` shows only the in-scope files modified.
- `pnpm -F @mhaadi/svg test` reports the new test count.

## Test plan

- `packages/svg/src/core/cache.test.ts` — 3 new tests:
  - LRU eviction at the parsed-cache limit.
  - LRU touch-on-read keeps a recently-accessed entry alive past the
    limit.
  - The node cache has a separate (lower) limit and evicts
    independently.
- Pattern: model after the existing `cache.test.ts` tests from plan 009.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check-types` exits 0
- [ ] `pnpm -F @mhaadi/svg test` exits 0; `cache.test.ts` has 9 passing tests
- [ ] `grep -n "PARSED_CACHE_LIMIT\|NODE_CACHE_LIMIT" packages/svg/src/core/cache.ts` matches both constants
- [ ] `grep -n "lru-cache\|@lru" packages/svg/package.json` returns no matches (zero new runtime deps)
- [ ] `pnpm lint` introduces no new errors
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 011 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The current `packages/svg/src/core/cache.ts` does not match the
  shape described in "Current state" (plan 009 hasn't landed). STOP
  and report; this plan's steps assume the parsed cache exists.
- The `Map` insertion-order guarantee is not reliable in the executor's
  V8 version. (This is a JavaScript spec guarantee since ES2015; the
  executor almost certainly has a modern Node. If `touch` doesn't
  re-order, STOP — there's a deeper issue.)
- The 500/200 limits are wrong for the maintainer's deployment target
  (e.g. they have a known high-cardinality site). The numbers are
  defaults; if the executor has evidence of a different need, report
  and pick a different value, but **do not** make the limit
  configurable in this plan (out of scope).
- The eviction tests are flaky because of `__svgCacheSize` returning
  499 instead of 500 due to a Map implementation detail. The cap
  is `>= limit`, so on the 500th set the size is 500; on the 501st
  set the size stays 500. If the test reports 499, STOP — there's
  a logic error in `setBounded`.

## Maintenance notes

- **The cap is a constant, not a config.** A future plan may add
  `setMaxCacheSize(n)` or read it from an env var. For now, the
  maintainer edits the constant. The Maintenance note in plan 009
  already mentions the unbounded-cache problem; this plan resolves it.
- **`nodeCache` (React Native) has a separate, lower cap** because
  `SvgNode` trees are larger per entry. The exact split (500/200) is
  a guess; if React Native consumers report OOM, revisit.
- **`getCachedParsedSvg` now touches the entry on read.** This means
  `ensureParsedSvg` no longer measures "true" cold-cache reads when
  followed by re-reads. If a future test asserts read counts on
  `parseInlineSvg`, the LRU touch moves the count below what a naive
  test might expect. This is correct; the spy on `parseInlineSvg`
  still measures parse calls, not cache hits.
- **The LRU is per-process.** A long-running server process with a
  rotating SVG set (e.g. a CDN-backed icon CDN with 10K distinct icons
  served over months) will cycle through entries. The cap is the
  upper bound on memory; the working set is the actual hot icons. No
  monitoring is added in this plan; the maintainer can add
  `__svgCacheSize` reads to telemetry if needed (the helper is
  exported with a `__` prefix to signal "not stable").
- **Reviewer focus:**
  - The `touch` and `setBounded` helpers are the load-bearing
    primitives. Read them once. Confirm `touch` re-orders by
    delete-then-set, and `setBounded` evicts the oldest entry when at
    the limit.
  - `clearSvgCache` must clear both `cache` and `nodeCache`. A
    regression that only clears one would silently leak memory in
    the other.
  - The new tests must not assume the LRU is exactly 500/200 — they
    assert *behavior* (eviction happens at the limit, touch keeps
    entries alive). If a future maintainer changes the limits, the
    tests should still pass.
