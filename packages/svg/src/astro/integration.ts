import type { AstroIntegration } from "astro";
import { svgPlugin, type SvgPluginOptions } from "../vite/plugin.js";

export const svg = (options: SvgPluginOptions = {}): AstroIntegration => ({
  name: "@mhaadi/svg",
  hooks: {
    "astro:config:setup": ({ updateConfig }) => {
      updateConfig({ vite: { plugins: [svgPlugin(options)] } });
    },
  },
});

export default svg;
