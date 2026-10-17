# Plan 005: Sprite deduplication (`<symbol>` + `<use>`)

> **Executor instructions**: This is a **design plan**, written from the
> actual code in `packages/svg`. Read it fully before starting. The design
> resolves most of the questions that caused this feature to be deferred
> in the 0.3.0 cycle, but it deliberately leaves a few decisions to the
> maintainer — see "Open questions for the maintainer". If the code no
> longer matches the excerpts pinned in "Current state", treat that as a
> drift condition and re-derive the affected section before proceeding.

> **Drift check (run first)**:
> `git log -5 --oneline main -- packages/svg/src/core/ids.ts packages/svg/src/svg.tsx packages/svg/src/core/colors.ts`
> then skim those files. This plan was written against main `3956e65`
> (2026-10-17) while a mask-color fix and a hostile-SVG test corpus were
> in flight on other branches. `colors.ts` mask handling is expected to
> change; this plan pins nothing to its exact shape (see "Interaction
> with `<mask>`/`<clipPath>`").

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MEDIUM (behavior change: dedup silently changes styling and
  per-instance ID semantics, so it must be opt-in)
- **Depends on**: nothing, for this plan. Implementation depends on the
  mask-aware color override item in `TODO.md` — see the cross-dependency
  note in "Interaction with `<mask>`/`<clipPath>`".
- **Category**: performance
- **Planned at**: commit `3956e65`, 2026-10-17
- **Filed as**: issue #18 (deferred during 0.3.0 because sprites
  complicate (a) per-instance styling and (b) the internal ID-rewrite
  pass)

## Why this matters

Today every `<SVG>` instance re-emits the full inline markup of its
source. Ten instances of one icon produce ten copies of every node, every
`<defs>` entry, every gradient stop, every `<mask>`. DOM cost scales
linearly with copies: N instances of a K-node icon pay N·K elements in
parse time, insertion time, and layout memory. This is the problem
svg-sprite-loader solves by compiling N copies into one `<symbol>` plus
N cheap `<use href="#id">` references. The render path involved is:

```tsx
// src/svg.tsx:138-151 (same shape in every framework file)
<svg ... dangerouslySetInnerHTML={{ __html: presented.innerHTML }} />
```

Three properties of this repo make dedup tractable where it would not be
for arbitrary SVG handling:

1. **We own the namespace, not the user.** `scopeSvgNodeIds`
   (`src/core/ids.ts:106`) already rewrites every internal ID into a fresh
   per-instance namespace before render. A shared symbol needs exactly one
   namespace (one scoping pass with a sprite-wide prefix); nothing in user
   markup collides with it because we generate the prefixes
   (`createSvgId`, `ids.ts:33`). This was the headline blocker in 0.3.0,
   and reading `ids.ts` shows the rewrite pass is prefix-parameterized
   already — no new ID machinery is needed.
2. **The parsed AST is already cached and shared.** `ensureParsedSvg`
   plus the lazy `innerHTML` getter (`src/core/sanitize.ts:28-30`) mean
   concurrent instances already share one parsed tree. A registry keyed on
   `ParsedInlineSvg` object identity builds on identity sources the code
   already relies on (`rootOverrides` in `ids.ts:6`, `overrideCache` in
   `colors.ts:109`).
3. **External `<use>` references are dead.** Cross-document
   `<use href="sprite.svg#icon">` was removed in Chromium in 2017. Any
   sprite must be hoisted into the *same document* as a hidden
   `<svg>` host. This is a hard wall, not a design choice: it rules
   out file-based sprites and constrains the architecture below.

### When dedup does not matter (or actively hurts)

Be honest about the no-op and negative cases, because the default inline
behavior is load-bearing for current users:

- **Few instances, small icons** — typical icon usage of 1–3 instances of
  1–5 node icons saves almost nothing and adds a second render path
  (registry, host, `<use>` branch) to test and maintain.
- **CSS that targets inner elements.** Selectors like
  `.icon path.cls-1:hover { fill: red }` work today because markup is
  inline. Content cloned by `<use>` lives in a closed shadow tree; light
  DOM selectors do not match it. Only inheritable properties flow through
  the `<use>` boundary (fill/stroke inherit unless overridden on the
  element itself). Dedup silently changes the styling contract. This —
  not DOM savings — is the real cost of sprites, and it is the reason
  dedup must never be auto-enabled by instance count (see "API surface").
- **Per-instance `fill`/`stroke` props.** `withSvgColorOverrides`
  (`colors.ts:120-149`) mutates a cached copy of the node tree per
  instance. It works because each instance holds an independent tree.
  Inside one shared symbol, per-instance attribute mutation is impossible;
  only inherited paint can reach the shadow tree.
