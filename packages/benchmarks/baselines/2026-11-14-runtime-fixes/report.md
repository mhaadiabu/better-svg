# React SVG benchmark pilot

Library source commit: 223a103d8963aefed554b7f94e4274cd4e654362.
Fixture hash: 1747c509871ba55900a9c9df35f260b0c3acfe382f80447bea08527aded506cb.

This is a local desktop pilot, not a universal ranking. Build sizes include the benchmark controller and React. Runtime URL profiles also emit separate SVG assets. Emitted deployment size is not the same as bytes fetched for one scenario. Timings do not include SVG package compilation or fixture generation. SVGR compilation and optimization run inside each Vite build and development transform.

## Production output and Node SSR

| Profile                    | Emitted gzip bytes | Build median ms | Dev entry-ready median ms | Edit-transform median ms | SSR SVGs / 100 | Eligible SSR median ms |
| -------------------------- | -----------------: | --------------: | ------------------------: | -----------------------: | -------------: | ---------------------: |
| better-raw                 |             111786 |          220.13 |                    FAILED |                   FAILED |              0 |            unsupported |
| better-current             |             111718 |          347.83 |                    FAILED |                   FAILED |              0 |            unsupported |
| better-narrow              |             111728 |          182.38 |                    FAILED |                   FAILED |              0 |            unsupported |
| better-precompiled         |             119529 |          201.51 |                    FAILED |                   FAILED |              0 |            unsupported |
| better-precompiled-current |             119438 |          275.35 |                    FAILED |                   FAILED |              0 |            unsupported |
| better-precompiled-narrow  |             119459 |          209.02 |                    FAILED |                   FAILED |              0 |            unsupported |
| svgr-raw                   |              70251 |          327.20 |                    205.12 |                    29.11 |            100 |                   1.08 |
| svgr-optimized             |              70119 |          410.03 |                    196.11 |                    27.75 |            100 |                   0.58 |
| inline                     |              70175 |          120.07 |                    185.14 |              unsupported |            100 |                   0.25 |
| better-url                 |              96730 |          188.13 |                    198.22 |              unsupported |              0 |            unsupported |
| react-svg                  |              90484 |          146.76 |                    186.31 |              unsupported |              0 |            unsupported |

Node timing uses fresh Vite worker processes for development measurements. The filesystem cache is uncontrolled. Edit-transform timing explicitly invalidates the affected module after writing one generated SVG and waits for transformed output. It is not browser HMR, React update latency, or page reload latency. Build timing uses rotated adapter order in one Node process, so process and library import caches can be warm. SSR measures React serialization, not HTTP TTFB.

## Browser warm remounts

