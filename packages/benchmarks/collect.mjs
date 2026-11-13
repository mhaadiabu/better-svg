const frame = document.querySelector("iframe");
const status = document.querySelector("output");
const button = document.querySelector("button");
const configuration = JSON.parse(document.getElementById("configuration").textContent);
let running = false;

const load = async (path) => {
  frame.src = path;
  const started = performance.now();
  while (performance.now() - started < 30_000) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const controller = frame.contentWindow?.svgBenchmark;
    if (frame.contentWindow?.location.pathname === path && controller) return controller;
  }
  throw new Error(`No benchmark controller at ${path}`);
};

const run = async ({ repetitions = 15, warmups = 3 } = {}) => {
  if (running) throw new Error("Collection is already running");
  running = true;
  button.disabled = true;
  window.svgCollection.state = "running";
  try {
    const manifest = await fetch("/manifest.json").then((response) => response.json());
    const data = {
      fixtureHash: manifest.fixtureHash,
      collectedAt: new Date().toISOString(),
      runs: [],
      contracts: [],
    };
    const scenarios = ["one", "repeated-1000", "unique-100"];
    for (const [index, scenario] of scenarios.entries()) {
      const order = configuration.profiles
        .slice(index)
        .concat(configuration.profiles.slice(0, index));
      for (const profile of order) {
        status.textContent = `${profile}: ${scenario}`;
        const controller = await load(`/${profile}/`);
        data.runs.push(await controller.runSuite({ scenario, repetitions, warmups }));
      }
    }
    for (const profile of configuration.profiles) {
      status.textContent = `${profile}: capabilities`;
      const controller = await load(`/contracts-${profile}/`);
      data.contracts.push(await controller.contracts());
    }
    const response = await fetch("/results", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Benchmark-Token": configuration.token },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Saving results failed: ${response.status}`);
    window.svgCollection.state = "complete";
    status.textContent = "Saved .cache/browser.json";
    return { runs: data.runs.length, contracts: data.contracts.length };
  } catch (error) {
    window.svgCollection.state = "failed";
    status.textContent = String(error);
    throw error;
  } finally {
    frame.src = "about:blank";
    running = false;
    button.disabled = false;
  }
};

window.svgCollection = { run, state: "idle" };
button.addEventListener("click", () => run().catch(console.error));
