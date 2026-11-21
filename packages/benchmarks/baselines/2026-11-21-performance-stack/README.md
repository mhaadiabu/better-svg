# React SVG performance stack comparison

This run compares the BetterSVG 0.5.2 performance stack and npm BetterSVG 0.4.2
with vite-plugin-svgr 5.2.0, unplugin-icons 24.0.0, react-svg 19.2.7,
react-inlinesvg 4.6.0, and an inline React control. Source commit
`bb595b116461ca3998c7d95f0f0d325061e5f4e0` includes the Vite config change
that makes every fixture use one React instance.

[Full report](report.md) · [Raw Node results](node.json) · [Raw browser results](browser.json)

## Results

- **Named SVGs.** The raw profile's 24-icon warm remount median fell from 4.7 to
  3.1 ms. For 1,000 copies, it rose from 70.4 to 81.1 ms, while the update
  median fell from 27.7 to 23.3 ms. Full emitted JavaScript fell from 107.0 to
  81.2 kB gzip, and full initial JavaScript rose from 76.6 to 81.2 kB. The
  one-icon initial graph fell from 73.8 to 72.1 kB gzip.
- **Runtime URLs.** Warm remounts for 1,000 copies took 94.5 ms with BetterSVG
  0.5.2 and 124.2 ms with 0.4.2. React-inlinesvg took 129.4 ms and react-svg
  took 318.4 ms. The 24-icon and 100-unique-icon medians also favored current
  BetterSVG over these two libraries. The 1,000-copy first use produced
  1,000 SVG Resource Timing entries with 0.4.2 and one with 0.5.2. Each
  transferred one SVG response.
- **Static imports.** BetterSVG built the full fixture in 157 ms. SVGR raw,
  SVGR with SVGO, and unplugin-icons took 395, 422, and 470 ms. BetterSVG's full
  initial JavaScript was 73.9 kB gzip, compared with 70.0, 69.9, and 70.3 kB.
  Its 1,000-copy warm remount took 71.7 ms, compared with 42.2, 45.2,
  and 39.4 ms. All four rendered 100 SVGs in the Node SSR probe.
- **Compact trees.** The named compact tree saved 8.2 kB gzip in full initial
  JavaScript compared with the current legacy precompiled profile. Its
  100-unique-icon ready median was 19.0 ms, compared with 6.8 ms for current
  legacy precompilation and 9.7 ms for released legacy precompilation.

## Static import recheck

The full-matrix timing for 100 distinct static icons was noisy. We retested
the same three built profiles in Ardia, rotating order across three rounds.
Each round opened a fresh 1200 by 720 document per profile and recorded three
warmups and nine measured remounts using the same benchmark controller.

For 100 distinct icons, all 81 samples were valid. The median of the round
medians was 5.4 ms for BetterSVG, 4.4 ms for raw SVGR, and 4.5 ms for
unplugin-icons. In the 1,000-copy workload, ten samples had stalled frame
callbacks. Excluding that round for all three profiles, the two complete
rounds gave BetterSVG medians of 49.7 and 64.6 ms, SVGR medians of 27.2 ms in
both rounds, and unplugin-icons medians of 31.7 and 35.2 ms.

The 1,000-copy gap held across both complete rounds. The difference in the
100-icon workload was about 1 ms in the recheck. The production bundle's
largest BetterSVG modules by pre-minification rendered length handle ID
rewriting, paint overrides, and presentation. Those lengths are a way to
locate code to profile, separate from compressed transfer sizes.
[Raw static recheck samples](static-recheck.json)

## Conditions and limits

Node 26.13.1 and Vite 8.3.8 ran five repetitions for each of 18 profiles.
The published named profiles failed all five dev transform probes with a Vite
module-load error. Production builds still completed. The current profiles
completed all five dev probes. The dev timing measures transformed output
after an explicit invalidation. Automatic catalog discovery and registry
rebuild throughput are measured separately.

Ardia reported Chromium 158.0.0.0. The 72 browser runs used fresh documents at
1200 by 720 and uncompressed loopback HTTP on one Intel i7-4600U Linux machine.
All 1,080 warm samples and all 144 capability cases completed. Inspect the
capability table for behavior differences. Each first-use value is a single
observation, and warm samples in one document share a browser session. Large
workloads showed wide timing spreads. The matrix measures the whole stack
against the npm baseline and competing workflows. It cannot attribute a
browser change to a specific PR.

The same 102 assets were available to all timing profiles. Eight capability
fixtures were kept separate. Full-set named builds disabled pruning. Gzip
figures include React and the benchmark page, and distinguish initial graphs
from all emitted JavaScript. Reproduction commands are in the
[benchmark README](../../README.md).
