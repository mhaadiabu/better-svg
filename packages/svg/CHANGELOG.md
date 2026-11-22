# Changelog

## 0.5.2 (Unreleased)

### Changed

- Reduce the JavaScript needed for pages that import many static React SVGs with `?better-svg`.
- Use less memory when scanning large Vite projects and reuse catalog names when refreshing TypeScript suggestions.
- Reuse the catalog scan results for unchanged files during Vite development.
- Reuse optimized and precompiled SVG data across Vite rebuilds and load the XML compiler when an import needs it.
- Reduce work when serializing SVGs, scoping IDs, and looking up repeated or mixed sets of cached icons.
- Emit fewer JavaScript bytes for large precompiled SVG registries and reuse unchanged artwork when scoping per-instance IDs.

## 0.5.1

### Fixed

- Generate catalog autocomplete declarations inside `src` in standard Vite TypeScript projects.
- Refresh catalog icons after a Vite development reload when source references change.

## 0.5.0

### Added

- Automatically register catalog icons referenced by literal names with `svgPlugin()`. Generate TypeScript suggestions for installed collections before the first icon is used. Configure both through `catalog`. The existing `localSvgs()` alias still works.
- Generate TypeScript suggestions for the icons in a catalog bundle when `bundleCatalogIcons` writes an output file.
- Register or bundle a whole icon collection or a prefix of it with a trailing wildcard such as `lucide:*` or `lucide:arrow*`.
- Import an SVG file as a server-renderable React component with `?better-svg`. The component uses Better SVG's size, accessibility, paint override, and ID scoping props.
- Use `precompiled: "tree"` to ship a compact parsed tree. Load callbacks receive reserialized XML. Use `precompiled: true` for the original registered markup.

### Changed

- Keep unused local SVGs out of initial browser JavaScript by default. Local icons missed by the source scan load from a deferred chunk. Set `pruneLocal: false` to include the full registry up front.
- Render ready React sources in the first client commit. Root-only prop changes preserve SVG child nodes.
- Share eligible public URL loads while keeping cancellation independent. Private, varying, and non-cacheable responses, browser CORS responses, and requests with custom fetch options stay independent.

### Fixed

- Keep URL caches separate by redirect policy and let queued callers make independent requests if the first fetch fails.
- Watch local icon directories in Vite development without treating directories as module imports.
- Preserve alternate XLink namespace references when inserting SVG markup and scoping IDs.
- Seed legacy precompiled SVGs without adding the server XML parser to browser builds.

### Security

- Decode CSS tokens before validating resource URLs. Reject malformed CSS URLs and resource-selection functions in sanitized styles.
- Check Vite's filesystem policy before reading files for static React imports in development.