| Profile                    | Scenario      | Valid warm samples | Ready median / p95 ms | Paint-opportunity median / p95 ms | Update commit median ms | First-sample resource loads | Warm median resource loads |
| -------------------------- | ------------- | -----------------: | --------------------: | --------------------------------: | ----------------------: | --------------------------: | -------------------------: |
| better-raw                 | one           |              15/15 |           0.70 / 1.30 |                     33.00 / 33.70 |                    0.50 |                           0 |                       0.00 |
| better-current             | one           |              15/15 |           0.40 / 0.70 |                     33.10 / 33.30 |                    0.30 |                           0 |                       0.00 |
| better-narrow              | one           |              15/15 |           0.50 / 1.40 |                     33.00 / 33.60 |                    0.30 |                           0 |                       0.00 |
| better-precompiled         | one           |              15/15 |           0.60 / 0.90 |                     32.90 / 33.60 |                    0.40 |                           0 |                       0.00 |
| better-precompiled-current | one           |              15/15 |           0.40 / 1.00 |                     33.00 / 35.50 |                    0.30 |                           0 |                       0.00 |
| better-precompiled-narrow  | one           |              15/15 |           0.50 / 1.60 |                     32.90 / 34.00 |                    0.40 |                           0 |                       0.00 |
| svgr-raw                   | one           |              15/15 |           0.20 / 0.60 |                     33.10 / 33.40 |                    0.10 |                           0 |                       0.00 |
| svgr-optimized             | one           |              15/15 |           0.40 / 0.70 |                     33.10 / 33.70 |                    0.30 |                           0 |                       0.00 |
| inline                     | one           |              15/15 |           0.30 / 0.80 |                     33.10 / 33.50 |                    0.30 |                           0 |                       0.00 |
| better-url                 | one           |              15/15 |           0.60 / 1.30 |                     33.00 / 33.50 |                    0.50 |                           1 |                       0.00 |
| react-svg                  | one           |              15/15 |           2.70 / 6.70 |                     32.70 / 33.50 |                    0.30 |                           1 |                       0.00 |
| better-current             | repeated-1000 |              15/15 |         49.70 / 72.40 |                    82.80 / 107.60 |                   14.30 |                           0 |                       0.00 |
| better-narrow              | repeated-1000 |              15/15 |         46.40 / 59.30 |                     77.10 / 94.10 |                   12.20 |                           0 |                       0.00 |
| better-precompiled         | repeated-1000 |              15/15 |         44.20 / 61.00 |                     77.90 / 92.50 |                   11.60 |                           0 |                       0.00 |
| better-precompiled-current | repeated-1000 |              15/15 |         49.00 / 74.80 |                    77.20 / 121.20 |                   15.00 |                           0 |                       0.00 |
| better-precompiled-narrow  | repeated-1000 |              15/15 |        65.60 / 114.50 |                   107.30 / 205.70 |                   20.90 |                           0 |                       0.00 |
| svgr-raw                   | repeated-1000 |              15/15 |         37.90 / 94.70 |                   106.90 / 187.90 |                   11.60 |                           0 |                       0.00 |
| svgr-optimized             | repeated-1000 |              15/15 |         23.10 / 39.10 |                     58.00 / 78.50 |                    8.10 |                           0 |                       0.00 |
| inline                     | repeated-1000 |              15/15 |        40.20 / 222.50 |                    77.20 / 523.70 |                   30.20 |                           0 |                       0.00 |
| better-url                 | repeated-1000 |              15/15 |         55.00 / 79.40 |                    88.70 / 129.10 |                   14.80 |                           1 |                       0.00 |
| react-svg                  | repeated-1000 |              15/15 |       208.80 / 352.20 |                   244.30 / 410.90 |                   10.60 |                           1 |                       0.00 |
| better-raw                 | repeated-1000 |              15/15 |        53.30 / 103.50 |                    88.00 / 156.70 |                   15.00 |                           0 |                       0.00 |
| better-narrow              | unique-100    |              15/15 |          8.30 / 16.70 |                     32.00 / 32.50 |                    2.60 |                           0 |                       0.00 |
| better-precompiled         | unique-100    |              15/15 |          9.70 / 13.00 |                     32.20 / 32.70 |                    2.10 |                           0 |                       0.00 |
| better-precompiled-current | unique-100    |              15/15 |          8.10 / 64.00 |                     32.50 / 86.50 |                    2.00 |                           0 |                       0.00 |
| better-precompiled-narrow  | unique-100    |              15/15 |          7.80 / 12.00 |                     32.40 / 32.90 |                    2.20 |                           0 |                       0.00 |
| svgr-raw                   | unique-100    |              15/15 |           3.60 / 7.90 |                     32.10 / 32.70 |                    1.90 |                           0 |                       0.00 |
| svgr-optimized             | unique-100    |              15/15 |           4.30 / 8.00 |                     32.30 / 32.50 |                    1.60 |                           0 |                       0.00 |
| inline                     | unique-100    |              15/15 |          7.00 / 10.90 |                     32.50 / 47.70 |                    4.70 |                           0 |                       0.00 |
| better-url                 | unique-100    |              15/15 |         11.40 / 14.30 |                     32.20 / 32.50 |                    2.80 |                         100 |                       0.00 |
| react-svg                  | unique-100    |              15/15 |         18.50 / 78.10 |                     32.40 / 95.60 |                    1.70 |                         100 |                       0.00 |
| better-raw                 | unique-100    |              15/15 |          7.40 / 13.60 |                     32.40 / 35.90 |                    2.20 |                           0 |                       0.00 |
| better-current             | unique-100    |              15/15 |          7.70 / 26.90 |                     32.50 / 47.00 |                    2.30 |                           0 |                       0.00 |

The first sample and every failed sample remain in the raw JSON. A fresh document is required per profile and scenario to label the first sample library-cache-cold. Fresh runtime URL tokens avoid prior HTTP-cache hits; warm samples retain each library's normal request caching. Two animation frames measure a paint opportunity, not physical presentation. Opacity updates apply to the SVG for static adapters and Better SVG, and to the documented wrapper for react-svg. Memory readings and long tasks are diagnostics, not leak evidence.
Resource loads count SVG Resource Timing entries, including cache hits and coalesced fetches. They are not necessarily separate network requests. Transferred-resource counts and transfer bytes remain in the raw data. Encoded body sizes can count a cached body more than once. The Resource Timing buffer is expanded to retain the repeated-icon workload.

## Correctness observations

Capability fixtures are built separately from the timing assets. They record computed paints, roles, descriptions, reference resolution, duplicate IDs, and external CSS behavior. These are observations, not a common-feature assertion that every library promises sanitization, caller-reference rewriting, or descendant paint overrides. Review the contract results before treating any optimization as compatible.

## Coverage gaps

The corpus includes catalog icons and two small repository assets, not a representative set of editor exports. This run does not measure real mobile devices, React Native, Flutter, Astro SSR, unplugin-icons, hydration, bandwidth-limited HTTP delivery, GPU presentation, or browser engines not listed in the raw browser metadata. Do not extrapolate desktop timings to those environments.
