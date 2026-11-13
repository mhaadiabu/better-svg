import * as React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { RenderIcon, names, profile, fixtureHash, experimentHash } from "./adapter.jsx";

const stage = document.getElementById("stage");
const frame = () =>
  new Promise((resolve) => {
    const handle = requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve(true);
    });
    const timer = setTimeout(() => {
      cancelAnimationFrame(handle);
      resolve(false);
    }, 1000);
  });
const settle = async () => {
  const first = await frame();
  const second = await frame();
  return first && second;
};
let activeRoot;

const ready = (expected, render) =>
  new Promise((resolve) => {
    let timer;
    const finish = (status) => {
      clearTimeout(timer);
      observer.disconnect();
      resolve({ status, rendered: stage.querySelectorAll("svg").length });
    };
    const observer = new MutationObserver(() => {
      if (stage.querySelectorAll("svg").length === expected) finish("ready");
    });
    observer.observe(stage, { childList: true, subtree: true });
    timer = setTimeout(() => finish("timeout"), 10_000);
    render();
    if (stage.querySelectorAll("svg").length === expected) finish("ready");
  });

const renderIcons = (indices, revision, extra = {}) =>
  indices.map((index, position) => (
    <RenderIcon
      key={position}
      name={names[index]}
      width={24}
      height={24}
      opacity={revision ? 0.5 : 1}
      data-bench-state={revision}
      {...extra}
    />
  ));

const sample = async (indices, phase) => {
  if (activeRoot) flushSync(() => activeRoot.unmount());
  activeRoot = createRoot(stage);
  window.svgBenchmarkErrors = [];
  performance.clearResourceTimings();
  let mountCommitMs;
  const start = performance.now();
  const state = await ready(indices.length, () => {
    const before = performance.now();
    flushSync(() => activeRoot.render(renderIcons(indices, 0)));
    mountCommitMs = performance.now() - before;
  });
  const readyMs = performance.now() - start;
  const mountFrames = await settle();
  const paintOpportunityMs = performance.now() - start;
  const bounds = [...stage.querySelectorAll("svg")].map((node) => node.getBoundingClientRect());
  const sizeMismatch = bounds.filter(
    (box) => Math.abs(box.width - 24) > 0.1 || Math.abs(box.height - 24) > 0.1,
  ).length;
  const beforeUpdate = performance.now();
  flushSync(() => activeRoot.render(renderIcons(indices, 1)));
  const updateCommitMs = performance.now() - beforeUpdate;
  const updateFrames = await settle();
  const updatePaintOpportunityMs = performance.now() - beforeUpdate;
  const updates = stage.querySelectorAll('[data-bench-state="1"]').length;
  const resources = performance
    .getEntriesByType("resource")
    .filter((entry) => new URL(entry.name).pathname.startsWith("/icons/"));
  return {
    phase,
    ...state,
    status:
      state.status === "ready" && (!mountFrames || !updateFrames) ? "frame-stalled" : state.status,
    expected: indices.length,
    sizeMismatch,
    updates,
    errors: [...window.svgBenchmarkErrors],
    mountCommitMs,
    readyMs,
    paintOpportunityMs,
    updateCommitMs,
    updatePaintOpportunityMs,
    requests: resources.length,
    transferBytes: resources.reduce((total, entry) => total + entry.transferSize, 0),
    encodedBodyBytes: resources.reduce((total, entry) => total + entry.encodedBodySize, 0),
    elements: stage.querySelectorAll("*").length,
  };
};

