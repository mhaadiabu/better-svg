# BetterSVG

Render SVGs inline in React, React Native, Vue, Svelte, Solid, Astro, and Angular. Load a URL, pass SVG markup, or use a local asset by name.

[Documentation](https://svg.mhaadi.dev/docs) · [npm](https://www.npmjs.com/package/@mhaadi/svg) · [Changelog](./packages/svg/CHANGELOG.md)

## Get started

```bash
pnpm add @mhaadi/svg
```

```tsx
import { SVG } from "@mhaadi/svg/react";

export function Logo() {
  return <SVG src="/logo.svg" size={32} title="Acme" />;
}
```

`src` accepts inline SVG markup, SVG data URLs, and URLs. BetterSVG sanitizes SVGs by default and scopes internal IDs per instance so repeated gradients, masks, and clip paths don't collide. Use `size` for both dimensions, or set `width` and `height` separately.

```tsx
<SVG
  src="https://cdn.example.com/illustration.svg"
  width={320}
  title="Your workspace"
  loading={<span>Loading...</span>}
  fallback={<span>Illustration unavailable</span>}
/>
```

Loading and fallback APIs follow each framework's conventions. Astro renders on the server with no client JavaScript. React Native renders through `react-native-svg` and requires it as a peer dependency.

## Frameworks

All adapters ship in `@mhaadi/svg`. Import the adapter you use. Framework peer dependencies are optional.

| Framework    | Import                                           |
| ------------ | ------------------------------------------------ |
| React 18+    | `import { SVG } from "@mhaadi/svg/react"`        |
| React Native | `import { SVG } from "@mhaadi/svg/react-native"` |
| Vue 3        | `import { SVG } from "@mhaadi/svg/vue"`          |
| Svelte 5     | `import { SVG } from "@mhaadi/svg/svelte"`       |
| Solid 1.9+   | `import { SVG } from "@mhaadi/svg/solid"`        |
| Astro 5+     | `import SVG from "@mhaadi/svg/astro"`            |
| Angular 20+  | `import { SVG } from "@mhaadi/svg/angular"`      |

The root `@mhaadi/svg` import also exports the React adapter. Angular uses the `<better-svg>` selector. See the [framework guides](https://svg.mhaadi.dev/docs) for examples.

## Local SVGs by name

Add the Vite plugin to discover SVGs in `src/assets/svg` and `app/assets/svg`, or set your own directories:

```ts
import { defineConfig } from "vite";
import svgPlugin from "@mhaadi/svg/vite/plugin";

export default defineConfig({
  plugins: [svgPlugin({ dirs: ["src/icons"] })],
});
```

Then `src/icons/social/github.svg` is available as:

```tsx
<SVG name="social/github" size={24} title="GitHub" />
```

Astro projects can use `@mhaadi/svg/astro/integration` instead. Manual registration is available through `registerLocalSvgs` from `@mhaadi/svg/local`.

Production builds keep statically referenced local icons in the initial bundle. Other discovered icons load from a deferred chunk. Set `pruneLocal: false` to include them all up front. Both plugins support opt-in `svgo` optimization and `precompiled: true` to parse and sanitize local assets at build time. Precompilation skips runtime parsing for those assets at the cost of larger bundles. SVGO requires a separate development dependency.

## Icons from installed packages

The catalog resolves names such as `lucide:house` or `hugeicons:home-01` from installed icon packages. With `svgPlugin()` enabled, literal names in source code register automatically, and the plugin generates TypeScript name suggestions. For manual registration, run this in the Node process that renders your app, such as an Astro frontmatter block:

```ts
import { registerCatalogIcons } from "@mhaadi/svg/catalog";

registerCatalogIcons(["lucide:house", "tabler:settings"]);
```

Install the matching icon data packages first, such as `@iconify-json/lucide` and `@iconify-json/tabler`. Registered icons render with `<SVG name="lucide:house" />`.

For browser apps without the plugin and for React Native, use `bundleCatalogIcons` at build time to generate a data module, then register it with `registerLocalSvgs`. Icons render without runtime network or filesystem access. See the [catalog guide](https://svg.mhaadi.dev/docs#icon-catalog) for package resolution and bundling instructions.

## Static React imports

With the Vite plugin enabled, import a local SVG as a React component:

```tsx
import Logo from "./icons/logo.svg?better-svg";

<Logo size={32} title="Acme" />;
```

The plugin sanitizes and compiles it at build time. It supports server rendering and client hydration without a runtime SVG parser or URL loader. For TypeScript, add `/// <reference types="@mhaadi/svg/vite/static" />` to `vite-env.d.ts`.

## Development

This repository uses pnpm workspaces and Turbo. Use Node.js 22.23.4 or newer on the 22.x line, 24.3 or newer on the 24.x line, or 26 or newer, with pnpm 11.15.1. Workspace development dependencies and verification tools require these versions. The published SVG package supports Node.js 18 and newer.

| Directory             | Purpose                                                              |
| --------------------- | -------------------------------------------------------------------- |
| `packages/svg`        | The `@mhaadi/svg` npm package and framework adapters                 |
| `apps/web`            | Astro documentation site at [svg.mhaadi.dev](https://svg.mhaadi.dev) |
| `packages/benchmarks` | Reproducible performance comparisons                                 |
| `packages/config`     | Shared TypeScript configuration                                      |
| `packages/env`        | Environment validation                                               |
| `packages/infra`      | Deployment configuration                                             |
| `plans`               | Implementation plans                                                 |

```bash
pnpm install
pnpm run dev:web
```

Run `pnpm run check-types`, `pnpm run lint`, `pnpm run test`, and `pnpm run build` to verify changes. `pnpm run check` also formats files.

## License

[MIT](./LICENSE)
