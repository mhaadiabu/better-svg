# Plan 003: Fix React SVG cache write

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7e1b3b6..HEAD -- packages/svg/src/svg.tsx packages/svg/src/core/resolve.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. **Note:** Plan 002 rewrites
> `svg.tsx`'s `parseSvgMarkup` swap. This plan must run **after 002**; re-read
> the live `svg.tsx` effect block before editing.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-vitest-harness-core-tests.md, plans/002-unify-dom-sanitization.md
- **Category**: correctness
- **Planned at**: commit `7e1b3b6`, 2026-06-23

## Why this matters

The React `<SVG>` component reads from `svgCache` but **never writes to it**.
The cache-lookup branch (`svgCache.has(resolvedSource)`) runs, but the fetch
`.then` callback that resolves the markup never calls `svgCache.set(...)`. So
every mount of the same URL re-fetches over the network. "Memory caching" is a
marketed feature (landing page feature card + docs prop table), and the
default adapter silently doesn't do it. React Native already writes the cache
(`native.tsx:341`); Svelte writes it (`runtime.ts:149-151`); Vue writes it
(after Plan 002). This is a one-line fix + a regression test.

## Current state

`packages/svg/src/svg.tsx` — the effect's fetch path (lines 162-174):
```ts
      resolveMarkup(resolvedSource, { fetchOptions, signal: controller.signal, cache })
        .then((markup) => {
          if (!active) return;
          runWithCached(markup);
        })
        .catch((err) => {
          if (!active) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          const normalized = err instanceof Error ? err : new Error("Failed to load SVG.");
          setError(normalized);
          setIsLoading(false);
          onSvgError?.(normalized);
        });
```
The cache-lookup branch above it (lines 146-160) reads `svgCache.has/get` but
there is no `svgCache.set` anywhere in `svg.tsx`. The module-level cache is
declared at line 19: `const svgCache = new Map<string, string>();`.

Compare React Native (`packages/svg/src/native.tsx:338-343`) — the correct pattern:
```ts
      resolveMarkup(resolvedSource, { fetchOptions, signal: controller.signal, cache })
        .then((markup) => {
          if (!active) return;
          if (cache) svgCache.set(resolvedSource, markup);
          finish(markup);
        })
```

Repo conventions: `cache` is a boolean prop (default `true`). `resolveMarkup`
also receives `cache` but uses it only to decide whether to attempt the
fetch-with-cache path; the adapter is responsible for populating the cache.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `pnpm install`                   | exit 0              |
| Typecheck | `pnpm check-types`               | exit 0              |
| Test      | `pnpm -F @mhaadi/svg test`       | all pass            |
| Lint      | `npx oxlint .`                   | no new errors       |

## Scope

**In scope** (the only files you should modify or create):
- `packages/svg/src/svg.tsx` — add the `svgCache.set` line in the fetch `.then`.
- `packages/svg/src/svg.test.tsx` — **create**. React cache regression test using `@testing-library/react` (installed by Plan 001).

