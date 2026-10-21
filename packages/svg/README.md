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

## Dependencies

The dependency picture, stated plainly: `@xmldom/xmldom` is a real runtime
dependency, imported only by the Astro and React Native adapters. Browser
adapters parse with the browser's own XML parser and never load it. Every
framework peer (React, React Native, Vue, Svelte, Solid, Astro, Angular, Vite)
is optional, so install only what you import. `svgo` is an optional peer used
by the local-discovery plugins at build time only: if you do not enable the
SVGO pass, svgo is never loaded, and when it is enabled it never ends up in
your browser bundle either.

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

| Import                          | Framework              |
| ------------------------------- | ---------------------- |
| `@mhaadi/svg`                   | React (default)        |
| `@mhaadi/svg/react`             | React 18+              |
| `@mhaadi/svg/react-native`      | React Native           |
| `@mhaadi/svg/vue`               | Vue 3                  |
| `@mhaadi/svg/svelte`            | Svelte 5 (runes)       |
| `@mhaadi/svg/solid`             | Solid 1.9+             |
| `@mhaadi/svg/astro`             | Astro 5+               |
| `@mhaadi/svg/angular`           | Angular 20+            |
| `@mhaadi/svg/vite`              | Vite registration      |
| `@mhaadi/svg/vite/plugin`       | Vite 5+ config plugin  |
| `@mhaadi/svg/astro/integration` | Astro local discovery  |
| `@mhaadi/svg/local`             | Local SVG registration |
| `@mhaadi/svg/catalog`           | Icon package catalog   |

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

`sanitize` is enabled by default. Sanitization is an element allowlist: only
static SVG elements survive, so scripts, embedded HTML, stylesheets, and
animation elements are removed wholesale, along with every event-handler
attribute whose local name starts with `on`, in any namespace (`xlink:onclick`
included). Href-like attributes are also matched by namespace-resolved local
name, so `xlink:href` and re-prefixed variants such as `evil:href` are checked
exactly like `href`, and the rules differ per element:

| Element                | Allowed href targets                                                                                                           | Anything else                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `<use>`                | same-document fragments (`#id`, empty)                                                                                         | stripped, including remote `https:` and protocol-relative references                         |
| `<image>`, `<feImage>` | same-document fragments (`#id`, empty), relative and remote URLs (protocol-relative included), `blob:`, non-SVG `data:image/*` | `data:image/svg+xml` stripped in all spellings, including `svg+xml-compressed`               |
| `<a>`                  | same-document fragments (`#id`, empty), remote, relative, `blob:`                                                              | every `data:` target stripped                                                                |
| other elements         | same-document fragments (`#id`, empty), remote, relative, `blob:`, `data:image/*`                                              | unknown schemes stripped                                                                     |
| `style` attribute      | `url(#...)` same-document fragments                                                                                            | remote and `data:` `url()` targets stripped, including whitespace-padded `url (…) ` spelling |

Keep it on for any untrusted SVG input.

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
root, slash-separated for nested names, and must contain no globs or `..`
components; anything else fails plugin setup with `SVG directories must be
paths relative to the project root without globs or '..'.` The first
directory wins when names overlap. Names are normalized at registration:
leading slashes and a trailing `.svg` suffix are trimmed, so
`/icons/logo.svg` and `icons/logo` resolve to the same entry. Symlinked files
are followed, symlink loops are skipped, and explicit calls to
`registerLocalSvgs` from `@mhaadi/svg/local` override discovered entries. A
missing name still falls back to `/assets/svg/{name}.svg`.

Discovery includes every SVG in the configured directories in the bundle.
Keep those directories limited to assets the app uses. Development reloads
the page when an SVG is added, edited, or removed. No optimization runs
unless you enable the optional SVGO pass below. The existing
`import "@mhaadi/svg/vite"` registration remains available for default
directories, but the config plugin handles custom paths and Astro SSR.

