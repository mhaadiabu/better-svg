import browser from "../../../../packages/benchmarks/baselines/2026-11-18-release-comparison/browser.json";
import node from "../../../../packages/benchmarks/baselines/2026-11-18-release-comparison/node.json";

const repository = "https://github.com/mhaadiabu/better-svg";
export const archive = `${repository}/blob/cf95a27/packages/benchmarks/baselines/2026-11-18-release-comparison`;
export const published = node.manifest.betterSvg.published;
const workflows = [
  { id: "released-raw", label: `Better SVG ${published}`, mode: "Named icon" },
  { id: "better-raw", label: "Better SVG current", mode: "Named icon", current: true },
  { id: "better-static", label: "Better SVG current", mode: "Static import", current: true },
  { id: "svgr-raw", label: "vite-plugin-svgr", mode: "Static import" },
  { id: "unplugin-icons", label: "unplugin-icons", mode: "Static import" },
  { id: "released-url", label: `Better SVG ${published}`, mode: "Runtime URL" },
  { id: "better-url", label: "Better SVG current", mode: "Runtime URL", current: true },
  { id: "react-inlinesvg", label: "react-inlinesvg", mode: "Runtime URL" },
  { id: "react-svg", label: "react-svg", mode: "Runtime URL" },
];

export const rows = workflows.map((workflow) => {
  const scenario = browser.runs
    .filter((run) => run.profile === workflow.id)
    .flatMap((run) => run.scenarios)
    .find((run) => run.scenario === "grid-24");
  const warmTimes = scenario?.samples
    .filter((sample) =>
      sample.phase === "warm" && sample.status === "ready" &&
      sample.rendered === sample.expected && sample.updates === sample.expected &&
      sample.sizeMismatch === 0 && sample.errors.length === 0
    )
    .map((sample) => sample.readyMs)
    .sort((left, right) => left - right) ?? [];
  const median = warmTimes[Math.floor(warmTimes.length / 2)];
  const profile = node.profiles.find((profile) => profile.profile === workflow.id);
  if (median === undefined || !profile) throw new Error(`Missing benchmark results for ${workflow.id}`);
  return {
    ...workflow,
    median,
    buildMs: profile.buildMs.median,
    full: profile.javascript.initialGzip,
    sparse: profile.sparseJavascript.initialGzip,
  };
});

export const benchmarkVite = node.manifest.versions.vite;
export const benchmarkWorkspace = node.manifest.betterSvg.workspace;
export const kb = (bytes: number) => `${(bytes / 1000).toFixed(1)} kB`;
