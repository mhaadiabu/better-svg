# React SVG benchmark pilot

Library source commit: bb595b116461ca3998c7d95f0f0d325061e5f4e0.
Better SVG published: 0.4.2. Workspace: 0.5.2.
Fixture hash: 1747c509871ba55900a9c9df35f260b0c3acfe382f80447bea08527aded506cb.

This is a local desktop pilot, not a universal ranking. Build sizes include the benchmark controller and React. Runtime URL profiles also emit separate SVG assets. Emitted deployment size is not the same as bytes fetched for one scenario. Timings do not include SVG package compilation or fixture generation. SVGR compilation and optimization run inside each Vite build and development transform.

## Production output and Node SSR

| Profile | Emitted gzip bytes | Build median ms | Dev entry-ready median ms | Edit-transform median ms | SSR SVGs / 100 | Eligible SSR median ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| released-raw | 107278 | 201.00 | FAILED | FAILED | 0 | unsupported |
| released-precompiled | 115205 | 187.71 | FAILED | FAILED | 0 | unsupported |
| released-url | 92316 | 175.11 | 222.65 | unsupported | 0 | unsupported |
| better-raw | 81504 | 144.55 | 205.44 | 134.92 | 0 | unsupported |
| better-current | 81450 | 177.11 | 189.16 | 514.85 | 0 | unsupported |
| better-narrow | 81457 | 217.03 | 225.38 | 415.43 | 0 | unsupported |
| better-precompiled | 89262 | 169.73 | 197.29 | 125.75 | 0 | unsupported |
| better-precompiled-current | 89165 | 211.43 | 206.53 | 526.21 | 0 | unsupported |
| better-precompiled-narrow | 89180 | 219.14 | 211.72 | 385.71 | 0 | unsupported |
| better-tree | 81016 | 183.09 | 203.14 | 123.16 | 0 | unsupported |
| better-static | 74161 | 156.83 | 391.01 | 37.14 | 100 | 0.71 |
| svgr-raw | 70276 | 395.12 | 903.99 | 47.12 | 100 | 1.46 |
| svgr-optimized | 70146 | 422.47 | 253.55 | 40.27 | 100 | 0.79 |
| unplugin-icons | 70599 | 470.38 | 207.29 | unsupported | 100 | 1.65 |
| inline | 70200 | 133.92 | 208.92 | unsupported | 100 | 0.38 |
| better-url | 97516 | 144.28 | 231.58 | unsupported | 0 | unsupported |
| react-svg | 90500 | 177.44 | 196.78 | unsupported | 0 | unsupported |
| react-inlinesvg | 94578 | 130.28 | 196.66 | unsupported | 0 | unsupported |

## JavaScript delivery

Gzip bytes include React and the page code. Initial bytes include every statically imported chunk. Emitted bytes also include deferred chunks. The sparse page uses one icon from the same discovery directory as the full matrix.

| Profile | Full initial JS | Full emitted JS | One-icon initial JS | One-icon emitted JS |
| --- | ---: | ---: | ---: | ---: |
| released-raw | 76631 | 106998 | 73813 | 104183 |
| released-precompiled | 84550 | 114918 | 81583 | 111953 |
| released-url | 67654 | 67654 | 64803 | 64803 |
| better-raw | 81223 | 81223 | 72097 | 79133 |
| better-current | 81167 | 81167 | 72096 | 79090 |
| better-narrow | 81173 | 81173 | 72095 | 79098 |
| better-precompiled | 88976 | 88976 | 72206 | 86528 |
| better-precompiled-current | 88875 | 88875 | 72208 | 86435 |
| better-precompiled-narrow | 88891 | 88891 | 72209 | 86451 |
| better-tree | 80738 | 80738 | 71762 | 78776 |
| better-static | 73881 | 73881 | 63342 | 63342 |
| svgr-raw | 69998 | 69998 | 59594 | 59594 |
| svgr-optimized | 69863 | 69863 | 59577 | 59577 |
| unplugin-icons | 70316 | 70316 | 59668 | 59668 |
| inline | 69923 | 69923 | 59494 | 59494 |
| better-url | 72855 | 72855 | 69969 | 69969 |
| react-svg | 65841 | 65841 | 62830 | 62830 |
| react-inlinesvg | 69914 | 69914 | 66926 | 66926 |

