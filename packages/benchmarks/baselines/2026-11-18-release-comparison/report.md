# React SVG benchmark pilot

Library source commit: 605c0ec33914926704105eb5d2d8971028c8896d.
Better SVG published: 0.4.2. Workspace: 0.6.2.
Fixture hash: 1747c509871ba55900a9c9df35f260b0c3acfe382f80447bea08527aded506cb.

This is a local desktop pilot, not a universal ranking. Build sizes include the benchmark controller and React. Runtime URL profiles also emit separate SVG assets. Emitted deployment size is not the same as bytes fetched for one scenario. Timings do not include SVG package compilation or fixture generation. SVGR compilation and optimization run inside each Vite build and development transform.

## Production output and Node SSR

| Profile                    | Emitted gzip bytes | Build median ms | Dev entry-ready median ms | Edit-transform median ms | SSR SVGs / 100 | Eligible SSR median ms |
| -------------------------- | -----------------: | --------------: | ------------------------: | -----------------------: | -------------: | ---------------------: |
| released-raw               |             107278 |          162.86 |                    FAILED |                   FAILED |              0 |            unsupported |
| released-precompiled       |             115202 |          182.91 |                    FAILED |                   FAILED |              0 |            unsupported |
| released-url               |              92319 |          141.62 |                    207.78 |              unsupported |              0 |            unsupported |
| better-raw                 |              81094 |          139.30 |                    195.18 |                   100.19 |              0 |            unsupported |
| better-current             |              81041 |          235.44 |                    159.54 |                   233.82 |              0 |            unsupported |
| better-narrow              |              81047 |          167.59 |                    205.18 |                   160.98 |              0 |            unsupported |
| better-precompiled         |              88858 |          150.52 |                    200.85 |                   122.73 |              0 |            unsupported |
| better-precompiled-current |              88765 |          266.00 |                    137.05 |                   198.98 |              0 |            unsupported |
| better-precompiled-narrow  |              88784 |          161.40 |                    182.53 |                   166.49 |              0 |            unsupported |
| better-tree                |              80920 |          149.22 |                    184.29 |                   102.43 |              0 |            unsupported |
| better-static              |              74267 |          153.15 |                    219.67 |                    44.37 |            100 |                   0.60 |
| svgr-raw                   |              70279 |          360.60 |                    194.85 |                    40.74 |            100 |                   0.98 |
| svgr-optimized             |              70142 |          539.96 |                    205.73 |                    29.05 |            100 |                   0.57 |
| unplugin-icons             |              70599 |          375.91 |                    197.41 |              unsupported |            100 |                   0.72 |
| inline                     |              70198 |          143.00 |                    193.37 |              unsupported |            100 |                   0.23 |
| better-url                 |              97113 |          146.47 |                    223.79 |              unsupported |              0 |            unsupported |
| react-svg                  |              90503 |          152.41 |                    207.49 |              unsupported |              0 |            unsupported |
| react-inlinesvg            |              94580 |          159.05 |                    193.02 |              unsupported |              0 |            unsupported |

## JavaScript delivery

Gzip bytes include React and the page code. Initial bytes include every statically imported chunk. Emitted bytes also include deferred chunks. The sparse page uses one icon from the same discovery directory as the full matrix.

| Profile                    | Full initial JS | Full emitted JS | One-icon initial JS | One-icon emitted JS |
| -------------------------- | --------------: | --------------: | ------------------: | ------------------: |
| released-raw               |           76632 |          106999 |               73813 |              104183 |
| released-precompiled       |           84549 |          114917 |               81583 |              111953 |
| released-url               |           67655 |           67655 |               64803 |               64803 |
| better-raw                 |           80815 |           80815 |               71691 |               78728 |
| better-current             |           80757 |           80757 |               71691 |               78683 |
| better-narrow              |           80764 |           80764 |               71688 |               78685 |
| better-precompiled         |           88574 |           88574 |               71803 |               86126 |
| better-precompiled-current |           88475 |           88475 |               71807 |               86034 |
| better-precompiled-narrow  |           88492 |           88492 |               71805 |               86049 |
| better-tree                |           80642 |           80642 |               71337 |               78539 |
| better-static              |           73985 |           73985 |               62973 |               62973 |
| svgr-raw                   |           69997 |           69997 |               59594 |               59594 |
| svgr-optimized             |           69859 |           69859 |               59577 |               59577 |
| unplugin-icons             |           70315 |           70315 |               59668 |               59668 |
| inline                     |           69920 |           69920 |               59494 |               59494 |
| better-url                 |           72452 |           72452 |               69550 |               69550 |
| react-svg                  |           65842 |           65842 |               62830 |               62830 |
| react-inlinesvg            |           69914 |           69914 |               66926 |               66926 |