- **Per-instance SMIL/animation state.** `begin`/`end` rewriting
  (`ids.ts:54-65`) exists so each instance gets its own animation
  timeline tied to its own namespace. A deduped symbol holds exactly one
  timeline shared by every `<use>`.
- **Mutation-based integrations.** Users who `querySelector` into the
  markup and mutate gradient stops or animation targets per instance get
  a shared copy that no longer reacts.

So: dedup is for lists, feeds, map markers, and sticky/scroll surfaces
with tens of identical icons. It should not chase the "two identical
logos" case.

## Current state (pinned excerpts)

Render pipeline in `src/svg.tsx`, steps 1–2 shared conceptually by
Svelte/Vue/Solid/Native (their own file each), Astro differing slightly
(build-time):

### 1. Parse + per-instance ID scoping (`ids.ts` + `svg.tsx:91`)

```ts
const scoped = uniqueIds ? scopeParsedSvgIds(inline, prefix) : inline;
setContent(scoped);
```

`scopeSvgNodeIds(root, prefix)` (`ids.ts:106-120`) walks the AST once per
instance, collects every `id` attribute into a map
`original → "${prefix}-${k}"` where `prefix = createSvgId()` is a fresh
`svg-<random>-<n>` per rendered element, then calls `rewriteNodeIds`,
which rewrites `id` attrs and every reference to those ids across:

| Reference surface        | Where |
| ------------------------ | ----- |
| `href` / `xlink:href`    | `ids.ts:35-39` |
| `aria-labelledby` & co   | `ids.ts:40-53` |
| SMIL `begin`/`end`       | `ids.ts:54-65` |
| CSS `url(#x)` in `style` | `ids.ts:66-74` (escaped-CSS aware decode/encode) |
| `<style>` blocks         | `ids.ts:77-90` (`rewriteStylesheet`) |

Note: `scopeParsedSvgIds` (`ids.ts:143-149`) exposes the produced map as
`ParsedInlineSvg.ids`, and the component uses it to rewrite the
wrapper's own attributes (`svg.tsx:147-149`). That map is the public
contract the sprite design plugs into.

### 2. Per-instance color overrides (`colors.ts`)

```ts
const colored = withSvgColorOverrides(content, { fill, stroke });
```

`withSvgColorOverrides` skips nodes whose paint is a `url(...)` reference
(gradients, mask-linked paints — `isUrlRef`) or `none`, and rewrites
everything else (`overrideNode` walks every node; `overrideStyleText`
handles fill/stroke declarations inside style attributes, preserving
`!important`). The result is a fresh mutated tree cached per
`(content, overrides)` pair (`colors.ts:109`, LRU capped at
`MAX_CACHED_OVERRIDES`). This works today *because* each instance holds
an independent tree — the seam that breaks under sprites.

### 3. Root id + presentation (`ids.ts:122-141`, `presentation.ts`, `svg.tsx:126`)

```ts
const presented = present(withSvgRootId(colored, rest.id), { title, desc });
```

`withSvgRootId` renames the markup's root `<svg>` id so references to it
keep resolving, and mends the ids map. `present({ title, desc })` adds
`<title>`/`<desc>` **as wrapper-level children**
(`presentation.ts:84-103` unshifts them onto the root node children) —
they are per-instance and live outside the shadow tree. That is the
accessibility seam, and it survives sprite mode unchanged (see
"Architecture"). Then the full tree is serialized per instance.

## Architecture

One hidden, per-document sprite host owns every deduped symbol:

```html
<body>
  <svg id="svg-sprite-host" style="display:none" aria-hidden="true">
    <symbol id="..." viewBox="...">
      <!-- scoped, sanitized tree of the source, minus title/desc -->
    </symbol>
    ...
  </svg>
</body>
```

Per-framework delivery: React `createPortal` into `document.body`
(created lazily on the first deduped instance), Vue `<Teleport>`,
Svelte/Solid imperative mount. Each deduped instance renders:

```tsx
<svg {...rootProps, aria, viewBox, size}>
  <title>…</title>   {/* per-instance, wrapper-level */}
  <desc>…</desc>
  <use href={`#${symbolId}`} />
