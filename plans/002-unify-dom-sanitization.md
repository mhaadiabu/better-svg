# Plan 002: Unify DOM sanitization across React/Vue/Svelte

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7e1b3b6..HEAD -- packages/svg/src/svg.tsx packages/svg/src/vue/SVG.ts packages/svg/src/svelte/runtime.ts packages/svg/src/core/index.ts packages/svg/src/core/ast.ts packages/svg/src/core/url.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-vitest-harness-core-tests.md
- **Category**: security, tech-debt
- **Planned at**: commit `7e1b3b6`, 2026-06-23

## Why this matters

The DOM-based sanitization that React, Vue, and Svelte use is **copy-pasted
three times and has diverged into two separate security bugs**:

1. **Vue & Svelte keep `javascript:` URLs in `href`/`xlink:href`.** Their
   guard is `/^(#|\/|[a-zA-Z][a-zA-Z0-9+.-]*:)/.test(attr.value)` — but
   `javascript:` *matches* that regex (it's a scheme), so the unsafe URL is
   *kept* instead of removed. React uses `isSafeUrl()` (an allowlist) and
   correctly drops it.
2. **Vue & Svelte over-strip safe `url(#…)` CSS refs.** Their style guard is
   `/url\(/i.test(attr.value)` — any `url(...)` triggers removal, including
   legitimate `url(#gradient)` fill/clip references. React uses
   `hasUnsafeUrl()` which only strips unsafe URLs.

Both bugs exist because each adapter re-implemented sanitization inline
instead of calling the shared core. This plan extracts one shared
`parseInlineSvg()` into `core/`, routes all three DOM adapters through it, and
deletes the three divergent copies. It also moves Vue's per-instance cache to
a module-level cache (matching React/Svelte) so the documented "in-memory
caching in every adapter" claim is true.

## Current state

**React** — `packages/svg/src/svg.tsx:34-81` — `parseSvgMarkup` (local). Uses
`hasUnsafeUrl` and `isSafeUrl` (imported from `./core`, line 5). This is the
**correct** reference implementation of the DOM sanitize logic. Excerpt of the
sanitize block (lines 42-65):
```ts
  if (sanitize) {
    svg
      .querySelectorAll("script, foreignObject, iframe, object, embed")
      .forEach((node) => node.remove());
    const walker = svg.ownerDocument.createTreeWalker(svg, NodeFilter.SHOW_ELEMENT);
    let current: Element | null = svg;
    while (current) {
      for (const attr of Array.from(current.attributes)) {
        const name = attr.name;
        if (name.startsWith("on")) { current.removeAttribute(name); continue; }
        if (name === "style" && hasUnsafeUrl(attr.value)) { current.removeAttribute(name); continue; }
        if (name === "href" || name === "xlink:href") {
          if (!isSafeUrl(attr.value)) current.removeAttribute(name);
        }
      }
      current = walker.nextNode() as Element | null;
    }
  }
```
React returns `ParsedSvg` with `style?: React.CSSProperties` (parsed via the
local `parseInlineStyle`, lines 21-32) and `innerHTML`.

**Vue** — `packages/svg/src/vue/SVG.ts:54-110` — `parseSvgMarkup` (local, divergent). The buggy lines:
```ts
        if (name === "style" && /url\(/i.test(attr.value)) {   // line 75 — over-strips url(#…)
          current.removeAttribute(name);
          continue;
        }
        if (name === "href" || name === "xlink:href") {
          if (!/^(#|\/|[a-zA-Z][a-zA-Z0-9+.-]*:)/.test(attr.value) && attr.value.trim() !== "") {  // line 80 — keeps javascript:
            current.removeAttribute(name);
          }
        }
```
Vue returns `ParsedSvg` with `style?: string` (joined via `toCamelCaseStyle` +
`Object.entries(...).join(";")`, lines 94-102). Vue's cache is a **per-instance**
`const cache = new Map<string, string>()` inside `setup()` (line 149) — not
shared across instances.

**Svelte** — `packages/svg/src/svelte/runtime.ts:49-105` — `parseSvgMarkup`
(**exported**, divergent). Identical bugs to Vue at line 70 (`/url\(/i.test`)
and line 75 (`/^(#|\/|[a-zA-Z]...):/`). Svelte's `svgCache` is module-level
(line 32) — already correct. **Important:** `parseSvgMarkup` is `export const`
and is re-exported as a public API symbol via `packages/svg/src/svelte/index.d.ts:7`
(`export { createSvgController, parseSvgMarkup } from "./runtime";`). It MUST
be preserved as an exported function — Step 6 replaces its **body** with a
thin wrapper that delegates to `parseInlineSvg`, but keeps the export and its
`ParsedSvg | null` return type so `index.d.ts` and the published types stay valid.

**Shared core** — `packages/svg/src/core/index.ts` exports `isSafeUrl`,
`hasUnsafeUrl`, `parseInlineStyle`, `toCamelCase`, `domParserAvailable`. There
is **no** shared DOM-sanitize function today.

**Native** (`native.tsx`) uses the AST-based `parseAndSanitize` (core) — a
different code path, **not in scope**. Flutter is separate (Plan 004).

Repo conventions to match:
- `ParsedSvg` types are declared per-adapter (React's has `React.CSSProperties`;
  Vue/Svelte's have `string`). The shared function returns a neutral shape; each
  adapter maps it.
- Imports from `../core` use the named-export barrel (`core/index.ts`).
- Error messages are user-facing (`"SVG markup is invalid or unavailable in
  this environment."`) — preserve them verbatim where adapters re-throw.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `pnpm install`                   | exit 0              |
| Typecheck | `pnpm check-types`               | exit 0, no errors   |
| Test      | `pnpm -F @mhaadi/svg test`       | all pass            |
| Build     | `pnpm -F @mhaadi/svg run build`  | exit 0              |
| Lint      | `npx oxlint .`                   | exit 0 (or only pre-existing infra error) |

## Suggested executor toolkit

- The vitest harness from Plan 001 is in place. New tests go in
  `packages/svg/src/core/sanitize.test.ts` and use the same import style
  (`import { describe, it, expect } from "vitest"`).

## Scope

**In scope** (the only files you should modify or create):
- `packages/svg/src/core/sanitize.ts` — **create**. The shared `parseInlineSvg`.
- `packages/svg/src/core/index.ts` — re-export `parseInlineSvg` + its type.
- `packages/svg/src/svg.tsx` — replace local `parseSvgMarkup` with `parseInlineSvg`; map `style` to `React.CSSProperties`.
- `packages/svg/src/vue/SVG.ts` — replace local `parseSvgMarkup`; replace per-instance `cache` with module-level `svgCache`.
- `packages/svg/src/svelte/runtime.ts` — replace local `parseSvgMarkup`.
- `packages/svg/src/core/sanitize.test.ts` — **create**. Characterize the shared sanitizer (the fixed behavior).

**Out of scope** (do NOT touch):
- `packages/svg/src/native.tsx` — uses the AST path; leave it.
- `packages/svg/src/core/ast.ts` `sanitizeNode`/`parseAndSanitize` — the AST sanitizer (used by Native). Do not merge the two paths in this plan; that's a larger refactor. This plan only unifies the **DOM** path.
- `packages/flutter/**` — Plan 004.
- `packages/svg/src/svg.tsx` cache write logic — Plan 003. (002 touches `svg.tsx` to swap `parseSvgMarkup`; do NOT add the cache `.set` here — 003 does that one line.)
- React effect deps (`onSvgLoad`/`onSvgError`) — Plan 006.
- Public API exports in `packages/svg/src/index.ts` — no new public exports.

## Git workflow

- Branch: `advisor/002-unify-dom-sanitization`
- Commit style: `fix(svg): unify DOM sanitization across React/Vue/Svelte`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Create the shared `core/sanitize.ts`

Create `packages/svg/src/core/sanitize.ts` with this content. It is the React
`parseSvgMarkup` logic (the correct one) extracted verbatim into a shared
function, returning a neutral shape:

```ts
import { domParserAvailable, parseInlineStyle } from "./ast";
import { hasUnsafeUrl, isSafeUrl } from "./url";

export type ParsedInlineSvg = {
  attrs: Record<string, string>;
  className?: string;
  style?: Record<string, string>;
  innerHTML: string;
};

export const parseInlineSvg = (markup: string, sanitize: boolean): ParsedInlineSvg | null => {
  if (!domParserAvailable()) return null;
  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(markup, "image/svg+xml");
  if (parsedDocument.querySelector("parsererror")) return null;
  const svg = parsedDocument.querySelector("svg");
  if (!svg) return null;

  if (sanitize) {
    svg
      .querySelectorAll("script, foreignObject, iframe, object, embed")
      .forEach((node) => node.remove());
    const walker = svg.ownerDocument.createTreeWalker(svg, NodeFilter.SHOW_ELEMENT);
    let current: Element | null = svg;
    while (current) {
      for (const attr of Array.from(current.attributes)) {
        const name = attr.name;
        if (name.startsWith("on")) {
          current.removeAttribute(name);
          continue;
        }
        if (name === "style" && hasUnsafeUrl(attr.value)) {
          current.removeAttribute(name);
          continue;
        }
        if (name === "href" || name === "xlink:href") {
          if (!isSafeUrl(attr.value)) current.removeAttribute(name);
        }
      }
      current = walker.nextNode() as Element | null;
    }
  }

  const attrs: Record<string, string> = {};
  for (const attr of Array.from(svg.attributes)) attrs[attr.name] = attr.value;

  const className = attrs.class;
  if (className) delete attrs.class;
  let style: Record<string, string> | undefined;
  if (attrs.style) {
    const parsed = parseInlineStyle(attrs.style);
    if (Object.keys(parsed).length > 0) style = parsed;
    delete attrs.style;
  }

  return { attrs, className, style, innerHTML: svg.innerHTML };
};
```

**Verify**: `pnpm -F @mhaadi/svg exec tsc --noEmit packages/svg/src/core/sanitize.ts` is not how this repo typechecks — use `pnpm check-types` after Step 2 wires the export. For now, just confirm the file exists: `test -f packages/svg/src/core/sanitize.ts` → exit 0.

### Step 2: Re-export from `core/index.ts`

Edit `packages/svg/src/core/index.ts`. Current content:
```ts
export { resolveSvgSource } from "./local";
export type { SvgName, SvgNameInput } from "./local";
export { decodeDataUrl, hasUnsafeUrl, isInlineSvg, isSafeUrl } from "./url";
export {
  parseSvgString,
  parseAndSanitize,
  parseInlineStyle,
  renderNode,
  sanitizeNode,
  splitAttributes,
  domParserAvailable,
  toCamelCase,
} from "./ast";
export type { SvgNode, SvgAttribute } from "./ast";
export { resolveMarkup, resolveSource } from "./resolve";
```
Add one line (place it after the `./url` export to keep grouping):
```ts
export { parseInlineSvg } from "./sanitize";
export type { ParsedInlineSvg } from "./sanitize";
```

**Verify**: `pnpm check-types` → exit 0.

### Step 3: Write `core/sanitize.test.ts` (the fixed-behavior characterization)

Create `packages/svg/src/core/sanitize.test.ts`. happy-dom provides `DOMParser`.
Assert the **fixed** behavior (this is what Vue/Svelte now inherit):
- `parseInlineSvg("<svg onload='x'><script>a</script><rect onclick='y' fill='red'/></svg>", true)`:
  returned `innerHTML` contains no `<script`, no `onload`, no `onclick`; `attrs` has no `on*`; `attrs` empty or only safe attrs.
- `javascript:` href: `parseInlineSvg("<svg><a href='javascript:alert(1)'><rect/></a></svg>", true)` → rendered innerHTML contains no `javascript:` (the href is stripped).
- safe href kept: `"<svg><a href='https://example.com'><rect/></a></svg>"` → innerHTML contains `https://example.com`.
- `#fragment` href kept: `"<svg><use href='#id'/></svg>"` → innerHTML contains `href="#id"` (or `xlink:href`).
- safe `url(#…)` style kept: `"<svg><rect style='fill:url(#grad)'/></svg>"` → the `style` attr is **kept** (`style` field is defined and contains `fill:url(#grad)` — note `parseInlineStyle` camelCases to `{ fill: "url(#grad)" }`).
- unsafe `url(javascript:…)` style dropped: `"<svg><rect style='fill:url(javascript:alert(1))'/></svg>"` → `style` is `undefined` (the whole style attr removed) AND innerHTML has no `style=` with `javascript:`.
- `sanitize=false`: `"<svg><script>x</script></svg>"` → innerHTML contains `<script` (sanitize off keeps it).
- `className` extraction: `"<svg class='a b'>...</svg>"` → `className === "a b"`, `attrs` has no `class`.
- malformed: `"not svg"` → `null`; `"<svg"` (unclosed, DOMParser parses leniently — assert it returns a node OR null, just assert it doesn't throw).

**Verify**: `pnpm -F @mhaadi/svg test src/core/sanitize.test.ts` → all pass.

### Step 4: Route React's `svg.tsx` through `parseInlineSvg`

In `packages/svg/src/svg.tsx`:
- Add `parseInlineSvg` to the import from `"./core"` (line 2-10). Remove now-unused imports: `hasUnsafeUrl`, `isSafeUrl`, `domParserAvailable` are **no longer used directly** in `svg.tsx` after the swap — but `toCamelCase` is used by the local `parseInlineStyle`. Keep `parseInlineStyle`, `toCamelCase` only if still referenced; remove the others to satisfy `noUnusedLocals`.
- Delete the local `parseSvgMarkup` function (lines 34-81) and the local `ParsedSvg` type (lines 12-17) — but keep a local `ParsedSvg` type alias for the React-shaped value, since `svgCache` and state use it. Define:
  ```ts
  type ParsedSvg = {
    attrs: Record<string, string>;
    className?: string;
    style?: React.CSSProperties;
    innerHTML: string;
  };
  ```
  Keep this type (it's still used by `useState<ParsedSvg | null>`).
- Keep the local `parseInlineStyle` (lines 21-32) — it returns `React.CSSProperties` and is used to convert the shared `style` map. Actually, the shared `parseInlineSvg` already calls core `parseInlineStyle` and returns `Record<string,string>`. React needs `React.CSSProperties`. The core `parseInlineStyle` returns `Record<string,string>` which is assignable to `React.CSSProperties` with a cast. So in the `runWithCached`/effect, convert:
  ```ts
  const runWithCached = (markup: string) => {
    const inline = parseInlineSvg(markup, sanitize);
    if (!inline) throw new Error("SVG markup is invalid or unavailable in this environment.");
    const parsed: ParsedSvg = {
      attrs: inline.attrs,
      className: inline.className,
      style: inline.style as React.CSSProperties | undefined,
      innerHTML: inline.innerHTML,
    };
    setContent(parsed);
    setIsLoading(false);
    onSvgLoad?.(markup);
  };
  ```
  Replace the old `const parsed = parseSvgMarkup(markup, sanitize);` call inside `runWithCached` (lines 138-144) with the above.
- Remove the local `parseInlineStyle` function (lines 21-32) if it's now unused — check: the only caller was the old `parseSvgMarkup`. After the swap, nothing in `svg.tsx` calls it. Remove it and its `toCamelCase` import if unused.

**Verify**: `pnpm check-types` → exit 0 (no unused locals). `pnpm -F @mhaadi/svg test` → all pass (the React core test from 001 + sanitize test).

### Step 5: Route Vue's `SVG.ts` through `parseInlineSvg` + module-level cache

In `packages/svg/src/vue/SVG.ts`:
- Import `parseInlineSvg` from `"../core"` (add to the existing import block, lines 11-18). Remove now-unused imports: `domParserAvailable`, `parseInlineStyle`, `toCamelCase` (check each — `toCamelCase` is still used by `toCamelCaseStyle` at line 35; `parseInlineStyle` was only used by the deleted local `parseSvgMarkup`; `domParserAvailable` was only used by the deleted local). Keep `toCamelCase`; remove `domParserAvailable` and `parseInlineStyle`.
- Delete the local `parseSvgMarkup` (lines 54-110).
- Add a module-level cache (place near the top, after imports): `const svgCache = new Map<string, string>();`
- In `setup()`, remove the per-instance `const cache = new Map<string, string>();` (line 149). Replace all references to `cache` inside `run()` with `svgCache` (lines 161, 163, 180, 186). The `doCache` parameter stays.
- The `run()` function's cached branch (lines 161-170) and fetch `.then` (lines 182-189) call `parseSvgMarkup` — replace with `parseInlineSvg`. Vue keeps `ParsedSvg` with `style?: string`, so convert:
  ```ts
  const inline = parseInlineSvg(cached, props.sanitize ?? true);
  if (inline) {
    const styleText = inline.style
      ? Object.entries(inline.style).map(([k, v]) => `${k}:${v}`).join(";")
      : undefined;
    const parsed: ParsedSvg = {
      attrs: inline.attrs,
      className: inline.className,
      style: styleText,
      innerHTML: inline.innerHTML,
    };
    state.value = { status: "ready", content: parsed, markup: cached };
    ...
  }
  ```
  Apply the same conversion in the fetch `.then` (lines 182-189). Preserve the error throw: `if (!inline) throw new Error("SVG markup is invalid or unavailable in this environment.");`
- The `mergedStyle` computed (lines 221-228) uses `state.value.content.style` (string) — unchanged, still works.

**Verify**: `pnpm check-types` → exit 0. `pnpm -F @mhaadi/svg test` → all pass.

### Step 6: Route Svelte's `runtime.ts` through `parseInlineSvg` (keep the export)

In `packages/svg/src/svelte/runtime.ts`:
- Import `parseInlineSvg` from `"../core"` (add to lines 1-8). Remove unused imports: `domParserAvailable`, `parseInlineStyle`, `toCamelCase` — but `toCamelCase` is used by the local `toCamelCaseStyle` (line 41-47). **Check whether `toCamelCaseStyle` is still used after the swap.** `toCamelCaseStyle` is a local `const` (not exported) and its only caller was the old `parseSvgMarkup` body. After replacing `parseSvgMarkup`'s body, `toCamelCaseStyle` is unused → remove it AND its `toCamelCase` import. Remove `domParserAvailable` and `parseInlineStyle` (only used by the old body).
- **Do NOT delete `parseSvgMarkup`** — it is a public export re-exported via `svelte/index.d.ts:7`. Instead, replace its **body** with a thin wrapper that delegates to `parseInlineSvg` and converts the shared `style` map to the Svelte `ParsedSvg` string shape. Keep the `export const parseSvgMarkup = (markup: string, sanitize: boolean): ParsedSvg | null => { ... }` declaration and the `ParsedSvg` type (lines 34-39, `style?: string`) unchanged.
- New body for `parseSvgMarkup`:
  ```ts
  export const parseSvgMarkup = (markup: string, sanitize: boolean): ParsedSvg | null => {
    const inline = parseInlineSvg(markup, sanitize);
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
- The `load` function's cached branch (lines 130-138) and the try block (lines 153-154) call `parseSvgMarkup` — **they now call the wrapper you just rewrote**, which delegates to `parseInlineSvg`. No changes needed at the call sites (they already call `parseSvgMarkup`); only the function body changed. Verify the call sites still typecheck against the unchanged `ParsedSvg | null` return.
- `svgCache` (line 32) is already module-level — leave it.
- Confirm `index.d.ts:7` (`export { createSvgController, parseSvgMarkup } from "./runtime";`) still resolves — `parseSvgMarkup` is still exported. **Do NOT edit `index.d.ts`.**

**Verify**: `pnpm check-types` → exit 0. `pnpm -F @mhaadi/svg test` → all pass.

### Step 7: Full verification + build

**Verify**:
- `pnpm check-types` → exit 0.
- `pnpm -F @mhaadi/svg test` → all pass (001's core tests + the new `sanitize.test.ts`).
- `pnpm -F @mhaadi/svg run build` → exit 0 (Svelte build script compiles `SVG.svelte`; the runtime change is TS, built by `tsc`).
- `npx oxlint .` → no NEW errors (the pre-existing `packages/infra/alchemy.run.ts:3` unused-import is fine; Plan 005 fixes it).
- `grep -rn "url\(/i.test\|/^(#|\\\\/" packages/svg/src/vue packages/svg/src/svelte` → **no matches** (the buggy regexes are gone).
- `grep -rn "parseSvgMarkup" packages/svg/src/svg.tsx packages/svg/src/vue/SVG.ts` → **no matches** (React and Vue's local copies are deleted). `grep -n "parseSvgMarkup" packages/svg/src/svelte/runtime.ts` → **one match** (the preserved public-export wrapper that delegates to `parseInlineSvg`). `grep -n "parseSvgMarkup" packages/svg/src/svelte/index.d.ts` → **one match** (unchanged re-export).

## Test plan

- New: `packages/svg/src/core/sanitize.test.ts` — covers `javascript:` href drop, safe href keep, safe `url(#…)` keep, unsafe `url(javascript:)` drop, `on*` drop, dangerous-tag removal, `sanitize=false` passthrough, className/style extraction. ~12 assertions.
- The 001 core tests (`ast.test.ts` `sanitizeNode` cases) still pass — they cover the AST path (Native), which is untouched.
- No component-level Vue/Svelte test needed: after consolidation the sanitize logic lives in `core/sanitize.ts`, which `sanitize.test.ts` covers directly.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check-types` exits 0
- [ ] `pnpm -F @mhaadi/svg test` exits 0; `core/sanitize.test.ts` exists and passes
- [ ] `pnpm -F @mhaadi/svg run build` exits 0
- [ ] `grep -rn "javascript:" packages/svg/src/vue packages/svg/src/svelte` returns no `javascript:`-keeping regex guards (i.e. no `/^(#|\/|[a-zA-Z]...:)/` and no `/url\(/i.test` patterns)
- [ ] `grep -rn "parseInlineSvg" packages/svg/src/core/index.ts packages/svg/src/svg.tsx packages/svg/src/vue/SVG.ts packages/svg/src/svelte/runtime.ts` → the function is imported and used in all three adapters
- [ ] `grep -n "parseSvgMarkup" packages/svg/src/svg.tsx packages/svg/src/vue/SVG.ts` → no matches (local copies deleted); `grep -n "parseSvgMarkup" packages/svg/src/svelte/runtime.ts` → one match (the preserved public-export wrapper)
- [ ] `grep -n "const cache = new Map" packages/svg/src/vue/SVG.ts` → no match (Vue cache is now module-level `svgCache`)
- [ ] `npx oxlint .` introduces no new errors
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match the live code (drift).
- After the swap, `pnpm check-types` reports `noUnusedLocals` errors you can't
  resolve by removing the genuinely-unused imports listed in the steps —
  report which symbols are still referenced and from where.
- The Svelte build (`node scripts/build-svelte.mjs`) fails because
  `SVG.svelte` imports something that was removed from `runtime.ts`. The
  `.svelte` file imports `createSvgController`, `SvelteSvgProps`, `SvgState`
  from `./runtime` — confirm those exports remain. If `ParsedSvg` is imported
  by `index.d.ts` (it is, line 8) it must stay exported from `runtime.ts`.
- A core test from 001 fails after the swap — the swap should not touch the
  core functions 001 tests; a failure means an import was incorrectly removed.

## Maintenance notes

- **The DOM path and AST path are now separate but both correct.** A future,
  larger refactor could unify them onto one AST-based sanitizer + a single
  renderer, but that risks `innerHTML` fidelity loss (the DOM path preserves
  exact serialization; `renderNode` re-serializes). Not in scope here.
- **Vue cache is now module-level**, so all Vue `<SVG>` instances on a page
  share one cache — matching React/Svelte. If an app ever needs per-instance
  cache isolation, that's a new opt-in prop, not a reversion.
- **Reviewer focus:** the `javascript:` href test and the `url(#…)` style-keep
  test are the two regression assertions that prove the bugs are fixed — read
  them carefully. Also confirm no adapter still imports `domParserAvailable`
  (it was only for the deleted local `parseSvgMarkup`).