Node timing uses fresh Vite worker processes for development measurements. The filesystem cache is uncontrolled. Edit-transform timing explicitly invalidates the affected module after writing one generated SVG and waits for transformed output. It is not browser HMR, React update latency, or page reload latency. Build timing uses rotated adapter order in one Node process, so process and library import caches can be warm. SSR measures React serialization, not HTTP TTFB.

## Browser warm remounts

| Profile                    | Scenario      | Valid warm samples | Ready median / p95 ms | Paint-opportunity median / p95 ms | Update commit median ms | First-use ready ms | First-use resource entries / transferred responses / bytes | Warm median resource loads |
| -------------------------- | ------------- | -----------------: | --------------------: | --------------------------------: | ----------------------: | -----------------: | ---------------------------------------------------------: | -------------------------: |
| released-raw               | one           |              15/15 |           1.20 / 2.10 |                     33.10 / 33.30 |                    0.40 |              12.60 |                                                  0 / 0 / 0 |                       0.00 |
| released-precompiled       | one           |              15/15 |           1.20 / 2.40 |                     33.10 / 33.40 |                    0.40 |              10.60 |                                                  0 / 0 / 0 |                       0.00 |
| released-url               | one           |              15/15 |           1.60 / 2.90 |                     32.80 / 33.30 |                    0.40 |              14.70 |                                                1 / 1 / 595 |                       0.00 |
| better-raw                 | one           |              15/15 |           0.40 / 1.20 |                     33.00 / 33.50 |                    0.30 |              10.40 |                                                  0 / 0 / 0 |                       0.00 |
| better-current             | one           |              15/15 |           0.50 / 1.30 |                     33.00 / 33.20 |                    0.30 |              18.00 |                                                  0 / 0 / 0 |                       0.00 |
| better-narrow              | one           |              15/15 |           0.80 / 1.30 |                     32.80 / 33.70 |                    0.40 |              10.20 |                                                  0 / 0 / 0 |                       0.00 |
| better-precompiled         | one           |              15/15 |           0.50 / 1.30 |                     33.10 / 33.40 |                    0.40 |               8.30 |                                                  0 / 0 / 0 |                       0.00 |
| better-precompiled-current | one           |              15/15 |           0.40 / 0.90 |                     33.10 / 33.60 |                    0.30 |              10.50 |                                                  0 / 0 / 0 |                       0.00 |
| better-precompiled-narrow  | one           |              15/15 |           0.50 / 1.00 |                     33.00 / 33.60 |                    0.30 |              10.10 |                                                  0 / 0 / 0 |                       0.00 |
| better-tree                | one           |              15/15 |           0.60 / 1.60 |                     33.00 / 33.40 |                    0.30 |               9.70 |                                                  0 / 0 / 0 |                       0.00 |
| better-static              | one           |              15/15 |           0.80 / 1.60 |                     33.00 / 33.80 |                    0.40 |               9.70 |                                                  0 / 0 / 0 |                       0.00 |
| svgr-raw                   | one           |              15/15 |           0.30 / 0.80 |                     33.00 / 33.70 |                    0.20 |               5.90 |                                                  0 / 0 / 0 |                       0.00 |
| svgr-optimized             | one           |              15/15 |           0.20 / 0.40 |                     33.10 / 41.60 |                    0.20 |               7.50 |                                                  0 / 0 / 0 |                       0.00 |
| unplugin-icons             | one           |              15/15 |           0.30 / 0.80 |                     33.10 / 34.30 |                    0.30 |               9.80 |                                                  0 / 0 / 0 |                       0.00 |
| inline                     | one           |              15/15 |           0.30 / 0.60 |                     32.90 / 33.60 |                    0.30 |               8.40 |                                                  0 / 0 / 0 |                       0.00 |
| better-url                 | one           |              15/15 |           0.50 / 0.80 |                     32.90 / 33.20 |                    0.30 |              17.30 |                                                1 / 1 / 595 |                       0.00 |
| react-svg                  | one           |              15/15 |           2.10 / 4.30 |                     32.90 / 33.40 |                    0.30 |              12.60 |                                                1 / 1 / 595 |                       0.00 |
| react-inlinesvg            | one           |              15/15 |           0.70 / 1.90 |                     33.10 / 33.50 |                    0.30 |              20.80 |                                                1 / 1 / 595 |                       0.00 |
| released-precompiled       | grid-24       |              15/15 |           5.00 / 9.60 |                     32.60 / 33.00 |                    2.00 |               5.70 |                                                  0 / 0 / 0 |                       0.00 |
| released-url               | grid-24       |              15/15 |           3.80 / 5.60 |                     32.80 / 35.50 |                    1.70 |              37.60 |                                              24 / 8 / 5051 |                       0.00 |
| better-raw                 | grid-24       |              15/15 |           2.30 / 4.00 |                     32.90 / 33.20 |                    1.00 |               4.90 |                                                  0 / 0 / 0 |                       0.00 |
| better-current             | grid-24       |              15/15 |           2.20 / 8.20 |                     32.90 / 33.80 |                    0.90 |              10.10 |                                                  0 / 0 / 0 |                       0.00 |
| better-narrow              | grid-24       |              15/15 |           2.20 / 5.20 |                     32.90 / 34.10 |                    1.00 |               7.80 |                                                  0 / 0 / 0 |                       0.00 |
| better-precompiled         | grid-24       |              15/15 |           2.40 / 4.90 |                     32.90 / 33.10 |                    0.70 |               3.10 |                                                  0 / 0 / 0 |                       0.00 |
| better-precompiled-current | grid-24       |              15/15 |           2.00 / 3.00 |                     32.90 / 33.40 |                    0.90 |               3.70 |                                                  0 / 0 / 0 |                       0.00 |
| better-precompiled-narrow  | grid-24       |              15/15 |           2.30 / 6.30 |                     32.80 / 33.00 |                    0.80 |               3.50 |                                                  0 / 0 / 0 |                       0.00 |
| better-tree                | grid-24       |              15/15 |           2.10 / 4.20 |                     32.90 / 33.10 |                    0.70 |               4.50 |                                                  0 / 0 / 0 |                       0.00 |
| better-static              | grid-24       |              15/15 |           1.80 / 2.90 |                     32.90 / 33.10 |                    0.70 |               3.10 |                                                  0 / 0 / 0 |                       0.00 |
| svgr-raw                   | grid-24       |              15/15 |           1.00 / 5.30 |                     32.90 / 34.10 |                    0.60 |               2.40 |                                                  0 / 0 / 0 |                       0.00 |
| svgr-optimized             | grid-24       |              15/15 |           1.10 / 4.80 |                     32.90 / 57.60 |                    0.50 |               3.00 |                                                  0 / 0 / 0 |                       0.00 |
| unplugin-icons             | grid-24       |              15/15 |          1.00 / 42.70 |                     32.90 / 76.70 |                    0.60 |               2.50 |                                                  0 / 0 / 0 |                       0.00 |
| inline                     | grid-24       |              15/15 |           1.50 / 2.70 |                     32.90 / 33.40 |                    1.30 |               1.90 |                                                  0 / 0 / 0 |                       0.00 |
| better-url                 | grid-24       |              15/15 |           2.20 / 3.70 |                     32.90 / 34.30 |                    0.90 |              19.60 |                                               8 / 8 / 5051 |                       0.00 |
| react-svg                  | grid-24       |              15/15 |          5.40 / 10.40 |                     32.70 / 32.90 |                    0.50 |              23.90 |                                               8 / 8 / 5051 |                       0.00 |
| react-inlinesvg            | grid-24       |              15/15 |          4.40 / 11.90 |                     32.80 / 33.40 |                    1.00 |             117.80 |                                               8 / 8 / 5051 |                       0.00 |
| released-raw               | grid-24       |              15/15 |           3.30 / 5.40 |                     32.70 / 32.90 |                    1.70 |               9.40 |                                                  0 / 0 / 0 |                       0.00 |
| released-url               | repeated-1000 |              15/15 |        72.00 / 147.00 |                    98.00 / 175.80 |                   36.60 |            1280.10 |                                             1000 / 1 / 595 |                       0.00 |
| better-raw                 | repeated-1000 |              15/15 |         50.30 / 61.60 |                     86.90 / 98.60 |                   16.10 |              60.30 |                                                  0 / 0 / 0 |                       0.00 |
| better-current             | repeated-1000 |              15/15 |         52.20 / 70.50 |                    89.80 / 107.20 |                   14.50 |              69.60 |                                                  0 / 0 / 0 |                       0.00 |
| better-narrow              | repeated-1000 |              15/15 |        63.50 / 138.80 |                   111.60 / 198.90 |                   20.80 |              63.50 |                                                  0 / 0 / 0 |                       0.00 |
| better-precompiled         | repeated-1000 |              15/15 |         73.00 / 94.30 |                   120.40 / 148.20 |                   23.00 |              69.50 |                                                  0 / 0 / 0 |                       0.00 |
| better-precompiled-current | repeated-1000 |              15/15 |        50.50 / 116.00 |                    91.10 / 170.90 |                   14.80 |             126.80 |                                                  0 / 0 / 0 |                       0.00 |
| better-precompiled-narrow  | repeated-1000 |              15/15 |        54.90 / 137.50 |                   103.20 / 181.30 |                   17.00 |              72.20 |                                                  0 / 0 / 0 |                       0.00 |
| better-tree                | repeated-1000 |              15/15 |        50.10 / 122.70 |                    90.20 / 157.40 |                   14.20 |              88.70 |                                                  0 / 0 / 0 |                       0.00 |
| better-static              | repeated-1000 |              15/15 |         39.90 / 60.10 |                     76.30 / 95.70 |                   11.80 |              54.00 |                                                  0 / 0 / 0 |                       0.00 |
| svgr-raw                   | repeated-1000 |              15/15 |         20.90 / 25.40 |                     57.40 / 69.70 |                    7.00 |              27.70 |                                                  0 / 0 / 0 |                       0.00 |
| svgr-optimized             | repeated-1000 |              15/15 |         21.70 / 50.90 |                     58.10 / 99.80 |                    7.30 |              43.70 |                                                  0 / 0 / 0 |                       0.00 |
| unplugin-icons             | repeated-1000 |              15/15 |         21.30 / 31.00 |                     58.50 / 73.70 |                    8.10 |              33.60 |                                                  0 / 0 / 0 |                       0.00 |
| inline                     | repeated-1000 |              15/15 |         31.80 / 51.40 |                    61.70 / 108.80 |                   25.40 |              34.60 |                                                  0 / 0 / 0 |                       0.00 |
| better-url                 | repeated-1000 |              15/15 |         53.00 / 72.00 |                    91.20 / 106.40 |                   15.30 |             107.60 |                                                1 / 1 / 595 |                       0.00 |
| react-svg                  | repeated-1000 |              15/15 |       214.80 / 389.20 |                   262.80 / 450.20 |                   12.20 |             247.60 |                                                1 / 1 / 595 |                       0.00 |
| react-inlinesvg            | repeated-1000 |              15/15 |       123.20 / 176.80 |                   161.10 / 238.20 |                   18.80 |             591.40 |                                                1 / 1 / 595 |                       0.00 |
| released-raw               | repeated-1000 |              15/15 |        72.10 / 168.30 |                   100.80 / 207.10 |                   37.70 |             103.70 |                                                  0 / 0 / 0 |                       0.00 |
| released-precompiled       | repeated-1000 |              15/15 |        87.60 / 203.30 |                   120.80 / 236.70 |                   45.00 |              91.90 |                                                  0 / 0 / 0 |                       0.00 |
| better-raw                 | unique-100    |              15/15 |          6.70 / 12.00 |                     32.20 / 32.50 |                    1.70 |              47.60 |                                                  0 / 0 / 0 |                       0.00 |
| better-current             | unique-100    |              15/15 |          6.10 / 68.60 |                     32.30 / 88.10 |                    2.40 |              39.80 |                                                  0 / 0 / 0 |                       0.00 |
| better-narrow              | unique-100    |              15/15 |          6.50 / 11.40 |                     32.10 / 32.70 |                    1.70 |              42.00 |                                                  0 / 0 / 0 |                       0.00 |
| better-precompiled         | unique-100    |              15/15 |          5.50 / 15.20 |                     32.30 / 32.50 |                    1.60 |              20.80 |                                                  0 / 0 / 0 |                       0.00 |
| better-precompiled-current | unique-100    |              15/15 |          6.70 / 13.40 |                     32.20 / 32.50 |                    2.00 |              21.20 |                                                  0 / 0 / 0 |                       0.00 |
| better-precompiled-narrow  | unique-100    |              15/15 |          6.60 / 12.50 |                     32.30 / 33.60 |                    2.10 |              19.10 |                                                  0 / 0 / 0 |                       0.00 |
| better-tree                | unique-100    |              15/15 |          4.90 / 11.20 |                     32.40 / 32.60 |                    1.60 |              27.10 |                                                  0 / 0 / 0 |                       0.00 |
| better-static              | unique-100    |              15/15 |           5.50 / 8.90 |                     32.50 / 33.80 |                    1.40 |              20.20 |                                                  0 / 0 / 0 |                       0.00 |
| svgr-raw                   | unique-100    |              15/15 |           2.70 / 4.80 |                     31.50 / 32.60 |                    1.40 |              19.40 |                                                  0 / 0 / 0 |                       0.00 |
| svgr-optimized             | unique-100    |              15/15 |           3.10 / 9.20 |                     32.00 / 32.80 |                    1.60 |              19.20 |                                                  0 / 0 / 0 |                       0.00 |
| unplugin-icons             | unique-100    |              15/15 |           3.40 / 6.70 |                     32.30 / 32.80 |                    1.40 |              18.10 |                                                  0 / 0 / 0 |                       0.00 |
| inline                     | unique-100    |              15/15 |           3.40 / 6.30 |                     32.50 / 32.80 |                    4.50 |               9.60 |                                                  0 / 0 / 0 |                       0.00 |
| better-url                 | unique-100    |              15/15 |          8.60 / 15.50 |                     32.30 / 32.50 |                    1.70 |             178.30 |                                          100 / 100 / 67893 |                       0.00 |
| react-svg                  | unique-100    |              15/15 |         15.90 / 21.10 |                     32.00 / 32.20 |                    1.20 |             201.20 |                                          100 / 100 / 67893 |                       0.00 |
| react-inlinesvg            | unique-100    |              15/15 |         16.30 / 23.50 |                     32.20 / 32.40 |                    1.90 |             172.60 |                                          100 / 100 / 67893 |                       0.00 |
| released-raw               | unique-100    |              15/15 |          9.50 / 12.10 |                     31.90 / 32.00 |                    4.90 |              41.70 |                                                  0 / 0 / 0 |                       0.00 |
| released-precompiled       | unique-100    |              15/15 |          9.90 / 16.30 |                     31.60 / 34.80 |                    4.10 |              30.60 |                                                  0 / 0 / 0 |                       0.00 |
| released-url               | unique-100    |              15/15 |          9.50 / 13.80 |                     31.70 / 32.00 |                    4.10 |             190.20 |                                          100 / 100 / 67893 |                       0.00 |

