import alchemy from "alchemy";
import { Vite } from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });

const app = await alchemy("better-svg", {
  stateStore: (scope) => new CloudflareStateStore(scope),
});

export const web = await Vite("web", {
  cwd: "../../apps/web",
  assets: {
    directory: "dist",
    run_worker_first: true,
  },
  bindings: {
    VITE_SERVER_URL: alchemy.env.VITE_SERVER_URL!,
  },
  build: {
    command: "pnpm build",
  },
  dev: {
    command: "pnpm dev:bare -- --host 0.0.0.0 --port 4321",
    domain: "localhost:4321",
  },
  script: `
    export default {
      async fetch(request, env) {
        const url = new URL(request.url);
        if (url.hostname.endsWith(".workers.dev")) {
          return Response.redirect("https://svg.mhaadi.dev" + url.pathname + url.search, 301);
        }
        return env.ASSETS.fetch(request);
      }
    };
  `,
});

console.log(`Web    -> ${web.url}`);

await app.finalize();
