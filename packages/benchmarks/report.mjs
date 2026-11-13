import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { cache, summarize } from "./config.mjs";

const nodeFile = process.argv[2] ? resolve(process.argv[2]) : join(cache, "node.json");
const browserFile = process.argv[3] ? resolve(process.argv[3]) : join(cache, "browser.json");
const node = JSON.parse(await readFile(nodeFile, "utf8"));
const browser = JSON.parse(await readFile(browserFile, "utf8"));
if (browser.fixtureHash !== node.manifest.fixtureHash)
  throw new Error("Node and browser fixture hashes do not match");
const decimal = (value) => (value === null ? "unsupported" : value.toFixed(2));
const lines = [
  "# React SVG benchmark pilot",
  "",
  `Library source commit: ${node.manifest.sourceCommit}.`,
  `Fixture hash: ${node.manifest.fixtureHash}.`,
  "",
  "This is a local desktop pilot, not a universal ranking. Build sizes include the benchmark controller and React. Runtime URL profiles also emit separate SVG assets. Emitted deployment size is not the same as bytes fetched for one scenario. Timings do not include SVG package compilation or fixture generation. SVGR compilation and optimization run inside each Vite build and development transform.",
  "",
  "## Production output and Node SSR",
  "",
  "| Profile | Emitted gzip bytes | Build median ms | Dev entry-ready median ms | Edit-transform median ms | SSR SVGs / 100 | Eligible SSR median ms |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
];
for (const profile of node.profiles)
  lines.push(
    `| ${profile.profile} | ${profile.totalBytes.gzip} | ${decimal(profile.buildMs.median)} | ${profile.dev.every((sample) => sample.status === "error") ? "FAILED" : decimal(profile.startupEntryMs.median)} | ${profile.dev.every((sample) => sample.status === "error") ? "FAILED" : decimal(profile.editTransformMs.median)} | ${profile.ssr.rendered} | ${decimal(profile.ssr.milliseconds.median)} |`,
  );
lines.push(
  "",
  "Node timing uses fresh Vite worker processes for development measurements. The filesystem cache is uncontrolled. Edit-transform timing explicitly invalidates the affected module after writing one generated SVG and waits for transformed output. It is not browser HMR, React update latency, or page reload latency. Build timing uses rotated adapter order in one Node process, so process and library import caches can be warm. SSR measures React serialization, not HTTP TTFB.",
  "",
  "## Browser warm remounts",
  "",
  "| Profile | Scenario | Valid warm samples | Ready median / p95 ms | Paint-opportunity median / p95 ms | Update commit median ms | First-sample requests | Warm median requests |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
);
const summaries = [];
for (const run of browser.runs) {
  if (run.fixtureHash !== node.manifest.fixtureHash)
    throw new Error(`Stale browser document for ${run.profile}`);
  for (const scenario of run.scenarios) {
    const warm = scenario.samples.filter((sample) => sample.phase === "warm");
    const valid = warm.filter(
      (sample) =>
        sample.status === "ready" &&
        sample.rendered === sample.expected &&
        sample.updates === sample.expected &&
        sample.sizeMismatch === 0 &&
        sample.errors.length === 0,
    );
    const timing = (key) => summarize(valid.map((sample) => sample[key]));
    const ready = timing("readyMs"),
      paint = timing("paintOpportunityMs"),
      update = timing("updateCommitMs"),
      requests = timing("requests");
    summaries.push({
      profile: run.profile,
      scenario: scenario.scenario,
      valid: valid.length,
      total: warm.length,
      ready,
      paint,
      update,
      requests,
    });
    lines.push(
      `| ${run.profile} | ${scenario.scenario} | ${valid.length}/${warm.length} | ${decimal(ready.median)} / ${decimal(ready.p95)} | ${decimal(paint.median)} / ${decimal(paint.p95)} | ${decimal(update.median)} | ${scenario.samples[0].requests} | ${decimal(requests.median)} |`,
    );
  }
}
lines.push(
  "",
  "The first sample and every failed sample remain in the raw JSON. A fresh document is required per profile and scenario to label the first sample library-cache-cold. Fresh runtime URL tokens avoid prior HTTP-cache hits; warm samples retain each library's normal request caching. Two animation frames measure a paint opportunity, not physical presentation. Opacity updates apply to the SVG for static adapters and Better SVG, and to the documented wrapper for react-svg. Memory readings and long tasks are diagnostics, not leak evidence.",
  "",
  "## Correctness observations",
  "",
  "Capability fixtures are built separately from the timing assets. They record computed paints, roles, descriptions, reference resolution, duplicate IDs, and external CSS behavior. These are observations, not a common-feature assertion that every library promises sanitization, caller-reference rewriting, or descendant paint overrides. Review the contract results before treating any optimization as compatible.",
  "",
  "## Coverage gaps",
  "",
  "The corpus includes catalog icons and two small repository assets, not a representative set of editor exports. This run does not measure real mobile devices, React Native, Flutter, Astro SSR, unplugin-icons, hydration, bandwidth-limited HTTP delivery, GPU presentation, or browser engines not listed in the raw browser metadata. Do not extrapolate desktop timings to those environments.",
  "",
);
const output = join(cache, "report.md");
await writeFile(output, lines.join("\n"));
await writeFile(
  join(cache, "summary.json"),
  JSON.stringify(
    {
      environment: node.environment,
      versions: node.manifest.versions,
      svgrSvgo: node.manifest.svgrSvgo,
      profiles: node.profiles,
      browser: summaries,
      contracts: browser.contracts,
    },
    null,
    2,
  ),
);
console.log(`Saved ${output}`);
