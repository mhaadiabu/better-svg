# @mhaadi/svg

Inline SVG rendering for React, React Native, Vue, Svelte, Solid, Astro, and Angular.

Load SVG markup, data URLs, or remote URLs. Render local assets and registered catalog icons by name. Sanitization and per-instance ID scoping are enabled by default.

[Documentation](https://svg.mhaadi.dev/docs) · [Source](https://github.com/mhaadiabu/better-svg) · [Changelog](https://github.com/mhaadiabu/better-svg/blob/main/packages/svg/CHANGELOG.md)

## Install

```bash
pnpm add @mhaadi/svg
```

## Usage

```tsx
import { SVG } from "@mhaadi/svg/react";

export function Logo() {
  return <SVG src="/logo.svg" size={32} title="Acme" />;
}
```

Use `name="brand/logo"` for registered assets. The [Vite plugin and Astro integration](https://svg.mhaadi.dev/docs#local-discovery) discover local SVGs, with optional SVGO optimization and build-time precompilation. The plugin also registers literal catalog names and generates TypeScript suggestions. React projects can import compiled SVG components with `?better-svg`. The [icon catalog](https://svg.mhaadi.dev/docs#icon-catalog) resolves installed icon packages and can bundle icons for offline use.

## Framework imports

| Framework    | Import path                |
| ------------ | -------------------------- |
| React 18+    | `@mhaadi/svg/react`        |
| React Native | `@mhaadi/svg/react-native` |
| Vue 3        | `@mhaadi/svg/vue`          |
| Svelte 5     | `@mhaadi/svg/svelte`       |
| Solid 1.9+   | `@mhaadi/svg/solid`        |
| Astro 5+     | `@mhaadi/svg/astro`        |
| Angular 20+  | `@mhaadi/svg/angular`      |

Astro uses a default import. The other adapters export `{ SVG }`. Angular uses `<better-svg>`. React Native requires `react-native-svg`. Install only the framework peers you use.

See the [docs](https://svg.mhaadi.dev/docs) for loading and fallback states, accessibility, color overrides, caching, and security options.

## License

[MIT](./LICENSE)
