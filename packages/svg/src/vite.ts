import { registerLocalSvgs } from "./core/local.js";

const srcSvgs = import.meta.glob("/src/assets/svg/**/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
});

const appSvgs = import.meta.glob("/app/assets/svg/**/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
});

registerLocalSvgs(srcSvgs, { override: true });
registerLocalSvgs(appSvgs, { override: false });

export {};
