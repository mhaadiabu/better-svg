# Plan 008: Docs consistency pass + remove false promises

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7e1b3b6..HEAD -- apps/web/src/pages/index.astro apps/web/src/pages/docs.astro packages/svg/README.md README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. **Note:** Plans 002/003/004/006
> fix the code behavior this plan documents; this plan must run **after**
> them so docs describe fixed behavior.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/002-unify-dom-sanitization.md, plans/003-react-cache-write.md, plans/004-flutter-sanitizer.md, plans/006-stabilize-effects.md
- **Category**: docs
- **Planned at**: commit `7e1b3b6`, 2026-06-23

## Why this matters

The landing page and docs make four claims that are **false against the
shipped code** and remain false even after the bug-fix plans land. Marketing
that overstates capabilities erodes trust the moment a user tries the
documented feature and it doesn't work. This plan removes or qualifies each
false promise so the docs match reality. It also removes a dead
`flutterNotes` declaration that `astro check` flags as unused.

The false promises:
1. **"Renders actual `<svg>` elements ... across every adapter"** — React Native renders a `react-native-svg` tree (`<Svg>`/`<Path>`/...), Flutter renders via `flutter_svg`'s `SvgPicture`. Only the three web adapters render a real `<svg>` DOM element.
2. **"Full prop forwarding ... Every standard SVG attribute ... className, onClick, aria-*, width, height, color — everything"** — only React (web) forwards `React.SVGProps<SVGSVGElement>`. RN forwards a fixed subset (width/height/color/fill/stroke/strokeWidth/style); Vue/Svelte forward a fixed subset (width/height/viewBox/fill/stroke/role/aria-label/aria-hidden). `className`/`onClick` are not forwarded in RN/Vue/Svelte.
3. **"renders a true `<svg>` element with full prop forwarding"** (docs overview) — same overstatement as #1/#2.
4. **"`SvgName` is a string literal union derived from the SVGs present in `src/assets/svg/` at build time. It gives you autocompletion and catches typos."** — the code ships `type SvgName = string` (`packages/svg/src/core/local.ts:34`). No build-time union is generated; `vite.ts` globs the directory for URL resolution only, not type generation.

## Current state

**Landing page** — `apps/web/src/pages/index.astro`:

Feature card "Inline rendering" (lines 33-36):
```
    title: "Inline rendering",
    desc: "Renders actual <svg> elements — not <img> tags — so CSS currentColor, animations, and JavaScript all work natively across every adapter.",
```

Feature card "Full prop forwarding" (lines 53-56):
```
    title: "Full prop forwarding",
    desc: "Every standard SVG attribute is forwarded and overrides markup attributes. className, onClick, aria-*, width, height, color — everything.",
```

**Docs** — `apps/web/src/pages/docs.astro`:

Overview (lines 170-179):
```
              <code class="inline-code">@mhaadi/svg</code> exposes a single component —{" "}
              <code class="inline-code">{"<SVG>"}</code> — that resolves SVG content from any source,
              sanitizes unsafe markup, and renders a true{" "}
              <code class="inline-code">{"<svg>"}</code> element with full prop forwarding. Available for
              <strong class="text-[#e8e8e8]"> React, React Native, Vue, Svelte</strong> via subpath exports
              on a single npm package, and for <strong class="text-[#e8e8e8]">Flutter</strong> via the
              separate <code class="inline-code">svg_flutter</code> pub package. No{" "}
              <code class="inline-code">{"<img>"}</code> wrappers. No restrictions.
```

False `SvgName` explanation (lines 1010-1014), inside the "Dynamic icon gallery" React example:
```
                <p class="mt-3 text-sm text-zinc-muted">
                  <code class="inline-code">SvgName</code> is a string literal union derived from the SVGs
                  present in <code class="inline-code">src/assets/svg/</code> at build time. It gives you
                  autocompletion and catches typos.
                </p>
```

Dead variable (lines 34-38):
```
const flutterNotes = [
  "svg_flutter is a separate pub package and is not a subpath of @mhaadi/svg.",
  "It depends on flutter_svg (peer) and http for remote fetching.",
  "Sanitization is performed against the raw markup before passing to SvgPicture.string.",
];
```
`flutterNotes` is never referenced in the markup. `astro check` reports:
`src/pages/docs.astro:34:7 - hint ts(6133): 'flutterNotes' is declared but its value is never read.`