See the [React benchmark results](https://svg.mhaadi.dev/benchmarks) for bundle sizes and browser timings against 0.4.2 and other tools.

## 0.4.2

### Fixed

- Return missing-source results for unknown catalog prefixes such as `constructor`, and reject malformed Iconify collections without crashing.
- Preserve Iconify flips and rotations across alias chains and offline bundles.
- Preserve the native Hugeicons wrapper's unfilled default for outline paths.

## 0.4.1

### Fixed

- Resolve the catalog, Vite plugin, and Astro integration in native Node ESM, including their internal module imports.
- Use explicit JavaScript paths in published declarations and framework adapters.

## 0.4.0

### Added

- Precompile icons known at build time so mounting skips XML parsing and sanitization: `localSvgs({ precompiled: true })` parses and sanitizes every discovered local SVG during the build and registers the resolved tree, and `registerLocalSvgs` accepts a `precompiled` option as a manual escape hatch for the same. Per-instance id scoping and color overrides stay unchanged, and runtime registration remains the default.
- Enable an opt-in SVGO pass over SVGs discovered at build time with the `svgo` option on `@mhaadi/svg/vite/plugin` and `@mhaadi/svg/astro/integration`. `svgo: true` runs a preset-safe list of default plugins that keeps fragment IDs, descriptions, and style cleaning intact; a `plugins` list or `filter`/function config covers full SVGO pass-through and per-file control. The pass fails the build with install instructions when svgo is missing and is off unless explicitly enabled.
- Bundle resolved icon sources with `bundleCatalogIcons` from `@mhaadi/svg/catalog`, writing a generated data module that renders `collection:icon` names inline in offline runtimes such as React Native, with no network requests and no filesystem access at render time.
- Load icons directly from installed icon packages (e.g. lucide, tabler, phosphor) with `collection:icon` names, without per-icon imports.
- Resolve `hugeicons:*` names through the official `@hugeicons/core-free-icons` package (kebab-case `hugeicons:home-01` for its `Home01Icon` module), with the generic Iconify data-package probes still serving as a fallback.

### Fixed

- Stop rewriting `fill` and `stroke` on and inside `mask` and `clipPath` elements so color overrides no longer hide mask-keyed artwork.

### Changed

- Resolve href-like attributes by namespace-resolved local name, so `xlink:href`, `XLINK:HREF`, and re-prefixed bindings such as `evil:href` (declared to any namespace) are all checked like `href` instead of bypassing URL filtering.
- Drop any event-handler attribute whose local name starts with `on` in any namespace, so prefixed variants such as `xlink:onclick` are removed rather than kept.
- Restrict `<use>` href-like attributes to same-document fragment references (`#id`); external document references (`https:`, protocol-relative) are now stripped.
- Strip all `data:` href values from `<a>` (navigation targets), including `data:image/svg+xml`.
- On `<image>` and `<feImage>`, allow `data:` href values only for raster image subtypes; `data:image/svg+xml` is now stripped in all its spellings, including compressed (`svg+xml-compressed`) and case-obfuscated variants.
- Limit `url()` targets inside `style` attributes to same-document fragment references such as `fill:url(#g)`; remote `http`/`data` targets are now stripped, and whitespace between `url` and `(` no longer bypasses the check.

## 0.3.1

### Fixed

- Make caller-provided `fill` and `stroke` override matching hardcoded values on SVG descendants, so icons follow colors like `currentColor` instead of ignoring them. `none` values and gradient references are preserved.
- Include the TypeScript sources referenced by JavaScript and declaration sourcemaps in the published package so Astro and Vite can resolve them without missing-source warnings.

## 0.3.0

### Added

- Render SVGs in Solid with reactive props, loading and fallback content, and load/error callbacks.
- Render sanitized SVGs on the server in Astro without client JavaScript, with a fallback slot and local SVG registration.
- Render SVGs in Angular 20+ with a standalone component, signal inputs, loading and fallback templates, and load/error outputs.
- Discover local SVGs by name through `@mhaadi/svg/vite/plugin` and `@mhaadi/svg/astro/integration`, with configurable directories, nested names, symlink support, and development reloads.
- Set both dimensions with `size`, with explicit `width` and `height` taking precedence.
- Set accessible `title` and `desc` text without reloading the source. React Native maps these to its accessibility label and hint.
- Control per-instance ID isolation with `uniqueIds`, enabled by default, with an opt-out for SVGs that intentionally reference external IDs.

### Changed

- Make framework peers optional so other adapters can be installed without React.
- Use `@xmldom/xmldom` for Astro and React Native parsing without a browser DOM. Browser adapters continue to use the browser parser.
- Share a bounded markup cache across JavaScript adapters and reuse parsed trees without mutating them for instance IDs or labels.
- Serialize transformed markup only when rendering needs it and reuse unchanged child markup when labels change.
- Add website version history, framework-specific docs and search, wrapping example tabs, and debounced copy buttons.

### Fixed

- Isolate gradients, masks, clip paths, CSS selectors, fragment links, and accessibility references across repeated SVG instances. Keep references valid when callers override a root ID.
- Preserve authored accessibility references when adding titles or descriptions and infer a viewBox from known intrinsic dimensions and absolute units when resizing artwork.
- Render React Native inline and data-URL SVGs without fetching, preserve legacy xlink attributes, and handle malformed XML consistently.
- Recognize SVG markup with XML declarations, comments, or DOCTYPE prefixes and honor caller cancellation in Astro.
- Preserve authored root CSS in Vue and Svelte, including custom properties, dashed names, quoted values, and camel-cased Vue style-object keys. Keep Svelte's exported parsed style as a CSS string.
- Abort stale Vue loads when the source is cleared, emit load/error callbacks once, and avoid refetching Svelte SVGs when callback identities change.
- Honor `cache={false}`, reparse changed markup, keep parser caches isolated, and prevent older concurrent responses from replacing newer cached markup.
- Keep the legacy Vite registration import during tree shaking and register raw SVG markup instead of asset URLs.
- Preserve comments and empty HTML elements in trusted unsanitized SVGs and prevent local SVG discovery from following directory cycles.
- Make the website marquee loop continuously and keep changelog navigation and keyboard focus working on desktop and mobile.

### Security

- Require explicit trusted `allowedOrigins` for cross-origin Astro fetches and reject HTTP redirects during server rendering.
- Share only responses explicitly marked public. Bypass private, no-store, and no-cache responses and requests with custom `fetchOptions`.
- Reject unsafe URL schemes hidden by control characters and remove event handlers regardless of attribute casing.
- Restrict sanitized content to static SVG elements and escape parsed text before HTML insertion. Stylesheets, animation elements, and embedded HTML require `sanitize={false}` for trusted input.

## 0.2.3

- Fix: cache the parsed SVG (not just the markup) so a cache hit skips `DOMParser` and a re-mount with a new `fetchOptions` identity does not re-parse. Applies to React, React Native, Vue, and Svelte adapters.
- Fix: Svelte adapter no longer tracks `onSvgLoad`/`onSvgError` in its `$effect`, so inline callbacks no longer cause refetch + reparse.
- Fix: honor `cache={false}` in the parsed-SVG cache — `cache={false}` now always parses fresh markup instead of returning a stale cached parse from a previous `cache={true}` mount.
- Perf: bound the parsed-SVG cache with an LRU (500 entries for `ParsedInlineSvg`, 200 for `SvgNode`) so long-running apps with thousands of distinct SVGs don't leak memory.
- Docs: restore Security section, props table, subpath table, and install steps in the package README.
- Packaging: add `LICENSE` (MIT), `repository`/`homepage`/`bugs`/`engines`/`keywords` fields to `package.json` for npm and Socket trust signals.

## 0.2.2

- Docs: trim the package README to link to the docs site.

## 0.2.1

- Fix: isolate Vite glob in `/vite` entry to unblock React Native.

## 0.2.0

- Initial public release.