Node timing uses fresh Vite worker processes for development measurements. The filesystem cache is uncontrolled. Edit-transform timing explicitly invalidates the affected module after writing one generated SVG and waits for transformed output. It is not browser HMR, React update latency, or page reload latency. Build timing uses rotated adapter order in one Node process, so process and library import caches can be warm. SSR measures React serialization, not HTTP TTFB.

## Browser warm remounts

| Profile | Scenario | Valid warm samples | Ready median / p95 ms | Paint-opportunity median / p95 ms | Update commit median ms | First-use ready ms | First-use resource entries / transferred responses / bytes | Warm median resource loads |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| released-raw | one | 15/15 | 1.50 / 2.50 | 32.80 / 34.10 | 0.50 | 29.70 | 0 / 0 / 0 | 0.00 |
| released-precompiled | one | 15/15 | 1.40 / 9.00 | 32.80 / 40.90 | 0.50 | 29.70 | 0 / 0 / 0 | 0.00 |
| released-url | one | 15/15 | 1.20 / 4.40 | 33.10 / 39.10 | 0.50 | 46.40 | 1 / 1 / 595 | 0.00 |
| better-raw | one | 15/15 | 0.50 / 0.70 | 33.10 / 33.80 | 0.30 | 22.60 | 0 / 0 / 0 | 0.00 |
| better-current | one | 15/15 | 0.50 / 0.80 | 33.00 / 35.90 | 0.30 | 14.40 | 0 / 0 / 0 | 0.00 |
| better-narrow | one | 15/15 | 0.60 / 4.90 | 32.90 / 34.20 | 0.30 | 17.90 | 0 / 0 / 0 | 0.00 |
| better-precompiled | one | 15/15 | 0.50 / 0.70 | 33.10 / 33.60 | 0.30 | 13.00 | 0 / 0 / 0 | 0.00 |
| better-precompiled-current | one | 15/15 | 0.60 / 1.80 | 32.70 / 36.00 | 0.30 | 19.30 | 0 / 0 / 0 | 0.00 |
| better-precompiled-narrow | one | 15/15 | 0.50 / 0.80 | 33.10 / 34.10 | 0.30 | 18.50 | 0 / 0 / 0 | 0.00 |
| better-tree | one | 15/15 | 0.50 / 2.20 | 32.90 / 38.60 | 0.30 | 17.30 | 0 / 0 / 0 | 0.00 |
| better-static | one | 15/15 | 0.40 / 1.10 | 32.90 / 34.40 | 0.30 | 38.60 | 0 / 0 / 0 | 0.00 |
| svgr-raw | one | 15/15 | 0.40 / 0.60 | 33.10 / 34.10 | 0.20 | 9.50 | 0 / 0 / 0 | 0.00 |
| svgr-optimized | one | 15/15 | 0.30 / 0.50 | 33.00 / 36.10 | 0.20 | 7.10 | 0 / 0 / 0 | 0.00 |
| unplugin-icons | one | 15/15 | 0.30 / 1.50 | 32.80 / 33.80 | 0.30 | 19.60 | 0 / 0 / 0 | 0.00 |
| inline | one | 15/15 | 0.40 / 0.60 | 33.00 / 34.00 | 0.40 | 14.90 | 0 / 0 / 0 | 0.00 |
| better-url | one | 15/15 | 0.40 / 1.10 | 33.10 / 34.70 | 0.30 | 36.80 | 1 / 1 / 595 | 0.00 |
| react-svg | one | 15/15 | 1.30 / 1.60 | 33.00 / 34.40 | 0.30 | 30.70 | 1 / 1 / 595 | 0.00 |
| react-inlinesvg | one | 15/15 | 0.80 / 3.20 | 33.00 / 34.30 | 0.40 | 52.50 | 1 / 1 / 595 | 0.00 |
| released-precompiled | grid-24 | 15/15 | 4.50 / 8.60 | 31.80 / 32.60 | 1.80 | 8.00 | 0 / 0 / 0 | 0.00 |
| released-url | grid-24 | 15/15 | 8.00 / 16.80 | 31.20 / 38.70 | 3.90 | 232.40 | 24 / 8 / 5051 | 0.00 |
| better-raw | grid-24 | 15/15 | 3.10 / 6.00 | 32.80 / 34.40 | 1.10 | 43.50 | 0 / 0 / 0 | 0.00 |
| better-current | grid-24 | 15/15 | 2.70 / 9.10 | 32.80 / 33.60 | 0.90 | 18.00 | 0 / 0 / 0 | 0.00 |
| better-narrow | grid-24 | 15/15 | 3.60 / 22.50 | 33.00 / 50.50 | 0.90 | 10.20 | 0 / 0 / 0 | 0.00 |
| better-precompiled | grid-24 | 15/15 | 3.90 / 9.60 | 33.10 / 35.70 | 1.00 | 11.20 | 0 / 0 / 0 | 0.00 |
| better-precompiled-current | grid-24 | 15/15 | 2.20 / 12.20 | 32.90 / 33.20 | 0.80 | 5.80 | 0 / 0 / 0 | 0.00 |
| better-precompiled-narrow | grid-24 | 15/15 | 2.20 / 4.50 | 32.80 / 33.60 | 0.90 | 4.50 | 0 / 0 / 0 | 0.00 |
| better-tree | grid-24 | 15/15 | 2.50 / 6.10 | 32.80 / 35.60 | 0.80 | 7.10 | 0 / 0 / 0 | 0.00 |
| better-static | grid-24 | 15/15 | 2.90 / 8.50 | 33.00 / 35.50 | 0.90 | 4.30 | 0 / 0 / 0 | 0.00 |
| svgr-raw | grid-24 | 15/15 | 1.20 / 6.30 | 32.80 / 34.40 | 0.50 | 13.40 | 0 / 0 / 0 | 0.00 |
| svgr-optimized | grid-24 | 15/15 | 1.50 / 4.20 | 33.10 / 37.30 | 0.70 | 3.90 | 0 / 0 / 0 | 0.00 |
| unplugin-icons | grid-24 | 15/15 | 1.90 / 18.50 | 32.70 / 34.60 | 0.80 | 10.80 | 0 / 0 / 0 | 0.00 |
| inline | grid-24 | 15/15 | 1.50 / 5.60 | 32.90 / 34.10 | 1.30 | 3.20 | 0 / 0 / 0 | 0.00 |
| better-url | grid-24 | 15/15 | 3.80 / 9.10 | 32.80 / 34.10 | 1.40 | 224.70 | 8 / 8 / 5051 | 0.00 |
| react-svg | grid-24 | 15/15 | 7.30 / 11.10 | 32.70 / 34.40 | 0.70 | 60.90 | 8 / 8 / 5051 | 0.00 |
| react-inlinesvg | grid-24 | 15/15 | 6.10 / 23.40 | 32.80 / 33.10 | 1.00 | 148.70 | 8 / 8 / 5051 | 0.00 |
| released-raw | grid-24 | 15/15 | 4.70 / 8.20 | 31.40 / 31.80 | 2.20 | 8.30 | 0 / 0 / 0 | 0.00 |
| released-url | repeated-1000 | 15/15 | 124.20 / 218.80 | 172.70 / 273.70 | 55.80 | 3481.80 | 1000 / 1 / 595 | 0.00 |
| better-raw | repeated-1000 | 15/15 | 81.10 / 259.20 | 142.20 / 318.70 | 23.30 | 162.30 | 0 / 0 / 0 | 0.00 |
| better-current | repeated-1000 | 15/15 | 79.40 / 168.70 | 124.90 / 216.00 | 24.30 | 110.00 | 0 / 0 / 0 | 0.00 |
| better-narrow | repeated-1000 | 15/15 | 85.90 / 294.00 | 139.40 / 364.20 | 25.90 | 139.00 | 0 / 0 / 0 | 0.00 |
| better-precompiled | repeated-1000 | 15/15 | 87.10 / 184.90 | 138.80 / 217.20 | 25.60 | 193.80 | 0 / 0 / 0 | 0.00 |
| better-precompiled-current | repeated-1000 | 15/15 | 77.20 / 167.30 | 125.70 / 211.30 | 22.80 | 361.00 | 0 / 0 / 0 | 0.00 |
| better-precompiled-narrow | repeated-1000 | 15/15 | 72.40 / 158.50 | 121.20 / 188.30 | 17.90 | 114.70 | 0 / 0 / 0 | 0.00 |
| better-tree | repeated-1000 | 15/15 | 86.40 / 293.00 | 143.60 / 340.00 | 27.50 | 178.30 | 0 / 0 / 0 | 0.00 |
| better-static | repeated-1000 | 15/15 | 71.70 / 268.60 | 140.10 / 322.40 | 25.00 | 240.20 | 0 / 0 / 0 | 0.00 |
| svgr-raw | repeated-1000 | 15/15 | 42.20 / 86.90 | 100.90 / 175.90 | 12.60 | 62.90 | 0 / 0 / 0 | 0.00 |
| svgr-optimized | repeated-1000 | 15/15 | 45.20 / 71.50 | 106.00 / 137.40 | 13.50 | 92.70 | 0 / 0 / 0 | 0.00 |
| unplugin-icons | repeated-1000 | 15/15 | 39.40 / 52.10 | 102.20 / 143.00 | 14.10 | 79.00 | 0 / 0 / 0 | 0.00 |
| inline | repeated-1000 | 15/15 | 54.80 / 133.00 | 118.20 / 335.30 | 43.40 | 108.40 | 0 / 0 / 0 | 0.00 |
| better-url | repeated-1000 | 15/15 | 94.50 / 173.20 | 157.00 / 226.30 | 29.00 | 231.70 | 1 / 1 / 595 | 0.00 |
| react-svg | repeated-1000 | 15/15 | 318.40 / 657.60 | 402.50 / 780.10 | 20.20 | 268.80 | 1 / 1 / 595 | 0.00 |
| react-inlinesvg | repeated-1000 | 15/15 | 129.40 / 216.20 | 157.80 / 250.70 | 18.10 | 728.90 | 1 / 1 / 595 | 0.00 |
| released-raw | repeated-1000 | 15/15 | 70.40 / 215.00 | 94.50 / 235.30 | 27.70 | 132.00 | 0 / 0 / 0 | 0.00 |
| released-precompiled | repeated-1000 | 15/15 | 106.60 / 196.60 | 143.10 / 247.60 | 45.60 | 125.40 | 0 / 0 / 0 | 0.00 |
| better-raw | unique-100 | 15/15 | 9.90 / 29.60 | 32.10 / 49.30 | 2.60 | 189.80 | 0 / 0 / 0 | 0.00 |
| better-current | unique-100 | 15/15 | 7.40 / 8.70 | 32.10 / 33.10 | 2.40 | 40.30 | 0 / 0 / 0 | 0.00 |
| better-narrow | unique-100 | 15/15 | 7.30 / 25.50 | 31.90 / 63.20 | 2.40 | 32.20 | 0 / 0 / 0 | 0.00 |
| better-precompiled | unique-100 | 15/15 | 6.80 / 14.70 | 32.30 / 33.20 | 2.60 | 42.00 | 0 / 0 / 0 | 0.00 |
| better-precompiled-current | unique-100 | 15/15 | 6.90 / 14.00 | 32.20 / 32.60 | 2.20 | 15.80 | 0 / 0 / 0 | 0.00 |
| better-precompiled-narrow | unique-100 | 15/15 | 8.10 / 15.20 | 31.90 / 33.00 | 2.50 | 22.80 | 0 / 0 / 0 | 0.00 |
| better-tree | unique-100 | 15/15 | 19.00 / 37.80 | 46.50 / 89.30 | 6.90 | 33.70 | 0 / 0 / 0 | 0.00 |
| better-static | unique-100 | 15/15 | 19.60 / 42.80 | 47.30 / 75.60 | 5.50 | 74.70 | 0 / 0 / 0 | 0.00 |
| svgr-raw | unique-100 | 15/15 | 4.30 / 8.80 | 31.70 / 32.90 | 1.90 | 45.60 | 0 / 0 / 0 | 0.00 |
| svgr-optimized | unique-100 | 15/15 | 4.20 / 10.10 | 31.70 / 33.40 | 1.70 | 91.30 | 0 / 0 / 0 | 0.00 |
| unplugin-icons | unique-100 | 15/15 | 6.90 / 18.20 | 31.50 / 36.60 | 3.40 | 83.50 | 0 / 0 / 0 | 0.00 |
| inline | unique-100 | 15/15 | 5.50 / 8.00 | 31.60 / 32.40 | 5.90 | 7.40 | 0 / 0 / 0 | 0.00 |
| better-url | unique-100 | 15/15 | 7.90 / 11.70 | 32.30 / 38.80 | 2.60 | 320.90 | 100 / 100 / 67893 | 0.00 |
| react-svg | unique-100 | 15/15 | 16.90 / 35.30 | 31.80 / 48.40 | 1.40 | 340.60 | 100 / 100 / 67893 | 0.00 |
| react-inlinesvg | unique-100 | 15/15 | 17.00 / 21.70 | 31.70 / 32.30 | 1.90 | 527.80 | 100 / 100 / 67893 | 0.00 |
| released-raw | unique-100 | 15/15 | 8.00 / 14.50 | 29.00 / 29.90 | 4.40 | 51.00 | 0 / 0 / 0 | 0.00 |
| released-precompiled | unique-100 | 15/15 | 9.70 / 39.00 | 29.50 / 50.00 | 4.40 | 51.20 | 0 / 0 / 0 | 0.00 |
| released-url | unique-100 | 15/15 | 8.30 / 11.90 | 29.00 / 30.20 | 5.10 | 590.60 | 100 / 100 / 67893 | 0.00 |

