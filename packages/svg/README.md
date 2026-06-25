# @mhaadi/svg

Inline SVG rendering for React, React Native, Vue, and Svelte from a single
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

## Props

| Prop           | Type                       | Description                                   |
| -------------- | -------------------------- | --------------------------------------------- |
| `src`          | `string`                   | Inline SVG string, `data:` URL, or remote URL |
| `name`         | `SvgName`                  | Resolve a local SVG by name (no extension)    |
| `sanitize`     | `boolean` (default `true`) | Remove unsafe SVG content before rendering    |
| `cache`        | `boolean` (default `true`) | Cache remote SVG markup in memory             |
| `fetchOptions` | `RequestInit`              | Options passed to `fetch`                     |
| `loading`      | slot / `ReactNode`         | Render while SVG is loading or parsing        |
| `fallback`     | slot / `ReactNode`         | Render when loading fails                      |
| `onSvgLoad`    | function                   | Called when SVG markup is resolved            |
| `onSvgError`   | function                   | Called when loading or parsing fails           |

React Native also accepts `width`, `height`, `color`, `fill`, `stroke`, and
`strokeWidth` overrides. Vue and Svelte accept the same set of root-level SVG
attributes (including `width`, `height`, `viewBox`, `fill`, `stroke`,
`role`, `aria-label`, `aria-hidden`).

## Entry points

| Import                     | Framework        |
| -------------------------- | ---------------- |
| `@mhaadi/svg`              | React (default)  |
| `@mhaadi/svg/react`        | React 18+        |
| `@mhaadi/svg/react-native` | React Native     |
| `@mhaadi/svg/vue`          | Vue 3            |
| `@mhaadi/svg/svelte`       | Svelte 5 (runes) |
| `@mhaadi/svg/vite`         | Vite plugin      |

React Native requires `react-native` and `react-native-svg` as peer dependencies.

## Security

`sanitize` is enabled by default. Sanitization removes `<script>`,
`<foreignObject>`, `<iframe>`, `<object>`, and `<embed>`, plus inline event
handlers and unsafe `href`/`xlink:href` and CSS `url(...)` references. Keep it
on for any untrusted SVG input.

Set `sanitize={false}` only for fully-trusted SVG you control; the rendered
markup then bypasses the strip pass and can carry inline scripts and event
handlers.

Details: https://svg.mhaadi.dev/docs#security

## License

MIT. See [`LICENSE`](./LICENSE).
