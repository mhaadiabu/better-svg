import { registerLocalSvgs } from "./core/local";

const srcSvgs = import.meta.glob("/src/assets/svg/**/*.svg", {
  eager: true,
  import: "default",
});

const appSvgs = import.meta.glob("/app/assets/svg/**/*.svg", {
  eager: true,
  import: "default",
});

registerLocalSvgs(srcSvgs, { override: true });
registerLocalSvgs(appSvgs, { override: false });

export {};
