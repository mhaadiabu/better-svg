# Defer a Next.js config wrapper

For `@mhaadi/svg` 0.5.1, document the [manual and bundled Next.js setup](../../packages/svg/README.md#nextjs-app-router) and defer a `withSvg` wrapper. Next.js apps can pass SVG strings from a Node.js Server Component, register a generated bundle in a Client Component, or serve local files from `public/assets/svg/`. A registration call on the server only populates that server's registry. The React adapter resolves names in the browser after hydration, where the Node.js catalog resolver cannot run.

The Vite integration discovers local files, scans for catalog names, injects registration, and refreshes the scan and name declarations in development. A Next.js wrapper could reuse the scanner and type generator. It would also need to run them during builds and development with both webpack and Turbopack, then register icon data in the module graph that renders the icons. Filesystem access and source catalog packages would still belong in Node.js. A webpack-only config hook would leave out the default bundler in Next.js 16.

The explicit setup leaves icon lists and any local name maps with the application. `bundleCatalogIcons` generates autocomplete declarations for the names in the bundle. Revisit a wrapper when there is a concrete use case that needs automatic discovery and a design that can be verified across both bundlers and the App Router server/client boundary.

- [Decision issue #50](https://github.com/mhaadiabu/better-svg/issues/50)
- [Next.js server and client modules](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js 16 bundler defaults](https://nextjs.org/docs/app/guides/upgrading/version-16)
