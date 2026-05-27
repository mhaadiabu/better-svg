# BetterSVG

Inline SVG rendering for React, built as a monorepo with a publishable package and a web demo.

## Package

`@mhaadi/svg`

## Install

```bash
pnpm add @mhaadi/svg
```

## Usage

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

## Features

- Inline SVG rendering for React
- Local SVG lookup by name
- Remote SVG fetching
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
apps/web      Web demo
packages/svg  Published SVG package
packages/ui   Shared UI primitives
```