**Out of scope** (do NOT touch):
- `packages/svg/src/native.tsx` — its cache write is already correct.
- `packages/svg/src/svelte/runtime.ts` — already writes cache.
- `packages/svg/src/vue/SVG.ts` — Plan 002 fixed Vue's cache.
- `packages/svg/src/core/resolve.ts` — `resolveMarkup`'s `cache` param behavior is unchanged.
- The effect's dependency array (`onSvgLoad`/`onSvgError`) — Plan 006.
- Do not add a cache-clear/export helper unless the test truly needs it (see Step 2 — it doesn't).

## Git workflow

- Branch: `advisor/003-react-cache-write`
- Commit: `fix(svg): cache resolved SVG markup in React adapter`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add the cache write

In `packages/svg/src/svg.tsx`, in the fetch `.then` callback, add the cache
write **before** `runWithCached(markup)`, mirroring `native.tsx:341`. After
Plan 002 the surrounding code shape is:
```ts
        .then((markup) => {
          if (!active) return;
          if (cache) svgCache.set(resolvedSource, markup);
          runWithCached(markup);
        })
```
Place the `if (cache) svgCache.set(resolvedSource, markup);` line immediately
after the `if (!active) return;` guard and before `runWithCached(markup)`.

**Verify**: `pnpm check-types` → exit 0. `npx oxlint .` → no new errors.

### Step 2: Write the React cache regression test

Create `packages/svg/src/svg.test.tsx`. Use `@testing-library/react` (installed
by Plan 001) and vitest. happy-dom provides `DOMParser`. Mock global `fetch`
with `vi.stubGlobal`.

The test must prove: a second render of the same URL does **not** call `fetch`
(cache hit). Structure (vitest isolates module state per test file, so the
module-level `svgCache` is fresh in this file):

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { SVG } from "./svg";

afterEach(() => {
  vi.unstubAllGlobals();
});

const SVG_MARKUP = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="10" height="10"/></svg>';

describe("SVG cache", () => {
  it("caches resolved markup so a second mount does not refetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(SVG_MARKUP, { status: 200, headers: { "Content-Type": "image/svg+xml" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const url = "https://example.com/cached.svg";
    const { unmount } = render(<SVG src={url} />);

    await waitFor(() => {
      // First mount fetches exactly once.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    unmount();

    // Second mount of the same URL should hit the cache, not fetch again.
    render(<SVG src={url} />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1); // still 1 — cache hit
    });
  });

  it("does not cache when cache={false}", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(SVG_MARKUP, { status: 200, headers: { "Content-Type": "image/svg+xml" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const url = "https://example.com/no-cache.svg";
    const { unmount } = render(<SVG src={url} cache={false} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    unmount();

    render(<SVG src={url} cache={false} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2)); // refetched
  });
});
```

Notes for the executor:
- The first test, **before this fix**, would see `fetchMock` called **2**
  times (no cache write). After the fix it's 1. That's the regression.
- The second test (`cache={false}`) asserts cache-off still refetches — guards
  against an over-eager fix that caches regardless of the prop.
- happy-dom's `Response` constructor is available; if not, construct the
  response object manually: `{ ok: true, status: 200, text: async () => SVG_MARKUP, headers: new Headers() }`.
  If `Response` is missing, STOP and report (don't improvise a different mock shape without noting it).

**Verify**: `pnpm -F @mhaadi/svg test src/svg.test.tsx` → both tests pass.

### Step 3: Full verification

**Verify**:
- `pnpm -F @mhaadi/svg test` → all pass (001 core tests + 002 sanitize test + this cache test).
- `pnpm check-types` → exit 0.
- `npx oxlint .` → no new errors.

## Test plan

- New: `packages/svg/src/svg.test.tsx` — two cases: cache hit prevents refetch; `cache={false}` still refetches.
- Pattern: vitest + `@testing-library/react` + `vi.stubGlobal("fetch", ...)`. This is the first React component test in the repo; Plan 006 will follow the same pattern.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check-types` exits 0
- [ ] `pnpm -F @mhaadi/svg test` exits 0; `svg.test.tsx` exists with 2 passing tests
- [ ] `grep -n "svgCache.set" packages/svg/src/svg.tsx` → one match, inside the fetch `.then`
- [ ] `npx oxlint .` introduces no new errors
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `.then` block in the live `svg.tsx` doesn't match the excerpt (Plan 002
  may have restructured it — re-read and adapt; if 002 moved `runWithCached`
  such that the cache write can't sit before it, report the new structure).
- `@testing-library/react` is not installed (Plan 001 should have added it) —
  do not install unrelated packages; report that 001's install step was skipped.
- happy-dom lacks `Response`/`DOMParser` and the test can't render — report the
  exact missing global.

## Maintenance notes

- **The cache key is `resolvedSource`** (the URL or resolved local path). If
  a future change makes `resolveSource` return different strings for the same
  SVG (e.g. normalizing trailing slashes), cache hits will silently miss.
- **The cache is module-level and unbounded.** For an app rendering thousands
  of distinct remote SVGs this grows forever. A future LRU/size cap is a
  reasonable follow-up; not in scope here.
- **Reviewer focus:** confirm the `if (cache)` guard is present so
  `cache={false}` users don't get cached entries, and that the write happens
  before `runWithCached` (so a parse throw doesn't skip caching — actually
  caching before parse is intentional: even if parse fails, the markup is
  cached; but `runWithCached` throwing will set the error state. This matches
  Native's order. Keep it.).