const runSuite = async ({ repetitions = 15, warmups = 3, scenario: selectedScenario } = {}) => {
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 100)
    throw new Error("repetitions must be an integer between 1 and 100");
  if (!Number.isInteger(warmups) || warmups < 0 || warmups > 20)
    throw new Error("warmups must be between 0 and 20");
  if (selectedScenario && !["one", "repeated-1000", "unique-100"].includes(selectedScenario))
    throw new Error(`Unknown scenario: ${selectedScenario}`);
  if (document.visibilityState !== "visible") throw new Error("The benchmark page must be visible");
  const heapBefore = performance.memory?.usedJSHeapSize ?? null;
  const longTasks = [];
  const observer = PerformanceObserver.supportedEntryTypes.includes("longtask")
    ? new PerformanceObserver((entries) =>
        longTasks.push(
          ...entries.getEntries().map(({ startTime, duration }) => ({ startTime, duration })),
        ),
      )
    : null;
  observer?.observe({ type: "longtask" });
  const result = {
    profile,
    fixtureHash,
    experimentHash,
    initialResources: performance.getEntriesByType("resource").map((entry) => ({
      name: new URL(entry.name).pathname,
      transferBytes: entry.transferSize,
      encodedBodyBytes: entry.encodedBodySize,
    })),
    environment: {
      userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight },
      devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency,
      visibility: document.visibilityState,
      timeOrigin: performance.timeOrigin,
    },
    repetitions,
    warmups,
    scenarios: [],
  };
  for (const [scenario, indices] of [
    ["one", [0]],
    ["repeated-1000", Array(1000).fill(0)],
    [
      "unique-100",
      Array.from({ length: Math.min(100, names.length) }, (_unused, index) =>
        Math.floor((index * (names.length - 1)) / (Math.min(100, names.length) - 1 || 1)),
      ),
    ],
  ]) {
    if (selectedScenario && selectedScenario !== scenario) continue;
    globalThis.svgBenchmarkToken = crypto.randomUUID();
    const samples = [await sample(indices, "first-use")];
    for (let index = 0; index < warmups; index++) await sample(indices, "warmup");
    for (let index = 0; index < repetitions; index++) samples.push(await sample(indices, "warm"));
    result.scenarios.push({ scenario, samples });
  }
  if (activeRoot) {
    flushSync(() => activeRoot.unmount());
    activeRoot = undefined;
  }
  observer?.disconnect();
  result.diagnostics = {
    heapBefore,
    heapAfter: performance.memory?.usedJSHeapSize ?? null,
    longTasks: observer ? longTasks : null,
    moduleReadyMs,
  };
  return result;
};

const inspect = (svg) => {
  const paints = [...svg.querySelectorAll("path,rect,circle")].map((node) => ({
    tag: node.localName,
    fill: getComputedStyle(node).fill,
    stroke: getComputedStyle(node).stroke,
    insideMask: Boolean(node.closest("mask")),
  }));
  const ids = [svg, ...svg.querySelectorAll("[id]")]
    .filter((node) => node.id)
    .map((node) => node.id);
  const references = [svg, ...svg.querySelectorAll("*")].flatMap((node) =>
    [...node.attributes].flatMap((attr) =>
      attr.localName === "href" && attr.value.startsWith("#")
        ? [attr.value.slice(1)]
        : [...attr.value.matchAll(/url\(["']?#([^\s)'" ]+)/g)].map((match) => match[1]),
    ),
  );
  const labelledBy = (svg.getAttribute("aria-labelledby") ?? "").split(/\s+/).filter(Boolean);
  return {
    role: svg.getAttribute("role"),
    title: svg.querySelector("title")?.textContent ?? null,
    desc: svg.querySelector("desc")?.textContent ?? null,
    ids,
    references,
    dangling: references.filter((id) => !ids.includes(id)),
    labelledBy,
    danglingLabels: labelledBy.filter((id) => !ids.includes(id)),
    paints,
    foreignObjects: svg.querySelectorAll("foreignObject").length,
    pathsInPair: svg.querySelectorAll("g.pair > path").length,
  };
};

const contracts = async () => {
  const result = [];
  for (const [index, name] of names.entries()) {
    if (activeRoot) flushSync(() => activeRoot.unmount());
    activeRoot = createRoot(stage);
    stage.className = name;
    globalThis.svgBenchmarkToken = crypto.randomUUID();
    window.svgBenchmarkErrors = [];
    const props =
      name === "paint-none"
        ? { stroke: "blue" }
        : name === "mask-paint"
          ? { fill: "blue" }
          : name === "caller-gradient"
            ? { fill: "url(#callerPaint)" }
            : {};
    const state = await ready(2, () =>
      flushSync(() => activeRoot.render(renderIcons([index, index], 0, props))),
    );
    const painted = await settle();
    const svgs = [...stage.querySelectorAll("svg")];
    const observations = svgs.map(inspect);
    const ids = observations.flatMap((svg) => svg.ids);
    result.push({
      name,
      ...state,
      status: state.status === "ready" && !painted ? "frame-stalled" : state.status,
      observations,
      duplicateIds: ids.filter((id, position) => ids.indexOf(id) !== position),
      errors: [...window.svgBenchmarkErrors],
    });
  }
  stage.className = "";
  if (activeRoot) {
    flushSync(() => activeRoot.unmount());
    activeRoot = undefined;
  }
  return { profile, fixtureHash, experimentHash, cases: result };
};

const moduleReadyMs = performance.now();
window.svgBenchmark = { runSuite, contracts, profile, names };
