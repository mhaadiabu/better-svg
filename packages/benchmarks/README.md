# SVG workflow benchmarks

This private workspace compares React SVG workflows before changing Better SVG's
optimizer. It does not change the published package or enable optimization by
default. It uses Node scripts, Vite, and an actual browser, not a new test framework.

## Comparison groups

- Static assets: Better SVG with optimization off, its current configuration, and
  an experimental narrow configuration. Precompilation is a separate variant.
  Compare with SVGR with its optimizer disabled and enabled, plus a React inline
  markup control. The control uses `dangerouslySetInnerHTML`, not generated React
  child elements, and does not sanitize or scope IDs.
- Runtime URLs: Better SVG and `react-svg`, loading the same same-origin files.
  Both retain their normal library caches. Fresh URLs isolate the first sample
  from the browser's HTTP cache; later samples reuse the URL.
- Node SSR: count rendered SVGs before comparing timings. An empty or wrapper-only
  response is unsupported for static SSR, not a performance win.

Astro, automatic catalog discovery, React Native, Flutter, real mobile hardware,
and browser engines other than the recorded engine require separate runs. Desktop
viewport emulation is not a mobile-device measurement.

## Corpus and correctness

Use identical input files for every adapter. Start with a deterministic sample of
100 Lucide catalog icons, the repository's logo and favicon, and hand-authored
capability fixtures. Record input hashes, dependency versions, and the source
commit. Allow additional local exports without modifying the originals. The small
repository sample does not establish representative Figma or Inkscape behavior.

Keep capability fixtures outside the timing corpus. Check IDs, references,
explicit paints, masks, accessible text, root attributes, sizing, external CSS,
and sanitizer behavior. Report unsupported capabilities instead of adding hidden
helpers to competitors. Raw and optimized outputs must not be treated as
equivalent merely because their file sizes differ.

## Measurements

- Independent production builds per adapter, including emitted JavaScript, CSS,
  and SVG assets. Record raw, gzip, and Brotli sizes. Shared React cost stays in
  every build; also report the inline control, not a selectively subtracted size.
- Fresh-process Vite startup to entry-response readiness, production build time,
  and an SVG edit followed by transformed-module readiness. Do not label that
  last metric browser HMR or include an unrequested page reload in it.
- Browser first mount, subsequent remounts, and root-attribute updates. Separate
  one icon, many instances of one icon, and many unique icons. Wait for all SVGs,
  inspect final dimensions and computed paints, then record a paint-opportunity
  proxy using two animation frames. This is not a physical display timestamp.
- Runtime request counts and transferred bytes, including duplicate requests.
  Count failures and timeouts rather than dropping slow or failed samples.
- Node SSR latency and compressed HTML only for adapters that render the expected
  number of SVGs. This is component serialization, not server TTFB.
- Raw samples plus median and p95. Record repetitions, viewport, browser version,
  Node version, operating system, CPU, and cache state. Module-import, HTTP,
  library-cache, and operating-system file-cache states are different and must be
  described separately.

Warm up before warm measurements, rotate adapter order, and keep workloads
sequential. Do not infer memory leaks from one heap reading. Browser memory and
long-task APIs are optional diagnostics, with availability recorded.

## Experimental optimizer

The candidate is an explicit list of document-cleanup plugins and a restricted
`convertPathData` configuration. It does not convert shapes, merge paths or
groups, inline CSS, remove IDs, or strip default attributes. It is a benchmark
candidate, not a released preset or a promise of lossless geometry. SVGR's normal
optimizer uses the version it declares; do not silently replace it with ours.

SVGR's optimizer package declares `deepmerge` but does not import it in its
published implementation. The scoped workspace override removes that unused
dependency, which has advisory GHSA-gcqx-w48m-w2h4 and no published fix. It does
not replace the optimizer or modify SVGR's implementation.

## Reporting policy

Commit the specification, scripts, and a bounded baseline report. Keep generated
apps and builds in `.cache/`. Do not run browser benchmarks as timing gates in
shared CI. Correctness failures disqualify only the affected comparison, not all
other workflows. No overall winner, mobile extrapolation, or claims about untested
exports should be drawn from a desktop pilot.
