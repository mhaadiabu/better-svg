# Changelog

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
- Add website version history, framework-specific docs and search, wrapping example tabs, and debounced copy buttons. Remove Flutter from the documentation site.

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
