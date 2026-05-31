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
  assets: "dist",
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
});

console.log(`Web    -> ${web.url}`);

await app.finalize();
