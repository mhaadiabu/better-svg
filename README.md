# BetterSVG

Inline SVG rendering for React, React Native, Vue, Svelte, and Flutter. Same
mental model across frameworks: `src` or `name`, optional sanitization, loading
and fallback states, and a shared core for URL safety and markup parsing.

## Packages

- `@mhaadi/svg` — React, React Native, Vue, Svelte (one npm package, subpath exports)
- `svg_flutter` — Flutter (Dart, `flutter_svg`)

## Install

```bash
pnpm add @mhaadi/svg
```

## Usage (React)

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

## Usage (React Native, Vue, Svelte, Flutter)

```tsx
// React Native — requires react-native-svg
import { SVG } from "@mhaadi/svg/react-native";
<SVG name="logo" width={24} height={24} color="#111827" />
```

```vue
<!-- Vue 3 -->
<script setup lang="ts">
import { SVG } from "@mhaadi/svg/vue";
</script>
<template><SVG name="logo" :width="24" :height="24" /></template>
```

```svelte
<!-- Svelte 5 -->
<script lang="ts">
  import { SVG } from "@mhaadi/svg/svelte";
</script>
<SVG name="logo" width="24" height="24" />
```

```dart
// Flutter — requires flutter_svg
import 'package:svg_flutter/svg_flutter.dart';
Svg(name: 'logo', width: 24, height: 24)
```

## Features

- Inline SVG rendering for React, React Native, Vue, Svelte, Flutter
- Local SVG lookup by name
- Remote SVG fetching with in-memory cache
- Sanitization enabled by default
- Loading and fallback states

## API

- `src`: Inline SVG string, `data:` URL, or remote URL
- `name`: Resolve a local SVG by name
- `sanitize`: Remove unsafe SVG content before rendering
- `cache`: Cache remote SVG markup in memory
- `fetchOptions`: Options passed to `fetch`
- `loading`: Render while SVG is loading or parsing
- `fallback`: Render when loading fails
- `onSvgLoad`: Called when SVG markup is resolved
- `onSvgError`: Called when loading or parsing fails

## Security

`sanitize` is enabled by default. Keep it on for any untrusted SVG input.

## Scripts

- `pnpm run dev`: Start the workspace in development mode
- `pnpm run build`: Build all packages and apps
- `pnpm run check-types`: Check TypeScript types
- `pnpm run check`: Run Oxlint and Oxfmt

## Repo Structure

```text
apps/web         Web demo
packages/svg     @mhaadi/svg (React, React Native, Vue, Svelte)
packages/ui      Shared UI primitives
packages/flutter svg_flutter (Dart, flutter_svg)
```
