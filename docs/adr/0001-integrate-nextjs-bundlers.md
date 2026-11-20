# Integrate with webpack and Turbopack in Next.js

Add [a Next.js config wrapper](../../packages/svg/README.md#nextjs-app-router)
for the App Router. Next.js 16 uses Turbopack by default and still supports
webpack. Both bundlers can call the same SVG loaders. The loaders share source
scanning, catalog resolution, type generation, optimization, and compilation
with the Vite plugin. Each integration uses its own bundler for module
transforms, file invalidation, and deferred chunks.

Apply the name registry transform to the browser graph, where the React adapter
resolves names after hydration. Catalog packages and filesystem access stay
in Node.js during the build. Named rendering uses the same URL fallback as
the React adapter.

A static SVG import compiles to a React component and can render inline during
server prerendering. The importing module declares the App Router client
boundary. The SVG query selects the component transform and leaves ordinary
SVG imports to Next.js.

- [Decision issue #50](https://github.com/mhaadiabu/better-svg/issues/50)
- [Next.js server and client modules](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js Turbopack loaders](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack)