**What is accurate and must NOT change:**
- "Memory caching ... in every adapter" (index.astro:50) — true after Plans 003 (React) + 002 (Vue module cache); Flutter's `SvgResolver._cache` already cached. Leave.
- "Built-in sanitization ... Safely render untrusted SVG content in any framework" (index.astro:40) — true after Plans 002/004. Leave.
- "Loading & fallback ... Slots in Vue, snippets in Svelte, Widgets in Flutter" (index.astro:60) — accurate. Leave.
- "Zero dependencies" badge (docs.astro:183) — true for the JS package (`packages/svg/package.json` has no `dependencies`, only peer/dev). Leave.
- The Props table (docs.astro:406-459) — accurate. Leave.
- The "Memoize fetchOptions" edge-case note (docs.astro:713-722) — still valid after Plan 006 (fetchOptions remains in effect deps). Leave.

Repo conventions for the docs files:
- Astro frontmatter (`---`) holds TS data arrays; markup below. The `featureCards` array elements are plain objects with `icon`/`title`/`desc` string fields.
- Tailwind classes are used inline; preserve them exactly when editing surrounding markup.
- `CodeBlock` component is imported (`import CodeBlock from "../components/CodeBlock.astro"`); don't disturb imports.
- The docs use `{"<svg>"}` escaping for literal angle brackets in JSX text; preserve that style.

## Commands you will need

| Purpose    | Command                          | Expected on success |
|------------|----------------------------------|---------------------|
| Install    | `pnpm install`                   | exit 0              |
| Typecheck  | `pnpm -F web run check-types`    | exit 0, 0 hints     |
| Build      | `pnpm -F web run build`          | exit 0              |

(`pnpm check-types` runs turbo across all packages; the web-specific command
is the relevant gate for this plan. Run both if you like.)

## Scope

**In scope** (the only files you should modify):
- `apps/web/src/pages/index.astro` — qualify feature card #1 and #5.
- `apps/web/src/pages/docs.astro` — qualify the overview paragraph; remove the false `SvgName` paragraph; remove the dead `flutterNotes` declaration.
- `packages/svg/README.md` — qualify the "Inline rendering" / full-prop-forwarding language if it repeats the same claims (it does not make the "across every adapter" or "every attribute" claim verbatim; verify and only edit if a false claim is present).
- `README.md` (root) — same: verify and only edit if a false claim is present.

