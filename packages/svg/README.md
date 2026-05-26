# BetterSVG

BetterSVG is a lightweight React package for rendering SVGs inline.

## Install

```bash
pnpm add @mhaadi/svg
```

## Import

Keep using the current package name and export path:

```tsx
import { SVG } from "@mhaadi/svg/react";
```

## Usage

```tsx
<SVG src={logoUrl} className="h-6 w-6 text-current" />
<SVG name="logo" className="h-6 w-6" />
<SVG
  src="https://cdn.example.com/icon.svg"
  loading={<span>Loading...</span>}
  fallback={<span>Failed to load</span>}
  sanitize
/>
```

## Features

- Inline SVG rendering for React
- Local SVG lookup by name
- Remote SVG fetching
- Optional sanitization by default
- Loading and fallback states

## Notes

- Package name on npm is currently `@mhaadi/svg`.
- The package exports `@mhaadi/svg` and `@mhaadi/svg/react`.
- `sanitize` is enabled by default for untrusted SVG input.