The first sample and every failed sample remain in the raw JSON. A fresh document is required per profile and scenario to label the first sample library-cache-cold. Fresh runtime URL tokens avoid prior HTTP-cache hits; warm samples retain each library's normal request caching. Two animation frames measure a paint opportunity, not physical presentation. Opacity updates apply to the SVG for static adapters and Better SVG, and to the documented wrapper for react-svg. Memory readings and long tasks are diagnostics, not leak evidence.
Resource loads count SVG Resource Timing entries, including cache hits and coalesced fetches. They are not necessarily separate network requests. Transferred-resource counts and transfer bytes remain in the raw data. Encoded body sizes can count a cached body more than once. The Resource Timing buffer is expanded to retain the repeated-icon workload.

## Correctness observations

Capability fixtures are built separately from the timing assets. They record computed paints, roles, descriptions, reference resolution, duplicate IDs, and external CSS behavior. These are observations, not a common-feature assertion that every library promises sanitization, caller-reference rewriting, or descendant paint overrides. Review the contract results before treating any optimization as compatible.

## Coverage gaps

The corpus includes catalog icons and two small repository assets, not a representative set of editor exports. This run does not measure real mobile devices, React Native, Flutter, Astro SSR, hydration, bandwidth-limited HTTP delivery, GPU presentation, or browser engines not listed in the raw browser metadata. Do not extrapolate desktop timings to those environments.
