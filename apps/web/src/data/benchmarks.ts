import browser from "../../../../packages/benchmarks/baselines/2026-11-18-release-comparison/browser.json";
import node from "../../../../packages/benchmarks/baselines/2026-11-18-release-comparison/node.json";

const repository = "https://github.com/mhaadiabu/better-svg";
export const archive = `${repository}/blob/cf95a27/packages/benchmarks/baselines/2026-11-18-release-comparison`;
export const runtimeSource = `${repository}/commit/526a822`;
export const published = node.manifest.betterSvg.published;
export const benchmarkRelease = "0.5.0";
const previous = `BetterSVG ${published}`;
const current = `BetterSVG ${benchmarkRelease}`;

const labels = {
  "released-raw": [previous, "Named · raw"],
  "released-precompiled": [previous, "Named · legacy precompiled"],
  "released-url": [previous, "Runtime URL"],
  "better-raw": [current, "Named · raw"],
  "better-current": [current, "Named · SVGO"],
  "better-narrow": [current, "Named · narrow SVGO"],
  "better-precompiled": [current, "Named · legacy precompiled"],
  "better-precompiled-current": [current, "Named · legacy precompiled + SVGO"],
  "better-precompiled-narrow": [current, "Named · legacy precompiled + narrow SVGO"],
  "better-tree": [current, "Named · compact tree"],
  "better-static": [current, "Static import"],
  "svgr-raw": ["vite-plugin-svgr", "Static import · raw"],
  "svgr-optimized": ["vite-plugin-svgr", "Static import · SVGO"],
  "unplugin-icons": ["unplugin-icons", "Static import"],
  inline: ["Inline React", "Control"],
  "better-url": [current, "Runtime URL"],
  "react-svg": ["react-svg", "Runtime URL"],
  "react-inlinesvg": ["react-inlinesvg", "Runtime URL"],
} as const;

export type ProfileId = keyof typeof labels;
export type BenchmarkLabel = { label: string; mode: string; current: boolean };

export const workloads = [
  { id: "one", title: "One icon" },
  { id: "grid-24", title: "24 icons in a grid" },
  { id: "unique-100", title: "100 unique icons" },
  { id: "repeated-1000", title: "1,000 copies of one icon" },
] as const;

type Sample = (typeof browser.runs)[number]["scenarios"][number]["samples"][number];
type WorkloadId = (typeof workloads)[number]["id"];

const isValid = (sample: Sample) =>
  sample.status === "ready" &&
  sample.rendered === sample.expected &&
  sample.updates === sample.expected &&
  sample.sizeMismatch === 0 &&
  sample.errors.length === 0;

const summarize = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    median: sorted[Math.floor(sorted.length / 2)] ?? null,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null,
  };
};

const profile = (id: ProfileId) => {
  const [label, mode] = labels[id];
  const results = node.profiles.find((entry) => entry.profile === id);
  const contract = browser.contracts.find((entry) => entry.profile === id);
  if (!results || !contract) throw new Error(`Missing benchmark results for ${id}`);
  return { id, label, mode, current: id.startsWith("better-"), ...results, contract: contract.cases };
};

export const profiles = (Object.keys(labels) as ProfileId[]).map(profile);

const browserResults = browser.runs.flatMap((run) =>
  run.scenarios.map(({ scenario, samples }) => {
    const warm = samples.filter((sample) => sample.phase === "warm");
    const valid = warm.filter(isValid);
    const timing = (key: "readyMs" | "paintOpportunityMs" | "updateCommitMs" | "requests") =>
      summarize(valid.map((sample) => sample[key]));
    const first = samples.find((sample) => sample.phase === "first-use");
    return {
      profile: run.profile,
      scenario,
      warmCount: warm.length,
      validCount: valid.length,
      ready: timing("readyMs"),
      paint: timing("paintOpportunityMs"),
      update: timing("updateCommitMs"),
      resources: timing("requests"),
      first: first && isValid(first) ? first : null,
    };
  }),
);

export const resultFor = (id: ProfileId, workload: WorkloadId) => {
  const result = browserResults.find((entry) => entry.profile === id && entry.scenario === workload);
  if (!result) throw new Error(`Missing ${workload} benchmark for ${id}`);
  return result;
};

export const staticProfiles = ["better-static", "svgr-raw", "unplugin-icons"] as const;
export const urlProfiles = ["released-url", "better-url", "react-inlinesvg", "react-svg"] as const;

export const rows = (["released-raw", "better-raw", ...staticProfiles, ...urlProfiles] as const).map((id) => {
  const { label, current, buildMs, javascript, sparseJavascript } = profile(id);
  const mode = urlProfiles.some((entry) => entry === id)
    ? "Runtime URL"
    : staticProfiles.some((entry) => entry === id) ? "Static import" : "Named icon";
  const median = resultFor(id, "grid-24").ready.median;
  if (median === null) throw new Error(`No valid grid benchmark for ${id}`);
  return { id, label, mode, current, median, buildMs: buildMs.median, full: javascript.initialGzip, sparse: sparseJavascript.initialGzip };
});

export const runInfo = {
  date: new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(browser.collectedAt)),
  dateTime: browser.collectedAt,
  cpu: node.environment.cpu,
  node: node.environment.node,
  versions: node.manifest.versions,
  workspace: node.manifest.betterSvg.workspace,
  iconCount: node.manifest.entries.filter((entry) => entry.group !== "capability").length,
  nodeRepetitions: node.repetitions,
  warmups: browser.runs[0].warmups,
  repetitions: browser.runs[0].repetitions,
  browserDocuments: browser.runs.length,
  browserViewport: browser.runs[0].environment.viewport,
  warmSamples: browserResults.reduce((total, result) => total + result.warmCount, 0),
  validWarmSamples: browserResults.reduce((total, result) => total + result.validCount, 0),
};

export const kb = (bytes: number) => `${(bytes / 1000).toFixed(1)} kB`;
export const ms = (timing: number) => `${timing.toFixed(1)} ms`;
