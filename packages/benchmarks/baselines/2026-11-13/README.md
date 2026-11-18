# November 13, 2026 pilot

Keep SVGO opt-in. This corpus does not justify more aggressive optimization or
writing our own geometry optimizer. The narrow candidate preserves the observed
capabilities, but needs real editor exports and rendering checks before shipping.

## What ran

- 11 React profiles, 102 timing assets, and eight separate capability fixtures.
  The timing assets contain 100 sampled Lucide icons and two repository assets.
  The unique-icon scenario samples 100 entries across the whole list.
- Five rotated production-build samples and five fresh-process development
  samples per profile. SSR eligibility checks precede 30 warm serializations for
  the three eligible profiles.
- 33 browser runs, each with one first-use sample, three unrecorded warmups, and
  15 recorded warm samples. All 495 warm samples passed SVG count, dimensions,
  update count, error, and frame-readiness checks. All 88 capability cases loaded.
  Loading a capability case does not mean that its semantics were preserved.
- Node 26.13.1 on Linux 7.2.15, Intel i7-4600U, four logical CPUs. The browser was
  Arch Chromium 157.0.8103.38 in headless mode, with a 1280 by 800 top-level
  viewport and fresh 1200 by 720 frames, device scale factor one, no CPU or
  network throttling, and uncompressed loopback HTTP.
- React and React DOM 19.2.6, react-svg 19.2.6, SVGR 8.1.0. Better SVG uses
  SVGO 4.1.0. SVGR uses its own declared SVGO 3.3.5, not a substituted optimizer.

The measured implementation is commit
`d206c4d401dc933cd26a857e074237a1c3fb82fe`. The raw files contain input hashes,
the experiment hash, environment details, samples, and capability observations.
See [the generated report](report.md), [Node results](node.json), and
[browser results](browser.json).

## Size and build cost

| Static profile                            | Entry JS gzip bytes | Total emitted gzip bytes | Build median ms | Warm 1000-icon ready median ms |
| ----------------------------------------- | ------------------: | -----------------------: | --------------: | -----------------------------: |
| Better SVG, optimization off              |               80471 |                   111121 |          157.45 |                          69.50 |
| Better SVG, current preset                |               80411 |                   111063 |          272.53 |                          61.70 |
| Better SVG, narrow candidate              |               80418 |                   111069 |          161.06 |                          54.30 |
| Better SVG, precompiled, optimization off |               88217 |                   118870 |          164.80 |                          59.20 |
| SVGR, optimization off                    |               69975 |                    70253 |          324.73 |                          17.60 |
| SVGR, optimization on                     |               69837 |                    70120 |          415.09 |                          14.50 |
| Inline markup control                     |               69899 |                    70178 |          116.15 |                          34.40 |

All entries include React and the benchmark controller. The roughly 50 to 60 byte
differences between Better SVG optimizer variants are too small to justify a
compatibility tradeoff. Profile-specific instrumentation also contributes to
these bundle differences. This catalog-heavy corpus is already compact.

Better SVG's static builds emit an additional XML chunk of about 30.4 kB gzip.
The recorded initial resource lists do not fetch that chunk. Do not describe
total emitted bytes as initial downloaded JavaScript. The server sends raw,
uncompressed bytes; gzip and Brotli sizes are calculated offline per file.

Precompilation increases the entry bundle by 7746 gzip bytes over raw registration.
The current plugin serializes both original markup and precompiled trees. Warm
timing differences in one run do not establish that this added payload pays off.
First-use results remain in the raw data, but each is only one observation.

SVGR performs better in this heavy static React workload. Better SVG's sanitizer,
instance IDs, and descendant paint behavior are different work, so this does not
identify a single bottleneck or justify removing those features. It does justify
profiling the adapter separately from the optimizer.

## Compatibility observations

The current Better SVG preset changes six of the eight capability cases relative
to optimization off, with and without precompilation:

| Fixture           | Observed change with current preset                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `paint-none`      | A path with explicit `stroke="none"` gains the caller's blue stroke.                               |
| `mask-paint`      | The black circle inside the mask becomes blue after a caller fill override.                        |
| `caller-gradient` | The gradient disappears before caller props apply. The root fill references missing `callerPaint`. |
| `accessible`      | `role="img"` disappears. The title and description remain.                                         |
| `css-shape`       | A red rectangle becomes a blue path under the supplied external selectors.                         |
| `css-hierarchy`   | Two paths merge into one, so the second-path blue selector stops matching.                         |