The first sample and every failed sample remain in the raw JSON. A fresh document is required per profile and scenario to label the first sample library-cache-cold. Fresh runtime URL tokens avoid prior HTTP-cache hits; warm samples retain each library's normal request caching. Two animation frames measure a paint opportunity, not physical presentation. Opacity updates apply to the SVG for static adapters and Better SVG, and to the documented wrapper for react-svg. Memory readings and long tasks are diagnostics, not leak evidence.
Resource loads count SVG Resource Timing entries, including cache hits and coalesced fetches. They are not necessarily separate network requests. Transferred-resource counts and transfer bytes remain in the raw data. Encoded body sizes can count a cached body more than once. The Resource Timing buffer is expanded to retain the repeated-icon workload.

## Correctness observations

Capability fixtures are built separately from the timing assets. They record computed paints, roles, descriptions, reference resolution, duplicate IDs, and external CSS behavior. These are observations, not a common-feature assertion that every library promises sanitization, caller-reference rewriting, or descendant paint overrides. Review the contract results before treating any optimization as compatible.

## Coverage gaps

The corpus includes catalog icons and two small repository assets, not a representative set of editor exports. This run does not measure real mobile devices, React Native, Astro SSR, hydration, bandwidth-limited HTTP delivery, GPU presentation, or browser engines not listed in the raw browser metadata. Do not extrapolate desktop timings to those environments.
