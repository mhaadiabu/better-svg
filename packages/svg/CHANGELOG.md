# Changelog

## Unreleased

### Changed

- Share one markup cache across all JavaScript adapters and limit it to 500 entries with least-recently-used eviction.

### Fixed

- Abort pending Vue loads when the source is cleared so stale responses cannot replace the fallback.
- Call Vue load and error callbacks once through their corresponding component events.
- Honor `cache={false}` on every Svelte load and reuse cached markup across Svelte mounts.
- Reparse changed markup for the same source instead of returning stale SVG content.
- Share only responses explicitly marked public and bypass private, no-store, and no-cache responses so session content cannot cross adapters.
- Prevent older concurrent responses from replacing newer cached markup.
- Bypass shared markup caching when custom `fetchOptions` are provided so headers, credentials, and request methods take effect.

### Security

- Reject unsafe URL schemes hidden by tabs, newlines, or leading control characters.
- Remove event handlers regardless of attribute casing and restrict sanitized markup to static SVG elements. Stylesheets, animation elements, and embedded HTML require `sanitize={false}` for trusted input.
- Escape parsed text before HTML insertion so XML CDATA cannot introduce executable markup.

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