</svg>
```

The title/desc stay at wrapper level (as they are today) and are
stripped from the symbol content at registration time. Reason to strip:
a `<title>` as first child of a `<symbol>` also becomes the hover
tooltip of every used subtree; keeping per-instance titles at wrapper
level avoids that double-meaning and matches the existing
`presentation.ts` flow exactly.

### The sprite registry

`packages/svg/src/core/sprite.ts`. Keyed by `ParsedInlineSvg` object
identity (a `WeakMap`), the same identity the override cache already
uses. Do not key on the markup string: it would re-serialize or
re-hash per instance for no benefit given the AST is already shared by
identity. Structure sketch:

```ts
type SpriteSymbol = {
  symbolId: string;          // one createSvgId() per registry entry
  ids: ReadonlyMap<string, string>;  // original markup id → symbol-scoped id
  node: SvgNode;             // scoped tree, title/desc stripped
};
```

Notes:

- `symbolId` comes from a **dedicated** `createSvgId()` per registry
  entry, not from "the first instance's prefix". First-instance
  ordering is an avoidable dependence: if instance A unmounts while B
  stays, the symbol must survive as long as any `<use>` exists. A
  registry-owned prefix makes the lifetime simple: the symbol (and its
  namespace) live from first deduped registration to last unmount, and
  the WeakMap identity key tracks the parsed content, whose lifetime is
  already correct.
- `ids` (original → symbol-scoped) is exposed to the same consumers
  that consume `content.ids` today: `rewriteSvgAttributes(rootProps,
  ids)` (`ids.ts:151-163`) rewrites wrapper attributes like
  `aria-labelledby` so references into the markup's IDs keep resolving.
  With the sprite map, those references resolve into the symbol
  namespace. No format change, only a different map.

### What ids.ts needs (the ID-rewrite coexistence answer)

Nothing in the rewrite logic. `scopeSvgNodeIds` is prefix-parameterized,
so building the sprite's canonical tree is:

```ts
const { node, ids } = scopeSvgNodeIds(content.node, symbolPrefix);
```

and `rewriteNodeIds`, `rewriteStylesheet`, `rewriteSvgValue`, and
`rewriteSvgAttributes` all apply unchanged. No new machinery, no
second rewrite pass. The one **real correctness requirement** is a
mutex rule, and it must be tested, not hoped for:

> When an instance renders in sprite mode, the per-instance passes
> (`scopeParsedSvgIds`, `withSvgColorOverrides` on the symbol content,
> and `withSvgRootId` on the symbol content) must not run on the
> already-scoped symbol tree. Running a scoping pass twice would
> double-prefix ids and orphan references. The symbol tree is scoped
> exactly once, at registration.

Also important: if `uniqueIds={false}`, the instance today skips
scoping. Under sprite mode, ids must be scoped into the symbol
namespace regardless (otherwise sources share ids across the document
raw). Documented as a contract test in M1.

### `<use>` rendering path (per framework)

| Surface | Sprite host delivery | Instance render |
| ------- | ------------------------ | --------------- |
| React   | `createPortal(host, document.body)`, lazy mount | `<use href={…}>` as a real React element (not `dangerouslySetInnerHTML`), SVG2 `href`, no `xlink:href` |
| Vue     | `<Teleport to="body">` inside a `SpriteHost` component used by the deduped branch | attribute rewrite path unchanged (`src/vue/SVG.ts:209-226`) |
| Svelte  | imperative append outside the component tree (`src/svelte/runtime.ts:41` scoping stays per-instance otherwise) | `rewriteSvgAttributes` shared path (`src/svelte/SVG.svelte:84`) |
| Solid   | same imperative pattern (`src/solid/index.ts:86`) | shared path |
| Native  | out of scope for M1 (see below) | — |
| Astro   | out of scope (see below) | — |

For each framework file, the diff is contained: the instance render
swaps `dangerouslySetInnerHTML` for a `<use>` child, and
`rewriteSvgAttributes` receives the sprite's ids map instead of a
per-instance map. The `present()` title/desc step continues to run at
wrapper level.

### Interaction with `<mask>`/`<clipPath>`

Under sprites, masks and clip paths inside the symbol tree are just
content. The subtle part is reference resolution: inside a `<use>`
shadow tree, `url(#…)` and `href="#…"` references resolve against the
**document**, not the shadow tree. Since the sprite host lives in the
document and its ids are uniquely namespaced, a mask/gradient/filter
referenced from symbol content resolves correctly. This is the same
mechanism as any other url() reference, not a special case.

> **Cross-dependency note (for the executor and maintainer).** A
> parallel PR is changing mask handling, and the `TODO.md` item
> "mask-aware color override" is open. Do not couple this design to the
> in-flight shape of `colors.ts`. The one interaction that matters:
> if mask-aware color overrides mutate per-node attributes inside a
> `<mask>`, that mutation path must not be applied per-instance to a
> **shared** symbol tree — it would leak across every `<use>` of that
> symbol. Conservative rule for the sprite path (recommended for M1):
>
> **When `fill` or `stroke` props are set, the instance bails out of
> sprite mode and renders inline**, exactly as it does today. Do not
> attempt to apply overrides to symbol content in M1. Per-instance
> color inside sprite mode is real and valuable, but it needs the CSS
> custom-property mode (M3), not attribute mutation on shared nodes.

### Styling coupling (the honest contract change)

State what survives and what breaks, so nobody discovers this in a bug
report:

- Works the same: `.icon { fill: blue }` (and any styling of the root
  element), `currentColor` flows (color is inherited through `<use>`),
  inherited properties (opacity, and fill/stroke where not overridden
  on inner elements), sizing via wrapper.
- Breaks silently in M1: descendants selectors reaching inner elements
  (`path.cls-1:hover`), per-node animation targets, any relying on
  each instance carrying an independently-mutable copy of defs
  (per-instance gradient stop mutation).
- New capability worth a line in the docs: CSS-custom-property paint —
  sources authored with `fill="var(--icon-accent, currentColor)"` keep
  working per-instance through the `<use>` boundary, because custom
  properties inherit into shadow trees. This is the standard escape
  hatch for sprite libraries and becomes the supported per-instance
  coloring mode in M3.

`uniqueIds={false}` remains a power-user escape hatch that disables
scoping; sprite mode is orthogonal to it and must opt in separately.

## API surface (decision)

Opt-in prop. Explicitly NOT automatic dedup by instance count.

```ts
export type SvgProps = {
  // ...existing props
  dedupe?: boolean;   // default false
};
```

**Deciding against auto-dedup.** Auto-dedup past some instance
threshold is tempting because it would make issue #18 disappear for
users of lists without an API change. It is rejected, deliberately:

1. **The styling-contract flip is invisible until it breaks.** A panel
   showing 3 icons inline goes to 20 after a user search, and selectors
   that reached inner elements stop matching. Silent, threshold-based,
   depends on rendering shape rather than use case — the worst class of
   behavior change.
2. **Instance count is not a stable signal.** Strict Mode
   double-rendering, HMR, list reorders, and virtualization can flip the
   threshold on and off, causing repeated mount/unmount cycles for the
   sprite host or flip-flopping between render modes during normal UX.
3. **Opt-in keeps two clean, fixed-behavior code paths.** With
   `dedupe` explicit, the sprite path is testable as a small state
   machine (register once → share → release on last unmount), instead
   of depending on how many siblings are being rendered right now.

If the maintainer later wants a "just works" default, the right shape is
a host-level configuration: at library init, an application or icon
registry can opt in globally for curated packs where every source is
known to be `currentColor`-flat and styling is done through inheritance.
Not part of this plan.

## Milestones

Each section is shippable and independently verifiable. Tests live in
`packages/svg/src/**/*.test.ts` (vitest, per plan 001's setup) unless
otherwise specified, following the repo test layout for
`packages/svg`.

### M1 — core registry + React integration (`feat(svg)`)

In-scope files: `src/core/sprite.ts` (new), `src/core/index.ts`
(re-export), `src/svg.tsx` (dedupe branch), plus tests. No logic
changes expected in `src/core/ids.ts` (only a narrow type export if
annotating sprite registry types helps readability).

1. `src/core/sprite.ts`: registry (WeakMap keyed on
   `ParsedInlineSvg`), `buildSprite` (one
   `scopeSvgNodeIds(content.node, spritePrefix)`, strip
   title/desc, render to innerHTML once, memoize by node identity via
   a second WeakMap), `getOrCreateSymbol`, release-on-last-unmount
   accounting for `<use>` users of that symbol (a refcount per registry
   entry, since DOM-side `<use>` can outlive the React instance that
   registered it).
2. `src/svg.tsx`: `dedupe` prop; when true, render `use` instead of
   `dangerouslySetInnerHTML`, wire `rewriteSvgAttributes(rootProps,
   sprite.ids)`, keep `present()` for title/desc. Keep per-instance
   prefixes for `uniqueIds` untouched when `dedupe` is false — no
   behavior change for existing users.
3. Tests (minimum set, in `src/**/*.test.ts`):
   - Two instances of a source with an external `<mask>` reference,
     `dedupe`: exactly one `<symbol>` in the document, two `<use>`
     elements referencing it, the mask's scoped id present once and
     document-unique.
   - `fill`/`stroke` props set with `dedupe`: instance renders inline
     (bail-out rule) — assert both orderings (inline-first, then
     dedupe crossing the threshold in either direction).
   - `title`/`desc` present per-instance at wrapper level, absent from
     symbol content.
   - `uniqueIds={false}` with `dedupe`: symbol ids are still scoped
     (no raw ids escape into the shared tree).
   - aria `labelledby` rewrite: an `aria-labelledby` in wrapper props
     referencing a markup id resolves to the symbol-scoped id.
   - Registry release: unmount all deduped instances → symbol node gone
     from host; remount → re-registered.

### M2 — Vue, Svelte, Solid ports (`feat(svg)`)

Mirror M1's contract into `src/vue/SVG.ts`, `src/svelte/*`,
`src/solid/*` using each framework's portal primitive. Verify with the
same behavioral test table as M1 step 3. Native and Astro stay out of
scope (listed below).

### M3 — styling mode contract (`feat(svg)`)

Formalize the styling contract in docs (`apps/web` pages) and add the
CSS-custom-property paint mode as the documented per-instance-coloring
path inside sprite mode. Include the styling survival table (above) in
the docs, verbatim or in spirit, so the contract change is explicit.
Pin `viewBox` propagation from symbol to wrapper with one test (the
symbol owns the viewBox; the wrapper must re-declare it for clamping
and for `size`/`width`/`height` scaling).

### M4 — optional follow-ups (does not block anything)

- Host-level auto-dedup mode for curated icon packs (explicitly out of
  component scope, per "API surface").
- Native (`src/native.tsx`) — react-native-svg has `<Use>`, but a
  sprite host needs an app-level mount strategy (no `document.body` in
  RN). Its own discussion.
- Astro — runtime portals do not exist in SSG output; an Astro build
  that wants sprite dedup needs a build-time collector (different
  architecture, different plan if it is ever desired).

## Out of scope, explicitly

- `apps/web` docs site: a page for `dedupe` ships with the milestone
  that ships the prop (M1 for announcement-level doc, M3 for the
  styling contract).
- `packages/svg/src/native.tsx` (native implementation) — see M4.
- `svg_flutter`: the Dart package renders strings through its own
  sanitizer and has no per-instance ID scoping pass; sprite dedup there
  would be simpler in principle but is a different package with
  different constraints. Zero work in this plan.
- Sprite file formats / external `.svg` sprite sheets: excluded by the
  Chromium restriction stated in "Why this matters".

## Open questions for the maintainer

1. **Prop name and shape.** `dedupe?: boolean` vs `sprite?: boolean`
   vs a `mode?: "inline" | "sprite"` enum. Preference is a boolean: a
   mode enum invites speculating about a middle "auto" mode that the
   "API surface" section argued against.
2. **Sprite host mount target.** Appending a hidden `<svg>` to
   `document.body` from React is correct but crosses the React root.
   Acceptable? (svg-sprite-loader does exactly this; it is the simplest
   correct option and what M1 assumes.)
3. **Do different `sanitize` settings share a symbol?** Two `<SVG>`s
   with the same `src` but different `sanitize` flags produce different
   parsed trees, so the registry would hold two symbols for one
   logical source. Fine, but worth confirming the maintainer agrees
   they should stay separate rather than being forced together.
4. **Regex/text-based consumers.** Users matching on the rendered HTML
   string (checks for a specific inner element) break under sprite
   mode. Any known consumers? They simply do not enable `dedupe`, but
   it goes in the docs if it is a pattern.
5. **The color-override bail-out.** Confirm the conservative rule (no
   sprite rendering when `fill`/`stroke` props are set) is acceptable
   for M1, with the CSS custom-property mode landing in M3 as the
   real fix.
6. **Testing framework.** Sprite registry tests manipulate
   `document.body` directly. Pin down the setup/teardown pattern
   (reset the registry between tests, wipe the host node) before M1, so
   tests are deterministic under vitest watch mode.

## Verification

All from repo root (no version bump needed for the plan itself):

- `pnpm install`
- `pnpm run check-types`
- `pnpm run lint`
- `pnpm run test`
- `pnpm run build`
- For each milestone that modifies `packages/svg/src`: changelog
  bullets under the single `## 0.4.0` heading in
  `packages/svg/CHANGELOG.md` — version labelling is unified into one
  0.4.0 release, so milestones do NOT bump the package version.

## Done criteria for THIS plan (the deliverable is the plan)

- [ ] This file exists, committed on branch `advisor/005-sprite-dedup`.
- [ ] `plans/README.md` has row 005 in the status table, status DONE
      (plan delivered; implementation tracked under M1 and beyond).
- [ ] No files under `packages/svg/src` modified by this task (so no
      version bump and no changelog entry are required).