The narrow candidate retains the observed paints, role, title, description, CSS
structure, and reference resolution in these cases. It also retains per-instance
ID separation and Better SVG's removal of the inert `foreignObject` fixture.
There were no dangling labels. This is DOM and computed-style evidence, not
pixel-equivalence, animation, or screen-reader validation. Float precision eight
is still a geometry approximation.

SVGR's normal optimizer also changes paints, removes accessibility information,
breaks external selectors, and removes the initially unused caller gradient in
these fixtures. File-level ID prefixes do not prevent repeated instances from
sharing IDs in the referenced-gradient and mask cases. The unoptimized SVGR and
inline controls also have duplicate IDs. react-svg renumbers referenced paint
IRIs but leaves duplicate label IDs in this fixture. These observations describe
default configurations, not a claim that these tools promise Better SVG's API.

The runtime react-svg adapter applies supplied props to its documented wrapper.
It does not provide Better SVG's descendant recoloring semantics. Opacity updates
are visually comparable, but caller-paint capability outcomes are not equivalent.
The inert foreign-content fixture is not a security audit. Optimization must not
replace sanitization or change URL trust rules.

## Separate findings worth addressing

1. Better SVG's static-directory plugin fails Vite 8.3.3 development import
   analysis in all six static profiles, five times each. The generated directory
   exists, but the error reports it as an unresolved import from `core/local.js`.
   A direct Vite development page also showed the error overlay. Directory
   `addWatchFile` registrations appear responsible, but that cause needs a focused
   fix. Production builds succeed. This is independent of enabling SVGO, and
   failed dev samples are not counted as fast results.
2. Mounting 1000 copies of the same fresh URL produces 1000 SVG resource-load
   entries in Better SVG, versus one in react-svg. Both transfer only one
   resource and 595 bytes on this server. This is duplicate fetch work, not
   1000 network transfers. First-use readiness was 1089.1 ms versus 204.1 ms in
   this single observation. Warm remount medians went the other way, 55.3 ms
   versus 226.0 ms, with zero new SVG loads for both. The resolver caches completed
   public responses but does not share an in-flight response. Any fix needs
   per-consumer cancellation and must preserve the existing fetch-option and
   public-response cache restrictions.
3. Better SVG's React adapter and react-svg produce zero SVGs in Node SSR here.
   SVGR and inline markup produce all 100. Empty or wrapper-only output is
   ineligible for a static SSR speed comparison. This says nothing about Better
   SVG's Astro adapter, which is not part of this run.

## Recommended next work

Fix and verify the Vite development failure in its own PR. Treat URL request
sharing and static React rendering costs as separate investigations. They are
not reasons to expand SVGO's plugin list.

Collect a licensed set of real local exports with gradients, masks, text, and
editor metadata. Use the same files across tools, then add browser raster,
external CSS, and animation checks before adopting the narrow preset. If the
benefit is meaningful there, maintain a small compatibility policy around SVGO
and cache results by input, configuration, and optimizer version. Do not write a
new path optimizer based on these results.

Keep the current optimization default off. Replacing the opt-in preset and
changing the default are separate decisions. Custom plugin lists can remain an
explicit compatibility escape hatch.

## Limits and reproduction

Run the commands in the [workspace guide](../../README.md). To regenerate the
tables from these committed raw files without running new measurements:

```sh
pnpm --filter @better-svg/benchmarks bench:report baselines/2026-11-13/node.json baselines/2026-11-13/browser.json
```

The recorded browser used a separate temporary Chromium profile, default browser
sandboxing, `--headless`, `--no-first-run`, `--no-default-browser-check`,
`--window-size=1280,800`, and loopback-only remote debugging. The collector ran
through Chromium's DevTools protocol without an additional automation framework.
Initial attempts in T3's embedded preview stalled animation frames despite
reporting visible documents. Those were environment-calibration attempts, not
the committed timing run. The final run has no frame-stalled samples.

Browser processes and filesystem caches are not reset per document. Build
measurements share a Node process and rotate order. SSR timings use a fixed-order
single process, so treat them as exploratory serialization diagnostics, not an
isolated cross-tool latency ranking. The nearest-rank p95 of 15 warm samples is
the slowest sample, not a stable tail-latency estimate. No significance test,
confidence interval, or cross-machine repeatability claim is made.

This does not cover representative Figma or Inkscape exports, real mobile
hardware, GPU presentation, other browser engines, React Native, Flutter, Astro,
hydration, automatic catalog discovery, bandwidth-limited delivery, unplugin-icons,
or a custom optimizer. Those require separate experiments. No package source,
version, changelog, release tag, or published behavior changes in this work.
