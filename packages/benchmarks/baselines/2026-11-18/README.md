# November 18 benchmark rerun

The current library is [`321b98a`](https://github.com/mhaadiabu/better-svg/commit/321b98ac4061ade2e99202a96e1b4e981c195803). The benchmark harness was prepared at `25759ad`. This run used 102 timing SVGs and eight separate capability fixtures, with no extra corpus. Node 26.13.1, Vite 8.3.3, React 19.2.6, and headless Chromium 157.0.8103.78 ran on Linux with an Intel i7-4600U. HTTP was uncompressed loopback.

## Runtime changes

The paired run alternated the baseline library at `d8f2e50` and the current library in one browser session, with the same dependencies, harness, and inputs. Pruning was disabled for the named profiles. There were two blocks, a fresh document per profile, phase and workload, three warmups and 15 recorded warm samples per document. Task order and before/after order rotated. All 480 warm samples passed.

| 1,000 copies of one icon    | Warm ready before → current | Root update before → current |
| --------------------------- | --------------------------: | ---------------------------: |
| Better SVG, raw             |              82.4 → 58.2 ms |               44.2 → 19.3 ms |
| Better SVG, precompiled     |              77.9 → 54.9 ms |               40.7 → 15.1 ms |
| Better SVG, URL             |              65.8 → 52.2 ms |               36.7 → 15.9 ms |
| SVGR raw, unchanged control |              24.4 → 21.5 ms |                 8.4 → 7.4 ms |

The clearest gains were root-prop updates. For 100 unique raw icons, the update median fell from 5.8 to 2.4 ms. With 100 unique URLs, updates fell from 5.1 to 3.2 ms, while time to ready went from 8.6 to 10.1 ms. The SVGR control also moved between phases, so the timing deltas are specific to this run.

For 1,000 copies of one remote SVG, both cold observations went from 1,000 Resource Timing entries to one. Each observation transferred one response and 595 bytes in both phases. The improvement is less duplicate request work inside the browser. The original browser already coalesced the network transfer.

## Delivery options

The separate full matrix recorded 39 browser scenarios, 585 valid warm samples, and 104 completed capability cases. Node build times are medians of five builds. Initial JS is the entry for these profiles. Gzip includes React and the benchmark controller.

| Full 102-icon corpus            | Initial JS | All emitted JS | Build median | SVGs rendered in Node SSR |
| ------------------------------- | ---------: | -------------: | -----------: | ------------------------: |
| Better SVG, named raw           |    81.5 kB |       111.8 kB |       190 ms |                   0 / 100 |
| Better SVG, legacy precompiled  |    89.2 kB |       119.6 kB |       218 ms |                   0 / 100 |
| Better SVG, tree precompiled    |    80.6 kB |        80.6 kB |       188 ms |                   0 / 100 |
| Better SVG, static React import |    73.9 kB |        73.9 kB |       203 ms |                 100 / 100 |
| SVGR, optimization off          |    70.0 kB |        70.0 kB |       370 ms |                 100 / 100 |

Tree mode reduced initial JS by 9.6% versus legacy precompilation and emitted no separate XML parser chunk in this build. Static imports supported server rendering and came within 4 kB of SVGR on initial JS. SVGR was still faster in the 1,000-copy browser workload. Tree and static matched the raw renderer on the eight capability fixtures after normalizing generated IDs. The current SVGO preset continued to change observations on six fixtures.

A separate build referenced one literal name out of the 102 local files, with React external. Default pruning reduced the gzip size of all initial JS chunks from 19.9 to 13.5 kB, a 32% decrease. Total emitted JS rose from 50.3 to 51.0 kB because the other icons remained available in the deferred chunk.

## Limits

The named Better SVG profiles still fail the harness's Vite 8 dev edit-transform probe. Vite tries to resolve the watched icon directory as an import. Those samples are excluded from dev timing comparisons. Production builds and browser samples completed. One desktop run cannot establish mobile performance, cross-browser behavior, or stable cold latency.

The harness writes the full report and raw Node and browser runs to `packages/benchmarks/.cache`. The extra paired run used the same generated browser harness with only the compiled SVG library swapped between navigations.
