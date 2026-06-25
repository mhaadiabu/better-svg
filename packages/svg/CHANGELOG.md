# Changelog

## 0.2.3

- Fix: cache the parsed SVG (not just the markup) so a cache hit skips `DOMParser` and a re-mount with a new `fetchOptions` identity does not re-parse. Applies to React, React Native, Vue, and Svelte adapters.
- Fix: Svelte adapter no longer tracks `onSvgLoad`/`onSvgError` in its `$effect`, so inline callbacks no longer cause refetch + reparse.
- Docs: restore Security section, props table, subpath table, and install steps in the package README.
- Packaging: add `LICENSE` (MIT), `repository`/`homepage`/`bugs`/`engines`/`keywords` fields to `package.json` for npm and Socket trust signals.

## 0.2.2

- Docs: trim the package README to link to the docs site.

## 0.2.1

- Fix: isolate Vite glob in `/vite` entry to unblock React Native.

## 0.2.0

- Initial public release.
