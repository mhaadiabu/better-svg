# @mhaadi/svg

Inline SVG rendering for React, React Native, Vue, Svelte, Solid, Astro, and Angular from a single
npm package. Same mental model across frameworks: `src` or `name`, optional
sanitization, loading and fallback states, and a shared core for URL safety
and markup parsing.

**Full docs & usage:** https://svg.mhaadi.dev/docs

For Flutter, see [`svg_flutter`](https://pub.dev/packages/svg_flutter).

## Install

```bash
pnpm add @mhaadi/svg
```

## Quick start

```tsx
import { SVG } from "@mhaadi/svg/react";

<SVG src={logoUrl} className="h-6 w-6 text-current" />
<SVG name="logo" className="h-6 w-6" />
<SVG
  src="https://cdn.example.com/icon.svg"
  loading={<span>Loading...</span>}
  fallback={<span>Failed to load</span>}
  sanitize
/>
```

## React Native

Requires `react-native` and `react-native-svg` as peer dependencies.

```tsx
import { SVG } from "@mhaadi/svg/react-native";

<SVG
  src="https://cdn.example.com/icon.svg"
  width={24}
  height={24}
  color="#111827"
/>
<SVG name="logo" width={24} height={24} />
```

The renderer parses the SVG into an AST and emits a `react-native-svg` tree
(`Svg`, `Path`, `Rect`, `Circle`, `Ellipse`, `Line`, `Polyline`, `Polygon`,
`Text`, gradients, `ClipPath`, `Mask`, `Defs`, `Use`, `Symbol`, `Image`).
Inline styles and `class` are translated into React Native style objects.

## Vue 3

```vue
<script setup lang="ts">
import { SVG } from "@mhaadi/svg/vue";
</script>

<template>
  <SVG src="https://cdn.example.com/icon.svg" :width="24" :height="24" />
  <SVG name="logo" class="h-6 w-6" />
</template>
```

Loading and fallback are exposed as named slots:

```vue
<SVG src="/icon.svg">
  <template #loading>Loading…</template>
  <template #fallback>Failed</template>
</SVG>
```

`svg-load` and `svg-error` events are emitted when the markup resolves or fails.

## Svelte 5

```svelte
<script lang="ts">
  import { SVG } from "@mhaadi/svg/svelte";
</script>

<SVG src="https://cdn.example.com/icon.svg" width="24" height="24" />
<SVG name="logo" class="h-6 w-6" />

<SVG src="/icon.svg">
  {#snippet loading()}Loading…{/snippet}
  {#snippet fallback()}Failed{/snippet}
</SVG>
```

## Solid

Requires Solid 1.9+.

```tsx
import { SVG } from "@mhaadi/svg/solid";

<SVG
  src={iconUrl()}
  width={24}
  height={24}
  class="text-current"
  loading={<span>Loading...</span>}
  fallback={<span>Failed to load</span>}
  onSvgError={(error) => console.error(error)}
/>;
```

Source changes cancel pending loads. Root SVG attributes and events accept
Solid bindings. `style` accepts a CSS string. Server rendering shows the
loading content and resolves the SVG on the client.

## Astro

Requires Astro 5+. Renders during the build or server request and ships no
client JavaScript.

```astro
---
import SVG from "@mhaadi/svg/astro";
import logo from "./assets/svg/logo.svg?raw";
---

<SVG src={logo} width={24} height={24} class="text-current">
  <span slot="fallback">Failed to load</span>
</SVG>
```

Use `?raw` for local files in static builds. Relative URLs resolve against
`Astro.url` and require an asset server reachable during rendering. Cross-origin
URLs require an explicit `allowedOrigins` list, such as
`allowedOrigins={["https://cdn.example.com"]}`. HTTP redirects are rejected.
Use trusted, fixed origins when accepting request-derived URLs. Inline markup
and SVG data URLs work on the server. Callbacks
also run on the server. Astro has a fallback slot and no client loading state.

Register raw local SVGs to use `name` without fetching:

```astro
---
import SVG, { registerLocalSvgs } from "@mhaadi/svg/astro";

registerLocalSvgs(import.meta.glob("/src/assets/svg/**/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}));
---

<SVG name="logo" width={24} height={24} />
```

## Angular

Requires Angular 20+. Import the standalone `SVG` component to use
`<better-svg>`.

```ts
import { Component } from "@angular/core";
import { SVG } from "@mhaadi/svg/angular";

@Component({
  selector: "app-root",
  imports: [SVG],
  template: `
    <ng-template #pending>Loading...</ng-template>
    <ng-template #failed>Failed to load</ng-template>
    <better-svg
      src="/icon.svg"
      [width]="24"
      [height]="24"
      [loading]="pending"
      [fallback]="failed"
      svgClass="text-current"
      [ariaHidden]="true"
    />
  `,
})
export class AppComponent {}
```

Inputs use signals. `svgClass` and `svgStyle` apply to the inner SVG.
`ariaLabel` and `ariaHidden` set its accessibility attributes. `(svgLoad)`
emits the original markup and `(svgError)` emits an `Error`. Server rendering
shows the loading template and resolves the SVG on the client.

## Props

| Prop           | Type                       | Description                                   |
| -------------- | -------------------------- | --------------------------------------------- |
| `src`          | `string`                   | Inline SVG string, `data:` URL, or remote URL |
| `name`         | `SvgName`                  | Resolve a local SVG by name (no extension)    |
| `sanitize`     | `boolean` (default `true`) | Remove unsafe SVG content before rendering    |
| `cache`        | `boolean` (default `true`) | Cache remote SVG markup in memory             |
| `size`         | `string` or `number`       | Set width and height together                 |
| `title`        | `string`                   | Accessible SVG title text                     |
| `desc`         | `string`                   | Accessible SVG description text               |
| `fetchOptions` | `RequestInit`              | Options passed to `fetch`                     |
| `loading`      | slot / `ReactNode`         | Render while SVG is loading or parsing        |
| `fallback`     | slot / `ReactNode`         | Render when loading fails                     |
| `onSvgLoad`    | function                   | Called when SVG markup is resolved            |
| `onSvgError`   | function                   | Called when loading or parsing fails          |

React Native also accepts `width`, `height`, `color`, `fill`, `stroke`, and
`strokeWidth` overrides. Vue, Svelte, and Angular accept a focused set of root-level SVG
attributes (including `width`, `height`, `viewBox`, `fill`, `stroke`,
`role`, `aria-label`, `aria-hidden`). Solid and Astro accept native SVG
attributes. `fill` and `stroke` also rewrite matching hardcoded values on
descendants, so a caller-provided color wins over embedded presentation
attributes. `none` values and gradient references are preserved. Angular uses `svgLoad` and `svgError` outputs instead of callback
props, and `TemplateRef` inputs for loading and fallback.

Remote markup caching is shared across adapters and limited to 500 entries.
Only responses marked `Cache-Control: public` enter this cache. Responses
marked `private`, `no-store`, or `no-cache` and custom `fetchOptions` bypass it. Use `cache={false}`
for SVGs that depend on the current session or need fresh responses.

## Entry points

| Import                          | Framework             |
| ------------------------------- | --------------------- |
| `@mhaadi/svg`                   | React (default)       |
| `@mhaadi/svg/react`             | React 18+             |
| `@mhaadi/svg/react-native`      | React Native          |
| `@mhaadi/svg/vue`               | Vue 3                 |
| `@mhaadi/svg/svelte`            | Svelte 5 (runes)      |
| `@mhaadi/svg/solid`             | Solid 1.9+            |
| `@mhaadi/svg/astro`             | Astro 5+              |
| `@mhaadi/svg/angular`           | Angular 20+           |
| `@mhaadi/svg/vite`              | Vite registration     |
| `@mhaadi/svg/vite/plugin`       | Vite 5+ config plugin |
| `@mhaadi/svg/astro/integration` | Astro local discovery |

React Native requires `react-native` and `react-native-svg` as peer dependencies.

## Internal IDs

Each component instance rewrites IDs and their local references so repeated SVGs
can use gradients, masks, and clip paths without collisions. This also updates
fragment links, CSS `url(#...)` values, accessibility ID lists, and animation
timing references. The cached parse keeps its original IDs.

Set `uniqueIds={false}` when external styles or other SVGs intentionally reference
the original IDs. In Vue use `:unique-ids="false"`, and in Angular use
`[uniqueIds]="false"`. The load callback still receives the original markup.

## Security

`sanitize` is enabled by default. Sanitization allows static SVG elements,
removes inline event handlers regardless of casing, and rejects unsafe
`href`/`xlink:href` and CSS `url(...)` references. It removes scripts,
embedded HTML, stylesheets, and animation elements. Keep it on for any
untrusted SVG input.

Set `sanitize={false}` only for fully-trusted SVG you control; the rendered
markup then bypasses the strip pass and can carry inline scripts and event
handlers.

Details: https://svg.mhaadi.dev/docs#security

## License

MIT. See [`LICENSE`](./LICENSE).

## Automatic local discovery

Add the Vite plugin to discover files in `src/assets/svg` and `app/assets/svg`.
Then `<SVG name="logo" />` renders `logo.svg` without fetching it. A nested
file such as `social/github.svg` uses `name="social/github"`.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import localSvgs from "@mhaadi/svg/vite/plugin";

export default defineConfig({
  plugins: [localSvgs({ dirs: ["src/icons", "src/illustrations"] })],
});
```

Astro users can add the integration instead.

```ts
// astro.config.mjs
import { defineConfig } from "astro/config";
import svg from "@mhaadi/svg/astro/integration";

export default defineConfig({ integrations: [svg()] });
```

`dirs` replaces the default directories. Paths are relative to the project
root. The first directory wins when names overlap. Explicit calls to
`registerLocalSvgs` from `@mhaadi/svg/local` override discovered entries. A missing name still falls
back to `/assets/svg/{name}.svg`.

Discovery includes every SVG in the configured directories in the bundle.
Keep those directories limited to assets the app uses. Development reloads
the page when an SVG is added, edited, or removed. No optimization runs.
The existing `import "@mhaadi/svg/vite"` registration remains available for
default directories, but the config plugin handles custom paths and Astro SSR.

## Size and accessible text

```tsx
<SVG name="logo" size={24} title="Acme" desc="Acme company logo" />
<SVG name="wide-logo" size="2rem" width="6rem" title="Acme" />
```

`size` sets width and height. An explicit dimension takes precedence over
`size`, and an omitted dimension keeps the SVG's authored value.

On the web, `title` and `desc` replace the corresponding direct SVG children.
Omitting either prop preserves its authored element. Strings are escaped as
text. Generated references connect those elements to `aria-labelledby` and
`aria-describedby`. A nonempty title defaults to `role="img"`. Explicit
accessibility attributes override these defaults. Use `aria-hidden="true"`
for decorative icons, or `ariaHidden` in Vue and Angular. Changing labels
or dimensions does not fetch or parse the SVG again.

React Native maps `title` to `accessibilityLabel` and `desc` to
`accessibilityHint` on the wrapper View. An explicit accessibility label,
hint, or `accessible` prop takes precedence. A nonempty title makes the
wrapper accessible by default.

## Parsing

Browser adapters use the browser's XML parser. Astro and React Native use
`@xmldom/xmldom` to parse SVGs without a browser DOM. The package has this
runtime dependency; other adapters do not import it. Our sanitizer checks
the parsed tree before rendering.

Parsed and sanitized trees are cached by source, markup, sanitization mode,
and parser. Per-instance IDs and labels leave the cached tree unchanged.
Markup serializes when rendering needs it, and label updates reuse the
serialized children that did not change. `cache={false}` skips reuse.