**Out of scope** (do NOT touch):
- `apps/web/src/components/*`, `layouts/*`, `scripts/*`, `data/*` — no false claims there.
- `apps/web/src/styles/*` — styling.
- Any `packages/svg/src/**` source — docs-only plan.
- The Props table, Framework Specifics, Source Types, Security, Edge Cases sections — accurate, leave.
- Marketing taglines ("Zero compromises on security or performance", "SHIP BETTER SVG TODAY") — subjective marketing voice, not factual promises. Leave.
- `SvgName` the type — do not change the type to a union (that's direction D1, not this plan). Only remove the false doc claim.

## Git workflow

- Branch: `advisor/008-docs-remove-false-promises`
- Commit: `docs: remove false adapter-uniformity and SvgName-union claims`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Fix the "Inline rendering" feature card (index.astro)

In `apps/web/src/pages/index.astro`, replace the `desc` string of the first
feature card (line 35). Change:
```
    desc: "Renders actual <svg> elements — not <img> tags — so CSS currentColor, animations, and JavaScript all work natively across every adapter.",
```
to:
```
    desc: "On the web (React, Vue, Svelte) renders a real <svg> element — not an <img> tag — so CSS currentColor, animations, and JavaScript work natively. React Native renders a react-native-svg tree and Flutter renders via flutter_svg.",
```

This keeps the card's value prop (inline rendering, no `<img>`) while
distinguishing the web (DOM `<svg>`) from the mobile adapters (native render
trees).

**Verify**: `pnpm -F web run check-types` → exit 0 (string literal change, no type impact).

### Step 2: Fix the "Full prop forwarding" feature card (index.astro)

In `apps/web/src/pages/index.astro`, replace the `desc` string of the fifth
feature card (line 55). Change:
```
    desc: "Every standard SVG attribute is forwarded and overrides markup attributes. className, onClick, aria-*, width, height, color — everything.",
```
to:
```
    desc: "React forwards every SVGProps attribute (className, onClick, aria-*, width, height) and it overrides markup attrs. React Native, Vue, and Svelte forward a focused subset — width, height, color/fill/stroke, and core a11y attrs.",
```

**Verify**: `pnpm -F web run check-types` → exit 0.

### Step 3: Fix the docs overview paragraph (docs.astro)

In `apps/web/src/pages/docs.astro`, lines 170-179, replace the sentence
"sanitizes unsafe markup, and renders a true `<svg>` element with full prop
forwarding." with a qualified version. The current paragraph:
```
              <code class="inline-code">@mhaadi/svg</code> exposes a single component —{" "}
              <code class="inline-code">{"<SVG>"}</code> — that resolves SVG content from any source,
              sanitizes unsafe markup, and renders a true{" "}
              <code class="inline-code">{"<svg>"}</code> element with full prop forwarding. Available for
              <strong class="text-[#e8e8e8]"> React, React Native, Vue, Svelte</strong> via subpath exports
              on a single npm package, and for <strong class="text-[#e8e8e8]">Flutter</strong> via the
              separate <code class="inline-code">svg_flutter</code> pub package. No{" "}
              <code class="inline-code">{"<img>"}</code> wrappers. No restrictions.
```
Replace the middle sentence so it reads:
```
              <code class="inline-code">@mhaadi/svg</code> exposes a single component —{" "}
              <code class="inline-code">{"<SVG>"}</code> — that resolves SVG content from any source,
              sanitizes unsafe markup, and renders it inline. On the web (React, Vue, Svelte) it renders a
              real <code class="inline-code">{"<svg>"}</code> DOM element; React Native renders a
              react-native-svg tree and Flutter renders via flutter_svg. Available for
              <strong class="text-[#e8e8e8]"> React, React Native, Vue, Svelte</strong> via subpath exports
              on a single npm package, and for <strong class="text-[#e8e8e8]">Flutter</strong> via the
              separate <code class="inline-code">svg_flutter</code> pub package. No{" "}
              <code class="inline-code">{"<img>"}</code> wrappers on the web adapters.
```

Note the last sentence changed from "No `<img>` wrappers. No restrictions." to
"No `<img>` wrappers on the web adapters." — because RN/Flutter don't use
`<img>` either, but "No restrictions" was the overstatement being removed.

**Verify**: `pnpm -F web run check-types` → exit 0.

### Step 4: Remove the false `SvgName` paragraph (docs.astro)

In `apps/web/src/pages/docs.astro`, delete lines 1010-1014 (the `<p>` block
after the "Dynamic icon gallery" React example). The example itself
(lines 992-1009, the `CodeBlock` with `const icons: SvgName[] = [...]`) stays —
`SvgName` is a valid type (it's `string`), so the example compiles. Only the
explanatory paragraph claiming it's a literal union is false.

Remove:
```
                <p class="mt-3 text-sm text-zinc-muted">
                  <code class="inline-code">SvgName</code> is a string literal union derived from the SVGs
                  present in <code class="inline-code">src/assets/svg/</code> at build time. It gives you
                  autocompletion and catches typos.
                </p>
```

Do not replace it with anything. The example stands on its own as "typed name
usage". (If a future plan delivers a real literal union — direction D1 —
re-add the claim at that time.)

**Verify**: `pnpm -F web run check-types` → exit 0, and the `SvgName` hint is
unchanged (it's not a hint; only `flutterNotes` was). `grep -n "literal union" apps/web/src/pages/docs.astro` → no matches.

### Step 5: Remove the dead `flutterNotes` declaration (docs.astro)

In `apps/web/src/pages/docs.astro`, delete lines 34-38:
```
const flutterNotes = [
  "svg_flutter is a separate pub package and is not a subpath of @mhaadi/svg.",
  "It depends on flutter_svg (peer) and http for remote fetching.",
  "Sanitization is performed against the raw markup before passing to SvgPicture.string.",
];
```
These facts are already covered in the Installation, Framework Specifics, and
Source Types sections, so removing the unused variable loses nothing.

**Verify**: `pnpm -F web run check-types` → exit 0, **0 hints** (the `flutterNotes` ts(6133) hint is gone). Confirm with: the `astro check` output's "Result" line should read `- 0 hints`.

### Step 6: Verify README files and edit only if false claims are present

Read `packages/svg/README.md` and root `README.md`. Check for:
- "across every adapter" / "every framework" attached to a capability that's actually web-only (inline `<svg>` DOM, full SVGProps forwarding, onClick/className).
- Any claim that `SvgName` is a literal union or offers autocompletion.

`packages/svg/README.md` (already read during recon) does **not** make the
"across every adapter" or "every attribute" claim verbatim — its "Inline SVG
rendering for React, React Native, Vue, and Svelte" intro is accurate, and
the API table is accurate. **Do not edit it unless you find a false claim.**
Root `README.md` is a short package table + scripts list — also accurate. **Do
not edit unless you find a false claim.**

If either file is clean, report "no README edits needed" in your final report.
If you find a false claim, fix it with the same qualification style and note
the exact line in the report.

**Verify**: `pnpm -F web run check-types` → exit 0. `pnpm -F web run build` → exit 0 (the site builds with the edited copy).

### Step 7: Full verification

**Verify**:
- `pnpm -F web run check-types` → exit 0, **0 errors, 0 warnings, 0 hints** (the `flutterNotes` hint is gone).
- `pnpm -F web run build` → exit 0 (both `/index.html` and `/docs/index.html` generate).
- `grep -rn "across every adapter\|every adapter" apps/web/src/pages/index.astro` → no matches (the over-broad phrase is gone).
- `grep -rn "Every standard SVG attribute\|full prop forwarding" apps/web/src/pages/` → no matches in the false-claim form (the qualified "React forwards every SVGProps attribute" is fine; ensure no lowercase "full prop forwarding" promise remains — the docs overview no longer says "with full prop forwarding").
- `grep -n "literal union" apps/web/src/pages/docs.astro` → no matches.
- `grep -n "flutterNotes" apps/web/src/pages/docs.astro` → no matches.

## Test plan

- No automated tests for docs copy. Verification is `astro check` (0 hints) and
  `astro build` (both pages generate). The grep checks prove the false claims
  are gone.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm -F web run check-types` exits 0 with **0 hints** (flutterNotes removed)
- [ ] `pnpm -F web run build` exits 0
- [ ] `grep -n "across every adapter" apps/web/src/pages/index.astro` → no matches
- [ ] `grep -n "literal union" apps/web/src/pages/docs.astro` → no matches
- [ ] `grep -n "flutterNotes" apps/web/src/pages/docs.astro` → no matches
- [ ] `grep -n "renders a true" apps/web/src/pages/docs.astro` → no matches (the "renders a true `<svg>` element with full prop forwarding" sentence is gone)
- [ ] No files outside the in-scope list are modified (`git status`) — README files only if a false claim was found
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The line numbers in "Current state" don't match the live file (Plans
  002/003/004/006 shouldn't touch these Astro files, but verify). Re-locate
  the strings by grepping for the exact phrases (`Renders actual <svg>`,
  `Every standard SVG attribute`, `renders a true`, `literal union`,
  `flutterNotes`) and adapt.
- `astro check` reports a **different** hint/error after your edits (not the
  flutterNotes one you removed) — report it; don't fix unrelated issues.
- You find a false claim in `packages/svg/README.md` or root `README.md` that
  this plan didn't enumerate — fix it with the same qualification style and
  note the exact file:line in your report. If the claim is ambiguous, STOP and
  report rather than rewriting marketing copy on your own judgment.
- The `{"<svg>"}` JSX-escaping in the docs overview doesn't render correctly
  after your edit (check the built `/docs/index.html`) — report the render
  glitch; don't ship broken HTML.

## Maintenance notes

- **The `SvgName` literal-union claim is removed, not implemented.** If
  direction D1 (typed union from the Vite glob) is ever delivered, re-add the
  doc paragraph at that time and have the example exercise autocompletion.
  Until then `SvgName` is `string` and the docs must not imply otherwise.
- **"No `<img>` wrappers" is now scoped to web adapters.** If someone later
  adds an `<img>`-based fallback adapter, update this sentence again.
- **Reviewer focus:** read the four edited passages in the built HTML (open
  `dist/index.html` and `dist/docs/index.html` or run `pnpm -F web run
  preview`). Confirm the qualification reads naturally and no escaping broke.
  The grep checks prove the false phrases are gone; the build proves the page
  still renders.
