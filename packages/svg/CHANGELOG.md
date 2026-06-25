# Changelog

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
