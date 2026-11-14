# React rendering and URL request fixes

These measurements qualify PRs [#60](https://github.com/mhaadiabu/better-svg/pull/60)
and [#61](https://github.com/mhaadiabu/better-svg/pull/61). They do not change SVGO.

The React adapter renders available markup in its first client commit and
preserves child DOM on root-only updates. The resolver shares explicitly public
URL responses, with independent cancellation and separate redirect policies.
Private or unmarked responses trigger independent requests as soon as headers
arrive, without waiting for the original body. Custom fetch options and
`cache={false}` bypass request coordination and markup reuse.

## Method and raw results

- Baseline source: `d8f2e50cbb3a4af13a53075c76e4ce8b882473c7`, package version 0.6.0.
  Its package source is identical to the original pilot's `d206c4d` source.
- Fixed source: `223a103d8963aefed554b7f94e4274cd4e654362`, package version 0.6.2.
- [comparison.json](comparison.json) contains two interleaved blocks covering six
  profiles and three scenarios. Each run uses a fresh document, one first-use
  sample, three unrecorded warmups, and 15 recorded warm samples. Phase order
  alternates per pair, and profile order rotates. There are 72 runs, 1,152
  recorded samples, and 30 warm samples per profile/scenario/phase.
- Both implementations use the existing benchmark scripts, identical inputs,
  dependencies, and production minification. Each run swaps only generated
  application bundles. Fresh navigation nonces and experiment-hash checks
  prevent a previous document from supplying the next run's results.
- Earlier sequential measurements showed substantial control drift. No speedup
  claim here relies on those batches. Interleaving reduces order bias but does
  not establish confidence intervals or cross-machine repeatability.
- Node 26.13.1, Linux 7.2.15, Intel i7-4600U, four logical CPUs. Dedicated headless
  Chromium 157.0.8103.38 uses a fresh temporary profile, a 1200 by 720 viewport,
  device scale factor one, uncompressed loopback HTTP, and no CPU or network
  throttling. OS caches, background work, and CPU frequency remain uncontrolled.
- The separate full fixed matrix retains the original collector's 1280 by 800
  parent and 1200 by 720 child frames. See [browser.json](browser.json),
  [node.json](node.json), and the [generated report](report.md). All 528 recorded
  samples pass its readiness, dimensions, update-count, and error checks.

All 1,080 interleaved warm samples pass those same checks. One baseline cold URL
sample times out; it remains in the raw results and is described below. No failed
sample counts as a fast result. First-use observations are too few to support a
stable cold-start distribution. A p95 from this small sample is not a reliable
tail-latency estimate.

## Warm React results

Values are medians in milliseconds. Ready time waits for the expected SVG count.
Update time measures the root-prop update commit. The fixed first commit includes
available SVG content, whereas the baseline's first commit could contain only a
loading placeholder. Initial commit duration alone is not an equivalent measure
of readiness across these implementations.

### 1,000 copies of one icon

| Profile                      | Ready before | Ready fixed | Update before | Update fixed |
| ---------------------------- | -----------: | ----------: | ------------: | -----------: |
| Better SVG, optimization off |         64.8 |        46.1 |          35.3 |         14.7 |
| Better SVG, precompiled      |         72.8 |        42.6 |          39.6 |         14.7 |
| Better SVG, URL              |         55.9 |        49.0 |          29.1 |         13.0 |
| SVGR, optimization off       |         15.9 |        14.9 |           5.8 |          5.7 |
| Inline markup control        |         25.8 |        29.0 |          21.2 |         22.5 |
| react-svg                    |        202.9 |       217.1 |          10.2 |         11.4 |

### 100 unique icons

| Profile                      | Ready before | Ready fixed | Update before | Update fixed |
| ---------------------------- | -----------: | ----------: | ------------: | -----------: |
| Better SVG, optimization off |         11.8 |         9.1 |           7.2 |          2.6 |
| Better SVG, precompiled      |         12.1 |        11.5 |           7.9 |          2.8 |
| Better SVG, URL              |         11.7 |        12.6 |           7.5 |          3.8 |
| SVGR, optimization off       |          7.2 |         7.4 |           3.2 |          2.8 |
| Inline markup control        |          7.7 |         7.9 |           7.4 |          6.2 |
| react-svg                    |         15.6 |        19.9 |           1.2 |          1.4 |

For one icon, the raw Better SVG warm-ready median changes from 1.7 to 0.6 ms;
the URL profile changes from 2.3 to 0.7 ms. These small durations should not drive
an application-level performance claim.

The update improvement has a verified mechanism. An existing-suite regression
case checks that changing root props keeps the same child DOM node. The baseline
always supplied a new HTML-prop object, so React replaced unchanged children.
Another case verifies one commit for available markup. SVGR still mounts static
icons faster here. These fixes do not remove Better SVG's sanitization, ID
handling, or dynamic presentation work.

## Cold shared URLs

Both fixed 1,000-copy first-use URL mounts load successfully with one SVG
Resource Timing entry, one transferred response, and 595 transferred bytes.
Their observed ready times are 134.7 and 111.9 ms.

The successful baseline first-use sample records 1,000 resource-load entries,
one transferred response, 595 transferred bytes, and 1,314.8 ms to readiness.
The other baseline cold sample times out. Its readiness capture has zero SVGs,
938 recorded resource loads, and 473 transferred responses totaling 281,435
bytes. Late updates reach 271 SVGs. The recorded 47,264.5 ms is not a valid ready
time. It would be misleading to describe every baseline load entry as a separate
network transfer, or to claim this stressed run always coalesces to one transfer.
The failure remains in the data rather than being rerun away.

All recorded warm URL samples pass. This experiment does not establish behavior
under real network latency, every HTTP cache policy, or other browser engines.
Existing unit regressions cover private/unmarked/no-store/no-cache responses,
custom options, independent cancellation, abandoned requests, retries, slow
private bodies, and redirect-policy separation.

## Compatibility and remaining costs

All 88 fixed capability cases load. After normalizing generated IDs, their
observations match the original pilot. That includes the original failures:
the current SVGO preset still changes six fixtures. This is not a compatibility
guarantee for that preset. The narrow optimizer candidate remains experimental.

The combined entry bundle increases from 80,471 to 81,137 gzip bytes for raw
registration and from 71,464 to 72,068 bytes for URLs. Entries include React and
benchmark instrumentation, not just the library. The extra XML deployment chunk
is still distinct from initially fetched JavaScript. No dependency is added.

The six static profiles still fail Vite 8 development directory-import analysis.
All five production builds per profile succeed. React SSR output remains the
loading placeholder, and hydration preserves it before client rendering. Empty
React SSR output is not eligible for a static SSR speed comparison. Astro SSR,
React Native, mobile hardware, editor-export corpora, animations, and other
browser engines remain outside these timing measurements.

## Verification and audit status

- `pnpm run test --force`: 16 existing files, 328 passed, 1 skipped. No new test
  framework. Cases cover callback timing, Strict Mode, hydration, cache bypass,
  sanitization, instance references, source changes, paint updates, and child
  identity, alongside the request-policy regressions.
- `pnpm run check-types --force`, `pnpm run build`,
  `pnpm --filter @mhaadi/svg check:package`, and `pnpm lint` pass.
- `pnpm audit` now reports two existing Astro 7.3.5 advisories. Neither PR changes
  those dependencies: [GHSA-mh32-jxcr-mh9f](https://github.com/advisories/GHSA-mh32-jxcr-mh9f)
  is low-severity dynamic-tag attribute injection;
  [GHSA-r3h5-4585-7x3w](https://github.com/advisories/GHSA-r3h5-4585-7x3w) is
  moderate-severity file access through the Node adapter's image endpoint.
  The audit's patched range covering both is Astro 7.4.7 or newer. The docs use
  static output; this is not proof of exploitability in this deployment or in
  every consumer. Address the dependency upgrade in a separate security PR.

Merge the benchmark workspace in #59, request sharing in #60, then the React
changes in #61. Versions and changelogs are prepared. No release, publication,
or tag is created.