The same plugin accepts `catalog: true` to auto-register icon-package
names that appear in your source; the scan behavior, warnings, and options
live under [Icon catalog](#icon-catalog).

## Optional SVGO pass

The local-discovery plugins (`@mhaadi/svg/vite/plugin` and
`@mhaadi/svg/astro/integration`) accept an `svgo` option that runs SVGO over
every discovered file before registration. The pass is off by default and
nothing is plumbed through unless you opt in. Remote, `?raw`, or manually
registered SVGs are never touched; catalog icons found by the `catalog`
scan go through the same pipeline because the plugin produces their markup
the same way.

Install svgo first; it is an optional peer dependency:

```bash
pnpm add -D svgo
```

`svgo: true` runs a preset-safe list of `#default` plugins whose settings we
control: `preset-default` with `cleanupIds`, `removeDesc`, `minifyStyles`,
and `removeDeprecatedAttrs` disabled. Those off plugins are the ones most
likely to break a rendering pipeline that rewrites IDs and
accessibility references; icons referencing gradients, masks, or clip paths
keep working. The `preset` and `plugins` options are incompatible;
combining them in the same settings object fails the build.

```ts
localSvgs({ dirs: ["src/icons"], svgo: true });
```

You can switch the pass per file (per-collection: match name prefixes) with
a `filter` predicate that receives the discovered name, opt out per name,
and pass any SVGO option (`multipass`, `floatPrecision`, `js2svg`) next to
it. Names are relative to each configured directory, so a file
`src/icons/social/github.svg` in `dirs: ["src/icons"]` passes the name
`social/github`:

```ts
localSvgs({
  dirs: ["src/icons", "src/illustrations"],
  svgo: {
    filter: (name) => name.startsWith("social/"),
    multipass: true,
    floatPrecision: 3,
  },
});
```

For direct control, pass a `plugins` list. It is a full SVGO plugin
configuration: names are validated against the installed svgo's built-in
plugins, unknown names fail the build, and the SVGO settings you choose are
sent to svgo as given.

```ts
localSvgs({
  dirs: ["src/icons"],
  svgo: { plugins: ["preset-default", { name: "cleanupIds" }, "removeViewBox"] },
});
```

`svgo` also accepts a function `(name) => options | false` when different
files need different settings.

### Build errors

The plugin fails the build with the offending file name in the message:

| Trigger                                             | Message                                                                                                                                                        |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `svgo` option enabled without svgo installed        | `` `The SVGO pass is enabled, but "svgo" is not installed. Add svgo to your development dependencies (for example `pnpm add -D svgo`) and rerun the build.` `` |
| A custom/pass-through SVGO config errored on a file | `SVGO pass failed for "<name>": <message>`                                                                                                                     |
| `preset` set together with `plugins`                | `The "preset" option and the "plugins" list are incompatible; pass one or the other.`                                                                          |
| Unknown plugin name in a `plugins` list             | `Unknown SVGO plugin "<name>". Known built-in plugins: <sorted list>.`                                                                                         |
| SVGO produced empty output for a non-empty file     | `svgo produced no markup, the SVG is likely malformed.`                                                                                                        |
| Absolute path, glob, or `..` in `dirs`              | `SVG directories must be paths relative to the project root without globs or '..'.`                                                                            |
| Markup that is not an SVG reached `precompiled`     | `Precompile pass failed for "<name>": markup is not a valid SVG document.`                                                                                     |

At runtime, `registerLocalSvgs` validates a `precompiled` tree and throws on
malformed input (`Precompiled SVG "<name>" is malformed: expected a parsed svg
tree.` or, if the tree fails sanitization, `Precompiled SVG "<name>" is not a
valid sanitized svg tree.`), and rejects a precompiled key with no matching
markup entry (`Precompiled SVG "<name>" has no registered markup entry.`),
and refuses non-inline markup (`Precompiled SVG "<name>" expects inline svg
markup.`).

### What breaks and who fixes it

SVGO rewrites markup that the renderer and your app might depend on:

- `preset-default` and `cleanupIds` can remove or rename `id` attributes.
  External CSS, `url(#...)` references from other documents, and the
  `uniqueIds={false}` workflow then render without their references.
- Style-, shape-, and group-related plugins change elements and attributes
  that descendant CSS selectors and `fill`/`stroke` overrides match against.
- Path and number rounding changes sub-pixel rendering.

These are accepted risks in an opt-in pass, not bugs: audit optimized
markup instead of relying on visual regression. Keep the discovered SVGs in
version control, run the same `svgo` version locally and in CI, and diff
the registered output (or key attributes such as `id`, `url(#...)`,
`viewBox`) between configs in a snapshot test. When output changes, update
snapshots deliberately after reviewing the diff. Run an icon-by-icon visual
check when you choose the config, once; the CI markup audit is what keeps
later upgrades honest.

## Icon catalog

`@mhaadi/svg/catalog` resolves `collection:icon` names from icon packages
already installed in your `node_modules`. No network access, no per-icon
imports. Register the names you use up front, then pass them to `name` like any
local SVG:

```astro
---
import SVG from "@mhaadi/svg/astro";
import { registerCatalogIcons } from "@mhaadi/svg/catalog";

registerCatalogIcons(["lucide:house", "tabler:settings", "phosphor:bell", "hugeicons:home-01"]);
---

<SVG name="lucide:house" width={24} height={24} />
```

```tsx
// React server components: register in a module loaded on the server.
import { registerCatalogIcons } from "@mhaadi/svg/catalog";

registerCatalogIcons(["lucide:house", "tabler:settings"]);
```

For each name, resolution checks installed packages in this order: the official
`@hugeicons/core-free-icons` package for hugeicons (kebab-case names are accepted,
`arrow-left-01` for its `ArrowLeft01Icon` module), the `@iconify-json/<collection>`
data package (works for every Iconify collection), the full `@iconify/json`
package, then plain SVG files shipped by the icon packages themselves:
`lucide-static` for lucide, `@tabler/icons` (outline first, then filled) for
tabler, and the regular weight of `@phosphor-icons/core` for phosphor.

Registration runs in Node only, where reading `node_modules` is possible: Astro
SSR, server components, or your own build-time glue. Browser-only bundles need
the Vite plugin from [Automatic local discovery](#automatic-local-discovery)
instead. Local files discovered by the plugin keep precedence over catalog
icons, and an unregistered catalog name falls back to the
`/assets/svg/{name}.svg` URL like any missing local name.

A name that resolves to no installed source is skipped, not rejected: a
misspelled icon or collection does not throw at registration. The name then
falls back to the `/assets/svg/{collection:icon}.svg` URL, the request 404s,
and the adapter's `fallback` state renders. To catch typos, compare the
return value, the list of names that actually registered, against the list
you passed in.

Names also accept a single trailing wildcard. `registerCatalogIcons(["lucide:*"])`
registers every name the installed lucide source can serve, and
`["lucide:arrow*"]` matches a name prefix; `bundleCatalogIcons` expands the
same list form, so an offline bundle can cover a whole collection. Expansion
logs the icon count and approximate markup size once it exceeds 250 icons or
256 KB, and an explicit name in the same list still fails `bundleCatalogIcons`
when it cannot resolve.

### Automatic registration

Vite-plugin projects skip the array entirely. Enable the source scan and the
plugin registers what your code actually references, resolved from the same
installed packages:

```ts
// vite.config.ts or astro.config.mjs
localSvgs({ catalog: true });
```

The scan reads text files under the project root (skipping `node_modules`,
`dist`, `.git`, and similar ignored directories), with the extensions
`ts, tsx, js, jsx, mjs, astro, vue, svelte, html, mdx`, and matches
`collection:icon` literals in the same alphabet the resolver validates. What
it does with what it finds:

- Scanned registration is appended after the `dirs` registration with
  `override: false`, so local files and your own `registerLocalSvgs` calls
  keep precedence. React Native and other offline runtimes stay on
  `bundleCatalogIcons`; nothing about the fallback chain changes.
- A name whose collection is installed but that resolves to nothing logs a
  warning naming the files involved (a typo, or a hidden icon).
  `catalog: { strict: true }` escalates that case to a build error under the
  same `No source found for these catalog icons` message the bundler uses.
- A referenced collection with no installed package logs the install hint,
  e.g. `Add @iconify-json/lucide (or lucide-static) and rerun.`
- Dynamic names built from template literals (`` `lucide:${id}` ``) cannot
  resolve by scanning; they log a hint pointing at `registerCatalogIcons`
  and keep rendering through the `/assets/svg/{name}.svg` fallback.
- Warnings are advisory by default; only `strict` fails the build, and it
  fails only on names whose collection is installed.
- Narrow the scan with `catalog: { include: ["src"] }`, add ignored paths
  with `exclude`, lower `maxFileBytes` (default 512 KB), or pass
  `searchPaths` when icon packages live outside the project. The `svgo` and
  `precompiled` plugin options apply to scanned icons exactly as they do to
  discovered files.

In dev the scan result is cached per plugin instance and re-scanned on
file changes: when a scanned file changes, the plugin re-runs the scan and
reloads the page if the registered set changed. When nothing is found the
plugin emits nothing.

## Offline icon bundles

`bundleCatalogIcons` (also from `@mhaadi/svg/catalog`) writes the resolved icon
sources into a plain data module your app imports, instead of registering them
on a machine that can read `node_modules`. Use it when the renderer runs where
neither the filesystem nor `fetch` is a fit: React Native, or a browser bundle
without the Vite plugin:

```ts
// scripts/generate-icons.ts, run once or in a dev loop
import { bundleCatalogIcons } from "@mhaadi/svg/catalog";

bundleCatalogIcons({
  names: ["lucide:house", "tabler:settings"],
  out: "./src/icons/generated.ts",
});
```

The output is a single map of name to inline SVG source:

```ts
// src/icons/generated.ts (generated)
export const bundledIcons: Record<string, string> = {
  "lucide:house": "<svg ...>",
  "tabler:settings": "<svg ...>",
};
```

`out` accepts `.ts`, `.mts`, `.js`, or `.mjs`; the extension picks the
generated format, TypeScript is the default without an `out` path, and pass
`format` explicitly when `out` ends in anything else. Two things fail loudly
instead of silently:

```text
No source found for these catalog icons: lucide:mistyped-name
Unsupported bundle output extension: ./icons/data.txt. Use .ts, .mts, .js, or .mjs, or set format.
```

Register the map with the local registry your adapter already resolves `name`
through, then use the icons like any local SVG:

```tsx
// React Native
import { SVG } from "@mhaadi/svg/react-native";
import { registerLocalSvgs } from "@mhaadi/svg/local";
import { bundledIcons } from "./icons/generated";

registerLocalSvgs(bundledIcons, { override: false });

const Home = () => <SVG name="lucide:house" size={24} />;
```

Generated sources render inline without fetching, so no name ever falls back to
the `/assets/svg/...` URL and no request is made at runtime. Emitting fails if
any requested name has no installed source, so a stale icon name is a build
error, not a runtime gap.

## Build-time precompilation

The local-discovery plugins also accept a `precompiled` option that turns the
pass into a build-time mode: the plugin parses and sanitizes every discovered
file during the build (consuming the SVGO-optimized markup when the pass is
on) and registers the resulting tree, so mounting `<SVG name="...">` skips XML
parsing and the sanitize pass and only does per-instance work such as id
scoping and color overrides. The runtime registration mode stays the default,
and dynamic sources keep the full runtime path.

```ts
localSvgs({ dirs: ["src/icons"], svgo: true, precompiled: true });
```

The trade, in one sentence: build-time mode ships the parsed tree next to the
registered markup so icons pay their parse once at build instead of once at
run, at the cost of a larger bundle for every discovered icon. Precompiled
trees are generated by the plugin's own build pass, never by hand; do not
feed it markup you did not produce with this pipeline. Registration validates
and re-sanitizes the tree and rejects malformed input with a build error.

Without the plugin, `registerLocalSvgs` accepts the same shape as an escape
hatch for assets known at build time:

```ts
import { registerLocalSvgs } from "@mhaadi/svg/local";

registerLocalSvgs(
  { "brand/logo": "<svg ...</svg>" },
  {
    override: false,
    precompiled: { "brand/logo": { node: tree } },
  },
);
```

Precompiled registration primes the parser your runtime uses: browser
adapters parse with the browser's XML parser and the Astro adapter with
`@xmldom/xmldom`. Seeding is best-effort, so a failed prime costs a re-parse
at runtime and never a thrown error.

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
