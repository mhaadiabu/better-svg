# TODO

## TODO

Features established SVG tools have that @mhaadi/svg doesn't. Ordered by how much they hurt us in real usage, not by novelty. Companion context: the 2026-10 landscape review in this session's notes.

> Board status as of 2026-10-17: every item below shipped in or alongside the unified 0.4.0 release, except sprite deduplication, which ships as a design plan by choice. Status lines on each item carry the PR references.

### Performance

- [x] Sprite deduplication for repeated icons
      Icon sets rendered many times on one page re-emit full markup per instance. Build-time tools
      (svg-sprite-loader, vite-svg-sprite, astro-icon) dedupe into `<symbol>` + `<use>` so N copies
      cost one definition. Filed as [issue #18](https://github.com/mhaadiabu/better-svg/issues/18),
      deferred during 0.3.0 because sprites complicate per-instance styling and internal ID
      references. Revisit once the ID-rewrite pass and sprites can coexist (per-scoped `use` hrefs).
      Status: designed, not implemented — see [plan 005](./plans/005-sprite-deduplication.md)
      (PR #33). The plan defers implementation to its own milestone after 0.4.0.

- [x] Build-time mode for known-static sources
      SVGR / unplugin-icons / astro-icon win on zero runtime cost: markup parsed once at build,
      emitted as framework components, tree-shaken, no fetch at mount. We are runtime-only by
      design, so icons known at build still pay fetch+parse+transform at request time. A build-mode
      plug-in (or an accept-a-precompiled-tree escape hatch) would let SSR pages skip the whole
      pipeline for static assets without giving up the runtime path for dynamic sources.
      Status: shipped — PR #39 (`precompiled` seam + build-time precompilation), verified to
      compose with the SVGO pass (`svgo: true, precompiled: true` is test-pinned).

- [x] Optional SVGO pass
      Every build-time competitor ships markup optimization. We deliberately skipped it (optimizer
      can change rendering, e.g. dropping IDs or merging styles our transforms need). An opt-in,
      configurable pass after local discovery would close file-size parity. Users can run SVGO
      themselves today; the gap is that we never even hint at it in docs.
      Status: shipped — PR #38 (opt-in `svgo` pass with the curated "safe" preset, per-file
      functions, custom plugin lists, documented `preset`/`plugins` incompatibility). Also
      researched whether it could default on for this runtime; the design ("thorough" preset +
      ref-integrity checker) is safe but deliberately parked after 0.4.0 — see
      [plan 006](./plans/006-svgo-default-policy.md) (PR #40).

### Ecosystem / icon sources

- [x] Icon-set catalog access (Iconify-style)
      astro-icon and the Iconify family can pull from 200k+ published icons by collection prefix.
      Our local discovery covers the repo's own icons only. Even a thin adapter resolving
      `collection:icon-ish` names from installed npm icon packages (hugeicons, lucide, tabler,
      phosphor) would let callers stop writing `<SVG src={...import...}>` boilerplate per icon set.
      Status: shipped — PR #35 (`@mhaadi/svg/catalog`: Iconify collections, per-package SVG probes,
      alias chains, `registerCatalogIcons`). Follow-up for a later cycle: harden collection-shape
      validation (empty `{}` payloads pass; `collection.height` fallback missing).

- [x] Offline icon bundling
      Iconify lets you bundle icon data into the app so the renderer never touches the network.
      Related but distinct from build-time mode: runtime rendering, offline sources. Matters for
      RN where unconditional fetch is a poor fit.
      Status: shipped — PR #37 (`@mhaadi/svg/bundle` offline bundling, stacked on the catalog;
      format validated from the `out` extension, normalized keys, JSON.stringify serialization).

### Trust / correctness

- [x] Hostile-SVG test corpus
      DOMPurify (our closest sanitizer competitor) is battle-tested against years of reported
      bypasses and fuzzed inputs; our sanitizer was written against our own assumptions and hand
      tests. Build a corpus of known SVG smuggling vectors (script, event handlers, foreignObject,
      `<use>` with data:/remote href, CSS exfiltration, namespace trickery, entity tricks) and make
      it a regression suite before 0.4.
      Status: shipped — PR #34 (corpus with 10 verified bypass vectors) plus PR #36 (the fixes;
      each vector now a passing converted test, including the `data:image/svg+xml-compressed`
      subtype gap the external audit caught post-corpus). Noted for a future hardening plan:
      `<image>`/`<feImage>` still accept external `https://` SVG documents (pre-existing; not a
      regression).

- [x] Mask-aware color override
      0.3.1's fill/stroke transform rewrites paints inside `<mask>` and `<clipPath>`, so passing a
      color to a masked icon can hide its artwork. Greptile flagged this as P1 on PR #28; it's the
      one review finding never addressed. Excluding mask/clipPath subtrees from display-color
      overrides matches what the browser would do and shrinks the risk the hardening pass above
      has to cover.
      Status: shipped — PR #32 (gate hoisted to `overrideNode`'s top so mask/clipPath elements are
      untouched on their own attributes too, not just in their subtrees; that re-emergence path
      was caught by the external audit's merge-composite re-review and fixed before merge with
      regression tests pinning it).

## Post-board follow-ups (candidates for plans 007+)

From the final external audit, not blocking the 0.4.0 merge:

- Sanitizer pass 2: external `https://` SVG documents still loadable via `<image>`/`<feImage>`;
  decide on an allowlist policy mirroring the `<use>` restriction.
- Catalog hardening: reject well-formed-but-empty collection JSON (`{}` currently passes), fix
  the `collection.height` fallback when only `height` is defined.
- SSR observability: `seedPrecompiled`'s xmldom parse failure is silently swallowed; "warn once"
  would help debugging.
- Docs hygiene after the merge chain: one `pnpm run check` reformat pass on README/plans (non-blocking).
- SVGO default-on (from plan 006) once 0.4.0's opt-in behavior is seen in the wild.
