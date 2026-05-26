# reactsvg

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Turborepo** - Optimized monorepo build system
- **Oxlint** - Oxlint + Oxfmt (linting & formatting)

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to see the web application.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@reactsvg/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Deployment (Cloudflare via Alchemy)

- Target: web
- Dev: pnpm run dev
- Deploy: pnpm run deploy
- Destroy: pnpm run destroy

For more details, see the guide on [Deploying to Cloudflare with Alchemy](https://www.better-t-stack.dev/docs/guides/cloudflare-alchemy).

## Git Hooks and Formatting

- Format and lint fix: `pnpm run check`

## Project Structure

```
reactsvg/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
├── packages/
│   ├── svg/         # Publishable inline SVG React component
│   ├── ui/          # Shared shadcn/ui components and styles
```

## SVG Library (web)

This repo ships a publishable package: `@mhaadi/svg`.

```bash
pnpm add @mhaadi/svg
```

```tsx
import { SVG } from "@mhaadi/svg/react";

<SVG src={logoUrl} className="h-6 w-6 text-current" />;
<SVG name="logo" className="h-6 w-6" />;
<SVG
  src="https://cdn.example.com/icon.svg"
  loading={<span>Loading…</span>}
  fallback={<span>Failed to load</span>}
  sanitize
/>;
```

### How it works

1. Resolves `src` as inline markup, `data:` URL, or a remote URL (fetch).
2. Parses the SVG with `DOMParser`, sanitizes unsafe elements/attributes, and extracts the root `<svg>` attributes.
3. Renders an inline `<svg>` with the original inner markup so SVG features work without `<img>` restrictions.

### Props

All standard `React.SVGProps<SVGSVGElement>` are supported and override SVG markup attributes. Extra props:

| Prop           | Type                       | Default  | Purpose                                                                   |
| -------------- | -------------------------- | -------- | ------------------------------------------------------------------------- |
| `src`          | `string`                   | —        | Inline SVG string, `data:` URL, or remote URL.                            |
| `name`         | `SvgName`                  | —        | Resolves from `src/assets/svg` → `app/assets/svg` → `public/assets/svg`.  |
| `sanitize`     | `boolean`                  | `true`   | Removes scripts, event handlers, unsafe `href`s, and embedded HTML nodes. |
| `cache`        | `boolean`                  | `true`   | Cache remote SVG markup in memory by `src`.                               |
| `fetchOptions` | `RequestInit`              | —        | Passed to `fetch` for remote SVGs.                                        |
| `loading`      | `ReactNode`                | —        | Rendered while fetching/parsing.                                          |
| `fallback`     | `ReactNode`                | —        | Rendered when parsing/fetching fails.                                     |
| `onSvgLoad`    | `(markup: string) => void` | —        | Called after markup is resolved.                                          |
| `onSvgError`   | `(error: Error) => void`   | —        | Called when loading/parsing fails.                                        |

### Security

`sanitize` is on by default. It strips `<script>`, `<foreignObject>`, `<iframe>`, `<object>`, `<embed>`, inline event handlers, and unsafe `href`/`xlink:href` URLs. Keep it enabled for any untrusted SVG input. If you disable sanitization, only use trusted SVG content.

### Edge cases

- `name` is optional and expects a local SVG name (no import needed). If not found in `src/` or `app/`, it falls back to `/assets/svg/{name}.svg` (public).
- Remote SVGs require CORS headers. Use `fetchOptions` for credentials/headers.
- On the server, DOM parsing is unavailable; render a placeholder with `loading` to avoid a blank SSR pass.
- `fetchOptions` should be memoized to avoid re-fetching on every render.

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run check`: Run Oxlint and Oxfmt
