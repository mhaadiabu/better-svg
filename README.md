# BetterSVG

Inline SVG rendering for React, React Native, Vue, Svelte, and Flutter. Same
mental model across frameworks: `src` or `name`, optional sanitization, loading
and fallback states, and a shared core for URL safety and markup parsing.

## Packages

| Package                                       | Targets                          | Install                       |
| --------------------------------------------- | -------------------------------- | ----------------------------- |
| [`@mhaadi/svg`](./packages/svg/README.md)     | React, React Native, Vue, Svelte | `pnpm add @mhaadi/svg`        |
| [`svg_flutter`](./packages/flutter/README.md) | Flutter (Dart, `flutter_svg`)    | `flutter pub add svg_flutter` |

The JS/TS subpath exports live in [`@mhaadi/svg`'s README](./packages/svg/README.md#subpath-exports).
The Flutter widget API is documented in [`svg_flutter`'s README](./packages/flutter/README.md).

## Apps

- [`apps/web`](./apps/web) — Documentation site at [svg.mhaadi.dev](https://svg.mhaadi.dev)

## Repo Structure

```text
apps/web         Documentation site (Astro)
packages/svg     @mhaadi/svg (React, React Native, Vue, Svelte)
packages/ui      Shared UI primitives
packages/flutter svg_flutter (Dart, flutter_svg)
```

## Scripts

- `pnpm run dev`: Start the workspace in development mode
- `pnpm run build`: Build all packages and apps
- `pnpm run check-types`: Check TypeScript types
- `pnpm run check`: Run Oxlint and Oxfmt
