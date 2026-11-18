# React SVG benchmark pilot

Library source commit: d206c4d401dc933cd26a857e074237a1c3fb82fe.
Fixture hash: 1747c509871ba55900a9c9df35f260b0c3acfe382f80447bea08527aded506cb.

This is a local desktop pilot, not a universal ranking. Build sizes include the benchmark controller and React. Runtime URL profiles also emit separate SVG assets. Emitted deployment size is not the same as bytes fetched for one scenario. Timings do not include SVG package compilation or fixture generation. SVGR compilation and optimization run inside each Vite build and development transform.

## Production output and Node SSR

| Profile                    | Emitted gzip bytes | Build median ms | Dev entry-ready median ms | Edit-transform median ms | SSR SVGs / 100 | Eligible SSR median ms |
| -------------------------- | -----------------: | --------------: | ------------------------: | -----------------------: | -------------: | ---------------------: |
| better-raw                 |             111121 |          157.45 |                    FAILED |                   FAILED |              0 |            unsupported |
| better-current             |             111063 |          272.53 |                    FAILED |                   FAILED |              0 |            unsupported |
| better-narrow              |             111069 |          161.06 |                    FAILED |                   FAILED |              0 |            unsupported |
| better-precompiled         |             118870 |          164.80 |                    FAILED |                   FAILED |              0 |            unsupported |
| better-precompiled-current |             118777 |          239.54 |                    FAILED |                   FAILED |              0 |            unsupported |
| better-precompiled-narrow  |             118796 |          192.67 |                    FAILED |                   FAILED |              0 |            unsupported |
| svgr-raw                   |              70253 |          324.73 |                    202.80 |                    29.77 |            100 |                   1.18 |
| svgr-optimized             |              70120 |          415.09 |                    172.54 |                    28.38 |            100 |                   0.58 |
| inline                     |              70178 |          116.15 |                    153.53 |              unsupported |            100 |                   0.22 |
| better-url                 |              96127 |          132.10 |                    182.43 |              unsupported |              0 |            unsupported |
| react-svg                  |              90490 |          140.47 |                    171.04 |              unsupported |              0 |            unsupported |

Node timing uses fresh Vite worker processes for development measurements. The filesystem cache is uncontrolled. Edit-transform timing explicitly invalidates the affected module after writing one generated SVG and waits for transformed output. It is not browser HMR, React update latency, or page reload latency. Build timing uses rotated adapter order in one Node process, so process and library import caches can be warm. SSR measures React serialization, not HTTP TTFB.

## Browser warm remounts

