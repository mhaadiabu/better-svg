# Published and unreleased React SVG comparison

This run used the npm release of Better SVG, **0.4.2**, and the workspace package
at **0.6.2**, whose runtime source matches main at `526a822`. The harness was run
from `605c0ec`. It used the published Vite SVGR plugin 5.2.0, unplugin-icons 24.0.0,
react-svg 19.2.7, react-inlinesvg 4.6.0, and a raw inline React control.

[All profile and workload numbers](report.md) · [Raw Node results](node.json) · [Raw browser results](browser.json)

The same 102 SVGs were available to all profiles. The one-icon build imported
or named only one of them. Named Better SVG profiles disabled pruning for the
full-set builds. The unreleased one-icon builds used default pruning. Byte counts
include React and the page code, with initial and emitted JavaScript shown
separately. The npm release has neither the tree-precompiled format nor
`?better-svg` imports.

## Results

- **Named SVGs.** For 1,000 copies of one raw icon, warm ready time fell from 72.1
  to 50.3 ms and the root-update median fell from 37.7 to 16.1 ms. The one-icon
  page's initial JavaScript fell from 73.8 to 71.7 kB gzip. In the full-set build,
  initial JavaScript rose from 76.6 to 80.8 kB while all emitted JavaScript fell
  from 107.0 to 80.8 kB.
- **Runtime URLs.** Warm ready time for 1,000 copies fell from 72.0 to 53.0 ms.
  The same workload took 123.2 ms with react-inlinesvg and 214.8 ms with
  react-svg. In the one first-use sample per profile, published Better SVG
  recorded 1,000 Resource Timing entries and current Better SVG recorded one.
  Both transferred one SVG response. Full-set initial JavaScript grew from 67.7
  to 72.5 kB gzip.
- **Static imports.** Better SVG built the full set in a median 153 ms, against
  361 ms with raw SVGR and 376 ms with unplugin-icons. SVGR and unplugin-icons
  shipped less JavaScript and became ready faster in the repeated-icon case.
  All three rendered 100 SVGs in the Node SSR probe.
- **Precompiled trees.** The current compact tree saved 7.9 kB gzip in initial
  JavaScript compared with current legacy precompilation. Its warm ready
  median for 100 unique icons was 4.9 ms, compared with 5.5 ms for current
  legacy precompilation and 9.9 ms for the published version.

## Conditions

Five Node repetitions ran on Node 26.13.1 and Vite 8.3.8. Chromium 157.0.8103.78
ran the 72 browser scenarios on the same Intel i7-4600U Linux machine, with a
1200 by 720 viewport and uncompressed loopback HTTP. Each fresh document recorded
one first-use sample, three warmups, and 15 warm samples. All 1,080 warm samples
were valid. All 144 capability cases completed. Capability completion only
means the fixtures rendered. The raw browser JSON records their differences.

The published named profiles failed the Vite development transform probe in
all five repetitions. The current profiles passed. The timings describe this
machine and run. Cold timing is a single observation per profile and workload.
The full suite is React-only and measures Vite, Chromium and React Node SSR.
