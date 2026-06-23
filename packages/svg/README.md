# @mhaadi/svg

Inline SVG rendering for React, React Native, Vue, and Svelte. Resolve,
sanitize, and render SVGs inline from a local name, remote URL, data URI, or
raw markup — with a shared core for URL safety and markup parsing.

**Full docs & usage:** https://svg.mhaadi.dev/docs

## Install

```bash
pnpm add @mhaadi/svg
```

## Quick start

```tsx
import { SVG } from "@mhaadi/svg/react";

<SVG src="https://cdn.example.com/icon.svg" className="h-6 w-6 text-current" />
<SVG name="logo" className="h-6 w-6" />
```

## Entry points

| Import                     | Framework        |
| -------------------------- | ---------------- |
| `@mhaadi/svg`              | React (default)  |
| `@mhaadi/svg/react`        | React 18+        |
| `@mhaadi/svg/react-native` | React Native     |
| `@mhaadi/svg/vue`          | Vue 3            |
| `@mhaadi/svg/svelte`       | Svelte 5 (runes) |

React Native requires `react-native` and `react-native-svg` as peer dependencies.

## Security

Sanitization is enabled by default — `<script>`, event handlers, unsafe
`href`s, and embedded HTML are stripped from every SVG before render. Keep it
on for untrusted input.

Details: https://svg.mhaadi.dev/docs#security

## License

MIT
