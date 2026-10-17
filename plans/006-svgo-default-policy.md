# Plan 006: SVGO default-on policy and preset research

> **Executor instructions**: Follow this plan step by step. This plan was
> produced from a completed empirical research study; do not re-run the
> study. Verify the drift check and quoted code excerpts before starting.
> The milestones below are ordered and NOT parallel: M1 must be anchored on
> the post-0.4.0 state of `feat/svg-svgo-opt-in` (PR #38) and the branch that
> stacks on it (PR #39). If anything in the "STOP conditions" section
> occurs, stop and report — do not improvise. When done, update the status
> row for this plan in `plans/README.md` — unless a reviewer dispatched you
> and told you they maintain the index.
>
> **Drift check (run first)**: `git log --oneline feat/svg-svgo-opt-in -5`
> and confirm PR #38's opt-in SVGO pass still matches the "safe" preset
> shape described under "Preset definitions" below. The implementation
> target is the tree **after 0.4.0 ships with PR #38 merged**, with PR #39
> (build-time precompilation) rebased on top. If the default policy or
> preset code on that base differs from what this plan assumes, treat each
> mismatch as a per-section decision point and report it rather than
> improvising.

## Status / Decision

- **Priority**: P2
- **Effort**: M
- **Risk**: MEDIUM (default flips behavior for every existing consumer)
- **Depends on**: PR #38 (`feat/svg-svgo-opt-in`, the current opt-in pass =
  this plan's "safe" preset) and PR #39 (build-time precompilation, stacked
  on #38, consumes SVGO output when the pass is on)
- **Category**: feature policy / correctness hardening
- **Research basis**: completed empirical study — fixture set, per-plugin
  isolation probes, 16-case composition battery, benchmarks on an
  Intel i7-4600U, svgo 4.1.0, Node 24. Reproduction logs live in
  `/tmp/opencode/svgo-research-artifacts/` (`probe-matrix-final.log`,
  `zz-bench.mjs`, `zz-unref-single.mjs`, `zz-who-removed.mjs`, probe test
  file). That directory is outside the repo and may not survive the
  session; if it is gone, every load-bearing number and probe result in
  this plan is reproduced inline below and can be re-derived from the same
  probe scripts' approaches.
- **Status**: research DONE. **Implementation PARKED for the 0.4.0 cycle by
  maintainer decision.** 0.4.0 ships opt-in-only (PR #38 behavior). This
  plan is the basis for the cycle *after* 0.4.0, once the opt-in pass has
  been used in the wild. Any implementation must rebase on the post-0.4.0
  state of PR #38 + #39.
- **Planned at**: 2026-10-17 (research completed same month; svgo 4.1.0,
  Node 24, i7-4600U)

## Executive verdict

Default-on SVGO is **safe under a redesigned preset** the study names
**"thorough"**. Plain preset-default is **unsafe** for this runtime: in the
16-case composition battery, plain preset-default broke **12 of 16** of the
runtime's own invariants; "thorough" passed **16 of 16**.

The one dev-facing consequence of adoption is a new hard dependency
(`svgo`) and a new default (`svgo: "thorough"` instead of off). Reverting is
one line: `svgo: false` restores exact pre-change semantics.

## Why this matters

The vite plugin (`packages/svg/src/vite/plugin.ts`) currently injects
**raw, unsanitized-to-production-grade transform output** into the bundle at
build/dev time. SVGO would cut output roughly 25% (measured below) at a
per-icon cost the runtime can already absorb — but SVGO's preset-default
does three things this runtime cannot survive:

1. **Id contract breakage.** `scopeSvgNodeIds` in
   `packages/svg/src/core/ids.ts` maps *authored* ids to runtime-prefixed
   ids so caller CSS works. `cleanupIds` renames and removes ids before
   that mapping ever sees them, and whether caller-side CSS references
   those ids is undecidable from the file alone. This breaks the
   caller-id contract.
2. **Silent content deletion.** `removeUselessDefs` and
   `removeHiddenElems` delete content a caller may reference. Concrete
   probe: `<use href="#thePath">` was left dangling after `inlineStyles`
   (with default `removeMatchedSelectors: true`) stripped the id, and
   `removeUselessDefs` then removed the now-unreferenced-looking path.
   `removeHiddenElems` deletes visibly-rendered dot shapes and
   referenced degenerate paths.
3. **Attribute stripping that changes rendering.** `inlineStyles`'
   default `removeMatchedSelectors: true` strips id/class attributes —
   probe evidence in the matrix log (`deadIds=brandonly` on the
   `inlineStyles` row, id/class gone from output).

A curated override set ("thorough") plus a string-level reference-integrity
checker closes all three, at a measured cost below.

## Proposed TS shape

Exact target shape for `LocalSvgOptions` / `SvgoOptions` (extends what
`packages/svg/src/vite/plugin.ts` already exports):

```ts
export type SvgoPresetName = "thorough" | "safe";

export type SvgoOption =
  | boolean        // false = exact opt-out; svgo is never imported
  | SvgoPresetName // "thorough" (default after adoption) | "safe" (PR #38 behavior)
  | {
      plugins?: string[] | ((file: string) => string[]);
      // explicit plugin list overrides the preset entirely
      onViolation?: "warn" | "fail"; // ref-integrity checker; default "warn"
    };

export type LocalSvgOptions = {
  dirs?: string[];
  svgo?: SvgoOption; // default: "thorough" (post-adoption)
};
```

Semantics per rung:

- `svgo: false` — module-level: `svgo` is never imported, zero cost, exact
  pre-change output. The escape hatch for anyone who adopted the library
  before default-on and needs byte-identical behavior.
- `svgo: "safe"` — today's PR #38 behavior, preserved as a named preset.
- `svgo: "thorough"` (default) — preset-default plus the overrides below.
- `svgo: { plugins: [...] }` — curated plugin list, overrides the preset
  entirely. Checker enforcement applies (`onViolation`, default `"warn"`).
  Per-file function form `plugins: (file) => [...]` is preserved.
- `onViolation: "warn" | "fail"` — controls the reference-integrity
  checker only. `"warn"` (default) logs; `"fail"` throws in build.

## Preset definitions

```ts
// "thorough" = preset-default + these overrides:
{
  cleanupIds: { remove: false, minify: false },
  removeUselessDefs: false,
  removeHiddenElems: false,
  inlineStyles: { removeMatchedSelectors: false },
}
```

Rationale per override (each backed by a probe in the study):

- **`cleanupIds: { remove: false, minify: false }`** — renames/removes ids
  that `ids.ts`'s `scopeSvgNodeIds` maps as authored; caller CSS references
  are undecidable from the file alone.
- **`removeUselessDefs: false`** — `<use href="#thePath">` left dangling
  after `inlineStyles` stripped the id, then `removeUselessDefs` removed
  the path.
- **`removeHiddenElems: false`** — deletes visibly-rendered dot shapes and
  referenced degenerate paths.
- **`inlineStyles: { removeMatchedSelectors: false }`** — default
  `removeMatchedSelectors: true` strips id/class attributes (probe:
  `brandonly` id vanished).

```ts
// "safe" = current PR #38 behavior (preserve verbatim; note: its
// removeDesc override is REDUNDANT under svgo 4.1, see Classification)
```

## Plugin classification (condensed evidence table)

Facts an implementer must carry, each with one-line evidence from the
per-plugin isolation matrix:

| Plugin                                    | Class            | Evidence (one line) |
| ----------------------------------------- | ---------------- | ------------------- |
| `cleanupIds`                              | dangerous, preset-member | renames/removes ids the runtime maps as authored (composition battery) |
| `removeUselessDefs`                       | dangerous, preset-member | `<use href="#thePath">` dangled, then the path was deleted |
| `removeHiddenElems`                       | dangerous, preset-member | deletes visible dot shapes and referenced degenerate paths |
| `inlineStyles`                             | dangerous defaults | `removeMatchedSelectors: true` strips id/class attrs (`deadIds=brandonly`) |
| `removeTitle`                              | still-dangerous if curated | silently drops a11y content; presentation layer only recreates `<title>` when caller passes one |
| `removeViewBox` / `removeDimensions`       | still-dangerous if curated | breaks the size-prop system via the width/height→viewBox derivation in `packages/svg/src/core/presentation.ts:55-58` |
| `prefixIds`                                | still-dangerous if curated | rewrites every id (probe row: `renamed=Y`, size grew 1286→1475) |
| `removeXlink`                              | still-dangerous if curated | rewrites xlink:href references; caller tooling may still target xlink |
| `removeDesc`                               | SAFE in v4 defaults | only strips empty/boilerplate desc; the "safe" preset's override for it is redundant |
| `convertPathData`, `convertColors`, `minifyStyles`, `collapseGroups`, etc. | safe | no invariant loss in isolation or composition |

Key classification fact: **svgo 4.1 preset-default does NOT contain**
`removeTitle`, `removeViewBox`, `removeDimensions`, `removeXlink`, or
`prefixIds`. The preset is dangerous for this runtime only through
`cleanupIds`, `removeUselessDefs`, `removeHiddenElems`, and
`inlineStyles`' defaults — which is exactly what "thorough" overrides.

## Seam, dependency, and cache design

**Seam.** SVGO runs at the transform seam in `packages/svg/src/core/local.ts`,
per file, before the sanitizer and id-scoping pipeline. Because
`packages/svg/src/vite/plugin.ts` runs at build/dev time, `svgo` must be a
**hard dependency** of the vite plugin surface — not an optional peer.
An optional peer gets silently skipped in some environments (dev-vs-prod
drift); the study's policy is hard dependency, build/dev-time only.

**Cache.** A per-file mtime+size cache (~15 lines) at the same seam. Full
dev reloads currently re-transform every file on every change; with the
cache, re-transform at 2000 icons drops 950 ms → ~10 ms. Key = path +
mtime + size; value = optimized output. Native plugin cache-style scoping
comes from the existing transform flow — no new infrastructure.

**Worker threads: rejected.** Measured slower at realistic scale
(pool-2 1026 ms, pool-4 1251 ms vs serial 834 ms at 2000 icons); only wins
above roughly 10k icons, and workers block custom function plugins (not
structured-clone-safe). Serial with the mtime cache is the design.

## Measured cost

Benchmarks on an Intel i7-4600U (2-core/4-thread laptop CPU — a realistic
floor, not a CI-class machine), svgo 4.1.0, Node 24:

| Config           | ms/icon | Size vs raw | Scale notes |
| ---------------- | ------- | ----------- | ----------- |
| thorough         | 0.56    | 75.0%       | 500 icons 278 ms; 2000 icons 950 ms full pass |
| safe             | 0.49    | 73.7%       | |
| no-svgo baseline | 0.14    | 100%        | |
| thorough + mtime cache | n/a first run | | full-reload re-transform 950 ms → ~10 ms at 2000 icons |

Hardware note: the 0.56 ms/icon figure is a *cold-cache sustained* rate on
2014-era silicon; modern dev machines will be faster. The load-bearing
numbers are the ratios (thorough ≈ 4× baseline cost, ≈ 75% of raw size)
and the cache delta (95× faster warm reload).

## Composition battery summary

16 fixtures × composed-preset runs, checking the runtime's own invariants
(children preserved, lost refs, dead ids, no unauthorized renames, viewBox,
title, desc, metadata, style, mask, overrides, `<use>`):

| Preset     | Invariants passed |
| ---------- | ----------------- |
| plain preset-default | **12 / 16** |
| "thorough" | **16 / 16** |

Failure modes observed under plain preset-default: id renames/removals
(`cleanupIds`), dangling `"#thePath"` refs (`removeUselessDefs`),
deleted visible dots/degenerate stimuli paths (`removeHiddenElems`),
stripped id/class attrs (`inlineStyles`). The probe checker (next section)
caught all composed breakages with **zero false positives**.

## Reference-integrity checker requirement

String-level, no DOMParser. After SVGO runs, in the OUTPUT:

- every `url(#...)`,
- every `href="#..."`,
- every `aria-labelledby` / `aria-describedby` token,
- every SMIL `begin`/`end` id reference,
- every `#id` CSS selector (inside `<style>` and style attributes)

must resolve to an id that exists in the OUTPUT. Compare resolution
against the pre-SVGO image to attribute the breakage to svgo rather than
to a file's pre-existing condition. Probe implementation caught composed
breakage with zero false positives; cost < 5% of the optimize call.

`onViolation: "warn"` logs (default); `"fail"` throws (build-time CI
choice). User-curated plugin lists revert to checker enforcement by
construction — the checker is the safety net that makes curation
survivable.

## Escape-hatch ladder

Documented UX surface, from widest to narrowest:

1. `svgo: false` — pre-change semantics; the module is never imported.
2. `svgo: "safe"` — today's preset (PR #38 behavior).
3. *(default)* `svgo: "thorough"` — safe-by-design composition.
4. Per-file function form `plugins: (file) => [...]` — fine-grained control,
   preserved from #38.
5. Curated explicit plugin list + `onViolation` — power users; checker
   enforcement governs.

Migration/UX notes — the complete list of dev-facing changes:

- new hard dependency: `svgo` (build/dev-time only; never shipped to the
  browser runtime since the transform seam is on injected sources)
- new default: absence of `svgo` now means `"thorough"`
- how to revert: `svgo: false` (byte-identical output), or
  `svgo: "safe"` (keeps SVGO at #38 behavior)
- release notes must state all four facts explicitly.

## Known unknowns (with the probe that would close each)

1. **SMIL `begin`/`end` id refs under user-curated `cleanupIds`.**
   Largely unreachable through defaults (thorough disables the dangerous
   forms), unknown for curated lists. Probe: fixture with
   `<animate begin="anim0.click">`, run curated cleanupIds, check ref
   resolution via the checker.
2. **csso exotic selectors vs the stylesheet rewriter.** Unknown. Probe:
   fixture with `:is(#a)`, attribute-ish and namespace selectors in
   `<style>`, run minifyStyles + the checker + the id-scoping rewriter,
   diff.
3. **svgo version churn.** All numbers are svgo 4.1.0. Re-run the
   composition battery on any svgo major bump before changing presets.
   The battery itself is the regression harness — keep its fixtures in-repo.

## Milestone steps

> Implementation is PARKED until after 0.4.0. Do not start M1 on this
> branch, on `main`, or before PR #38/#39 land in the 0.4.0 line.

### M1: Implementation (post-0.4.0 base)

Rebase on the post-0.4.0 state of `feat/svg-svgo-opt-in` (PR #38) with
PR #39 stacked. Add `svgo` as a hard dep of the vite plugin surface.
Implement `SvgoOption` / `SvgoPresetName` per the TS shape above; default
`LocalSvgOptions.svgo` to `"thorough"`; wire per-file function form and
curated-list override; skip `svgo` import entirely when `svgo: false`.
Verify `svgo: false` produces byte-identical output to the pre-change pass
(characterization: compare transform output for the probe fixture set
before/after).

### M2: Reference-integrity checker

Implement the string-level checker (list of ref classes above), run it on
SVGO output when the pass is on or a curated list is present. Default
`"warn"`, support `"fail"`. Add the 16-fixture composition battery as
vitest tests (turning the study's ad-hoc probes into permanent regression
coverage — `cleavy`: the fixtures live in `/tmp/opencode/...` temporarily;
commit fixture files into the repo).

### M3: Per-file mtime+size cache

~15-line cache at the transform seam in `packages/svg/src/core/local.ts`.
Key: path + mtime + size. Acceptance: full dev reload with 2000 icons
drops from ~950 ms to ≤ 20 ms warm (measured scale-env tolerant). Dev-only
re-optimization on mtime/size change.

### M4: Docs + release notes

Document the escape-hatch ladder in the vite/astro README sections and the
options reference. Release notes text (consumer-facing, verbatim basis):
"default-on SVGO via a curated 'thorough' preset; set `svgo: false` for
pre-0.5-style output, `svgo: 'safe'` for the earlier opt-in preset;
`svgo` is now required at build/dev time but is never shipped to the
browser."

## Done criteria

Machine-checkable, per milestone:

- [ ] M1: `grep -c '"thorough"'` in the preset definition module ≥ 1;
  byte-identical-output characterization test green with `svgo: false`
- [ ] M2: composition battery runs as vitest, 16/16 green under "thorough";
  checker catches an induced breakage under a curated unsafe list
- [ ] M3: warm reload measured ≤ 20 ms at 2000 fixtures
- [ ] M4: README/CHANGELOG/release-notes text present (consumer tone,
  not internal notes)
- [ ] `plans/README.md` status row updated for this plan
- [ ] No version bump, no `CHANGELOG.md`, no `package.json` edits in
  commits belonging to THIS plan's research deliverable (this plan is
  research; packaging happens with the implementation under M1–M4)

## STOP conditions

Stop and report (do not improvise):

- Post-0.4.0 base's preset code differs materially from "safe" as
  described here (e.g. preset membership or override syntax changed) —
  report rather than guess at re-derivation, and diff the research
  artifacts against the new svgo version if that differs.
- SVGO output breaks a checker invariant the composition battery did not
  cover — stop, capture the fixture, and extend the battery rather than
  inventing a new override.
- Inability to make `svgo: false` byte-identical (e.g. desired: pre-#38
  code path was removed upstream) — report; the escape-hatch contract
  cannot be silently violated.
- Any pressure to ship default-on in 0.4.0 — the maintainer decision to
  PARK until after 0.4.0 (opt-in-only via PR #38) governs. Re-confirm
  before proceeding.

## Maintenance notes

- The `InlineStyles` override matters only because of the id/class side
  effect; if SVGO changes `removeMatchedSelectors` default to false, drop
  the override and re-run the battery.
- Worker-thread optimization is closed by measurement at realistic scale;
  reopen only when the fixture set approaches ~10k icons per project.
- The checker is the only thing standing between curated plugin lists and
  silent breakage. Treat any refactor of `local.ts` transform flow as
  touching the checker's contract.
