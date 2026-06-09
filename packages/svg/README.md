# BetterSVG

Inline SVG rendering for React, React Native, Vue, Svelte, and Flutter. Same
mental model across frameworks: `src` or `name`, optional sanitization, loading
and fallback states, and a shared core for URL safety and markup parsing.

## Install

React, React Native, Vue, and Svelte ship from a single npm package:

```bash
pnpm add @mhaadi/svg
```

Flutter ships from a separate pub package:

```bash
flutter pub add svg_flutter
```

## React

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

## Flutter

```dart
import 'package:svg_flutter/svg_flutter.dart';

Svg(
  src: 'https://cdn.example.com/icon.svg',
  width: 24,
  height: 24,
  color: const Color(0xFF111827),
)

Svg(name: 'logo', width: 24, height: 24)
```

Renders via `flutter_svg`'s `SvgPicture.string`.

## API

| Prop | Type | Description |
| --- | --- | --- |
| `src` | `string` | Inline SVG string, `data:` URL, or remote URL |
| `name` | `string` | Resolve a local SVG by name |
| `sanitize` | `boolean` (default `true`) | Remove unsafe SVG content before rendering |
| `cache` | `boolean` (default `true`) | Cache remote SVG markup in memory |
| `fetchOptions` | `RequestInit` | Options passed to `fetch` |
| `loading` | slot / `ReactNode` / `Widget?` | Render while SVG is loading or parsing |
| `fallback` | slot / `ReactNode` / `Widget?` | Render when loading fails |
| `onSvgLoad` | function | Called when SVG markup is resolved |
| `onSvgError` | function | Called when loading or parsing fails |

React Native and Flutter also accept `width`, `height`, and a `color` override
for `currentColor`. React Native accepts `fill`, `stroke`, and `strokeWidth`
overrides; Vue/Svelte accept the same via props.

## Security

`sanitize` is enabled by default. Sanitization removes `<script>`, `<foreignObject>`,
`<iframe>`, `<object>`, and `<embed>`, plus inline event handlers and unsafe
`href`/`xlink:href` and CSS `url(...)` references. Keep it on for any untrusted
SVG input.

## Subpath Exports

| Import | Target |
| --- | --- |
| `@mhaadi/svg` | default React entry |
| `@mhaadi/svg/react` | React 18+ |
| `@mhaadi/svg/react-native` | React Native + `react-native-svg` |
| `@mhaadi/svg/vue` | Vue 3 |
| `@mhaadi/svg/svelte` | Svelte 5 (runes) |
| `package:svg_flutter/svg_flutter.dart` | Flutter + `flutter_svg` |

## Scripts

- `pnpm run dev`: Start the workspace in development mode
- `pnpm run build`: Build all packages and apps
- `pnpm run check-types`: Check TypeScript types
- `pnpm run check`: Run Oxlint and Oxfmt

## Repo Structure

```text
apps/web              Web demo
packages/svg          @mhaadi/svg (React, RN, Vue, Svelte)
packages/ui           Shared UI primitives
packages/flutter      svg_flutter (Dart, flutter_svg)
```
