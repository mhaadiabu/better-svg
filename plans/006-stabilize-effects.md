# Plan 006: Stabilize React/Native effects against inline callbacks

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7e1b3b6..HEAD -- packages/svg/src/svg.tsx packages/svg/src/native.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. **Note:** Plans 002 and 003 edit
> `svg.tsx`; this plan runs **after both**. Re-read the live effect block.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: plans/001-vitest-harness-core-tests.md, plans/003-react-cache-write.md
- **Category**: correctness, perf
- **Planned at**: commit `7e1b3b6`, 2026-06-23

## Why this matters

Both `svg.tsx` (React) and `native.tsx` (React Native) put `onSvgLoad` and
`onSvgError` in the `useEffect` dependency array. When a consumer writes
either callback inline (the common case: `<SVG src={url} onSvgLoad={(m) => console.log(m)} />`),
the callback identity changes every render, the effect tears down and
re-runs, and the component **refetches** (or at least re-parses) on every
parent render. The docs already warn users to memoize (`docs.astro` "Memoize
fetchOptions"), which proves the maintainers know it's a footgun — but the
right fix is to call the latest callback without re-subscribing. This plan
uses the "latest ref" pattern so the effect depends only on
`resolvedSource`/`fetchOptions`/`cache`/`sanitize`, and `onSvgLoad`/`onSvgError`
are invoked via refs that always point at the newest function. Result: inline
callbacks no longer cause refetches or re-parses, and the memoize workaround
is no longer required for callbacks (still recommended for `fetchOptions`).

## Current state

`packages/svg/src/svg.tsx` — the effect deps (line 180):
```ts
    }, [resolvedSource, fetchOptions, cache, sanitize, onSvgLoad, onSvgError]);
```
And the callbacks are invoked directly inside the effect: `onSvgLoad?.(markup)`
(line 143), `onSvgError?.(err)` (lines 131, 154, 173).

`packages/svg/src/native.tsx` — the effect deps (line 357):
```ts
    }, [resolvedSource, fetchOptions, cache, sanitize, onSvgLoad, onSvgError]);
```
Direct invocations: `onSvgLoad?.(markup)` (line 306), `onSvgError?.(err)`
(lines 292, 317, 330, 349).

Repo conventions:
- `React` is imported as `* as React` (both files) and hooks are used as
  `React.useState`, `React.useEffect`, `React.useMemo`. Follow that style —
  use `React.useRef` and `React.useEffect` for the ref-sync, not bare imports.
- The components are `React.forwardRef`. The ref pattern must live inside the
  render function body, before the main effect.
- `noUnusedLocals` is on — every ref must be used.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Typecheck | `pnpm check-types`               | exit 0              |
| Test      | `pnpm -F @mhaadi/svg test`       | all pass            |
| Lint      | `npx oxlint .`                   | no new errors       |

## Scope

**In scope** (the only files you should modify or create):
- `packages/svg/src/svg.tsx` — latest-ref pattern for `onSvgLoad`/`onSvgError`; drop them from deps.
- `packages/svg/src/native.tsx` — same pattern.
- `packages/svg/src/svg.test.tsx` — **create or extend** with an effect-stability regression test (Plan 003 created this file; add to it).

**Out of scope** (do NOT touch):
- `packages/svg/src/vue/SVG.ts`, `svelte/runtime.ts` — Vue/Svelte don't have this bug (Vue's `watch` deps array is `[src, name, fetchOptions, cache, sanitize]` — no callbacks; Svelte's `load` is called from `$effect` keyed on the same props). Leave them.
- `fetchOptions` deps — keep `fetchOptions` in the deps array. The memoize guidance for `fetchOptions` stays (it's a genuinely new value when memoized away). This plan only removes the *callback* footgun.
- `packages/flutter/**` — Flutter uses `State.didUpdateWidget` with a `widget.src != oldWidget.src` guard; not affected.
- `core/**` — no changes.

## Git workflow

- Branch: `advisor/006-stabilize-effects`
- Commit: `fix(svg): stop refetching when onSvgLoad/onSvgError are inline`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add the latest-ref pattern to `svg.tsx`

Inside the `SVG` `forwardRef` body, after the `useState` declarations and
before the main `useEffect`, add refs that track the latest callbacks:

```ts
    const onLoadRef = React.useRef(onSvgLoad);
    const onErrorRef = React.useRef(onSvgError);
    React.useEffect(() => {
      onLoadRef.current = onSvgLoad;
      onErrorRef.current = onSvgError;
    });
```

Then replace the direct callback invocations inside the main effect with ref
calls. There are three call sites in `svg.tsx`:
- `onSvgError?.(err)` at the no-source branch (line ~131) → `onErrorRef.current?.(err)`
- `onSvgLoad?.(markup)` inside `runWithCached` (line ~143) → `onLoadRef.current?.(markup)`
- `onSvgError?.(normalized)` in the cache catch (line ~154) → `onErrorRef.current?.(normalized)`
- `onSvgError?.(normalized)` in the fetch catch (line ~173) → `onErrorRef.current?.(normalized)`

Finally, remove `onSvgLoad` and `onSvgError` from the deps array:
```ts
    }, [resolvedSource, fetchOptions, cache, sanitize]);
```

Keep `fetchOptions` — it's a genuine identity the effect must react to.

**Verify**: `pnpm check-types` → exit 0 (no unused refs; refs are used in the effect). `npx oxlint .` → no new errors.

### Step 2: Add the same pattern to `native.tsx`

Same change. `native.tsx` has four `onSvgError?.(...)` sites (lines ~292, 317, 330, 349) and one `onSvgLoad?.(markup)` (line ~306). Add the refs after the `useState` block (before `resolvedSource` useMemo is fine, or after — just before the main effect):

```ts
    const onLoadRef = React.useRef(onSvgLoad);
    const onErrorRef = React.useRef(onSvgError);
    React.useEffect(() => {
      onLoadRef.current = onSvgLoad;
      onErrorRef.current = onSvgError;
    });
```

Replace all five invocations with `onLoadRef.current?.(...)` / `onErrorRef.current?.(...)`. Update the deps array (line ~357) to drop the callbacks:
```ts
    }, [resolvedSource, fetchOptions, cache, sanitize]);
```

**Verify**: `pnpm check-types` → exit 0. `npx oxlint .` → no new errors.

### Step 3: Add the effect-stability regression test

Extend `packages/svg/src/svg.test.tsx` (created by Plan 003). Add a test that
proves an inline `onSvgLoad` does not cause a refetch on re-render. Use
`@testing-library/react`'s `rerender`:

```tsx
  it("does not refetch when onSvgLoad is inline (new identity each render)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(SVG_MARKUP, { status: 200, headers: { "Content-Type": "image/svg+xml" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const url = "https://example.com/stable.svg";
    const onLoad = vi.fn();
    const { rerender } = render(<SVG src={url} onSvgLoad={onLoad} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1));

    // Re-render with a *new* inline onLoad identity. Before the fix this
    // re-ran the effect and refetched; after, the ref holds the latest fn
    // and the effect does not re-run.
    const onLoad2 = vi.fn();
    rerender(<SVG src={url} onSvgLoad={onLoad2} />);

    // Give any erroneous effect a tick to fire.
    await new Promise((r) => setTimeout(r, 10));

    expect(fetchMock).toHaveBeenCalledTimes(1); // no refetch
    // The latest callback is the one that would fire on a fresh load; we
    // don't re-invoke it here because no new load happened. Assert no
    // spurious onLoad2 call from a re-parse:
    expect(onLoad2).not.toHaveBeenCalled();
  });
```

Notes:
- Before this fix, the `rerender` would re-run the effect → the cache (now
  populated by Plan 003) would return the markup synchronously →
  `runWithCached` would call `onLoadRef.current` (the new `onLoad2`) once.
  So **with Plan 003's cache but without this plan**, `onLoad2` *would* be
  called and `fetchMock` stays at 1. The stronger assertion is that
  `fetchMock` stays at 1 **and** the effect does not re-run at all. The
  `onLoad2 not called` assertion distinguishes "effect didn't re-run" from
  "effect re-ran but hit cache". Keep both assertions.
- If happy-dom's `Response` is unavailable, reuse the same mock shape Plan
  003 uses (STOP if Plan 003's mock doesn't work — they share the file).

**Verify**: `pnpm -F @mhaadi/svg test src/svg.test.tsx` → all tests pass (Plan 003's two + this one).

### Step 4: Full verification

**Verify**:
- `pnpm check-types` → exit 0.
- `pnpm -F @mhaadi/svg test` → all pass.
- `npx oxlint .` → no new errors.
- `grep -n "onSvgLoad, onSvgError" packages/svg/src/svg.tsx packages/svg/src/native.tsx` → **no matches** (they're out of the deps).
- `grep -n "onLoadRef\|onErrorRef" packages/svg/src/svg.tsx packages/svg/src/native.tsx` → matches in both files.

## Test plan

- Extend `svg.test.tsx` with the effect-stability test above. Pattern matches
  Plan 003's existing tests in the same file.
- A Native equivalent is not added because `native.tsx` requires
  `react-native-svg` and a RN test environment the repo doesn't have; the
  change is mechanically identical and the React test proves the pattern.
  (If a future RN test harness lands, mirror this test.)

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check-types` exits 0
- [ ] `pnpm -F @mhaadi/svg test` exits 0; `svg.test.tsx` effect-stability test passes
- [ ] `grep -n "onSvgLoad, onSvgError" packages/svg/src/svg.tsx packages/svg/src/native.tsx` → no matches
- [ ] `grep -n "onLoadRef\|onErrorRef" packages/svg/src/svg.tsx packages/svg/src/native.tsx` → matches in both
- [ ] `npx oxlint .` introduces no new errors
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The live `svg.tsx`/`native.tsx` effect block doesn't match the excerpts
  (Plans 002/003 changed them) — re-read and adapt the ref insertion point and
  the call-site line numbers; report the new structure.
- After removing the callbacks from deps, `pnpm check-types` flags
  `react-hooks/exhaustive-deps` — the repo uses oxlint, not eslint's
  react-hooks plugin, so this shouldn't fire. If oxlint *does* flag it,
  report the rule; the latest-ref pattern is the canonical correct fix and a
  suppression may be needed, but don't add one without reporting.
- The effect-stability test fails because happy-dom lacks `Response` — reuse
  Plan 003's exact mock; if Plan 003 had to work around it, follow suit.

## Maintenance notes

- **`fetchOptions` is still in the deps.** Inline `fetchOptions` objects
  still cause refetches. The docs' "Memoize fetchOptions" guidance stays
  valid. A future plan could apply the same ref pattern to `fetchOptions`,
  but that changes network semantics (a new fetchOptions should arguably
  trigger a refetch to apply new headers) — leave it.
- **The ref-sync effect has no deps array** (runs every render). This is the
  standard latest-ref pattern; it's cheap (two property assignments) and
  does not cause the main effect to re-run.
- **Reviewer focus:** confirm the deps arrays in *both* files dropped
  exactly `onSvgLoad, onSvgError` and kept `resolvedSource, fetchOptions,
  cache, sanitize`. And that every `onSvg*?.(...)` call site now goes through
  the ref — a single missed call site means a stale callback silently never
  fires.