| Profile                    | Scenario      | Valid warm samples | Ready median / p95 ms | Paint-opportunity median / p95 ms | Update commit median ms | First-sample resource loads | Warm median resource loads |
| -------------------------- | ------------- | -----------------: | --------------------: | --------------------------------: | ----------------------: | --------------------------: | -------------------------: |
| better-raw                 | one           |              15/15 |           2.20 / 3.70 |                     32.80 / 33.30 |                    0.40 |                           0 |                       0.00 |
| better-current             | one           |              15/15 |           2.40 / 3.30 |                     32.80 / 33.50 |                    0.70 |                           0 |                       0.00 |
| better-narrow              | one           |              15/15 |           2.50 / 3.30 |                     32.70 / 33.60 |                    0.80 |                           0 |                       0.00 |
| better-precompiled         | one           |              15/15 |           2.80 / 3.30 |                     32.60 / 33.00 |                    0.80 |                           0 |                       0.00 |
| better-precompiled-current | one           |              15/15 |           2.90 / 3.60 |                     32.60 / 33.40 |                    0.80 |                           0 |                       0.00 |
| better-precompiled-narrow  | one           |              15/15 |           1.30 / 3.80 |                     33.00 / 41.70 |                    0.40 |                           0 |                       0.00 |
| svgr-raw                   | one           |              15/15 |           0.50 / 0.90 |                     32.70 / 33.70 |                    0.40 |                           0 |                       0.00 |
| svgr-optimized             | one           |              15/15 |           0.50 / 0.70 |                     32.90 / 33.60 |                    0.40 |                           0 |                       0.00 |
| inline                     | one           |              15/15 |           0.60 / 1.00 |                     32.80 / 33.50 |                    0.60 |                           0 |                       0.00 |
| better-url                 | one           |              15/15 |           2.90 / 3.70 |                     32.60 / 33.40 |                    0.70 |                           1 |                       0.00 |
| react-svg                  | one           |              15/15 |           3.30 / 5.40 |                     32.80 / 33.50 |                    0.50 |                           1 |                       0.00 |
| better-current             | repeated-1000 |              15/15 |         61.70 / 88.00 |                    84.60 / 110.90 |                   28.40 |                           0 |                       0.00 |
| better-narrow              | repeated-1000 |              15/15 |         54.30 / 95.70 |                    77.30 / 122.20 |                   27.80 |                           0 |                       0.00 |
| better-precompiled         | repeated-1000 |              15/15 |        59.20 / 131.40 |                    82.30 / 155.60 |                   28.20 |                           0 |                       0.00 |
| better-precompiled-current | repeated-1000 |              15/15 |         54.80 / 99.00 |                    76.80 / 124.70 |                   28.10 |                           0 |                       0.00 |
| better-precompiled-narrow  | repeated-1000 |              15/15 |        54.70 / 107.20 |                    78.50 / 133.40 |                   27.30 |                           0 |                       0.00 |
| svgr-raw                   | repeated-1000 |              15/15 |         17.60 / 42.90 |                     43.30 / 88.40 |                    6.10 |                           0 |                       0.00 |
| svgr-optimized             | repeated-1000 |              15/15 |         14.50 / 26.40 |                     42.60 / 61.10 |                    5.80 |                           0 |                       0.00 |
| inline                     | repeated-1000 |              15/15 |         34.40 / 99.70 |                    70.70 / 138.00 |                   23.20 |                           0 |                       0.00 |
| better-url                 | repeated-1000 |              15/15 |         55.30 / 99.00 |                    78.70 / 127.00 |                   28.80 |                        1000 |                       0.00 |
| react-svg                  | repeated-1000 |              15/15 |       226.00 / 334.60 |                   266.60 / 392.20 |                   11.10 |                           1 |                       0.00 |
| better-raw                 | repeated-1000 |              15/15 |        69.50 / 137.20 |                   101.20 / 177.10 |                   34.40 |                           0 |                       0.00 |
| better-narrow              | unique-100    |              15/15 |         10.90 / 14.60 |                     31.50 / 32.10 |                    6.30 |                           0 |                       0.00 |
| better-precompiled         | unique-100    |              15/15 |         11.60 / 16.50 |                     31.20 / 32.10 |                    6.30 |                           0 |                       0.00 |
| better-precompiled-current | unique-100    |              15/15 |          9.10 / 16.20 |                     31.50 / 32.00 |                    5.00 |                           0 |                       0.00 |
| better-precompiled-narrow  | unique-100    |              15/15 |          9.50 / 31.10 |                     32.20 / 79.40 |                    5.40 |                           0 |                       0.00 |
| svgr-raw                   | unique-100    |              15/15 |          4.20 / 16.80 |                     32.00 / 60.10 |                    2.20 |                           0 |                       0.00 |
| svgr-optimized             | unique-100    |              15/15 |           4.00 / 6.70 |                     32.10 / 32.50 |                    1.80 |                           0 |                       0.00 |
| inline                     | unique-100    |              15/15 |           5.40 / 7.90 |                     32.30 / 32.90 |                    4.50 |                           0 |                       0.00 |
| better-url                 | unique-100    |              15/15 |         12.00 / 15.60 |                     31.50 / 33.10 |                    6.00 |                         100 |                       0.00 |
| react-svg                  | unique-100    |              15/15 |         19.30 / 22.00 |                     31.80 / 32.90 |                    1.30 |                         100 |                       0.00 |
| better-raw                 | unique-100    |              15/15 |         11.30 / 15.40 |                     31.20 / 32.40 |                    5.60 |                           0 |                       0.00 |
| better-current             | unique-100    |              15/15 |          7.60 / 23.10 |                     31.80 / 51.30 |                    4.40 |                           0 |                       0.00 |

The first sample and every failed sample remain in the raw JSON. A fresh document is required per profile and scenario to label the first sample library-cache-cold. Fresh runtime URL tokens avoid prior HTTP-cache hits; warm samples retain each library's normal request caching. Two animation frames measure a paint opportunity, not physical presentation. Opacity updates apply to the SVG for static adapters and Better SVG, and to the documented wrapper for react-svg. Memory readings and long tasks are diagnostics, not leak evidence.
Resource loads count SVG Resource Timing entries, including cache hits and coalesced fetches. They are not necessarily separate network requests. Transferred-resource counts and transfer bytes remain in the raw data. Encoded body sizes can count a cached body more than once. The Resource Timing buffer is expanded to retain the repeated-icon workload.

## Correctness observations

Capability fixtures are built separately from the timing assets. They record computed paints, roles, descriptions, reference resolution, duplicate IDs, and external CSS behavior. These are observations, not a common-feature assertion that every library promises sanitization, caller-reference rewriting, or descendant paint overrides. Review the contract results before treating any optimization as compatible.

## Coverage gaps

The corpus includes catalog icons and two small repository assets, not a representative set of editor exports. This run does not measure real mobile devices, React Native, Flutter, Astro SSR, unplugin-icons, hydration, bandwidth-limited HTTP delivery, GPU presentation, or browser engines not listed in the raw browser metadata. Do not extrapolate desktop timings to those environments.
