import { fileURLToPath } from "node:url";
import { join } from "node:path";

export const directory = fileURLToPath(new URL(".", import.meta.url));
export const cache = join(directory, ".cache");
export const root = fileURLToPath(new URL("../../", import.meta.url));
export const narrow = {
  plugins: [
    "removeDoctype",
    "removeXMLProcInst",
    "removeComments",
    "removeMetadata",
    {
      name: "convertPathData",
      params: {
        floatPrecision: 8,
        applyTransforms: false,
        applyTransformsStroked: false,
        straightCurves: false,
        convertToQ: false,
        convertToZ: false,
        smartArcRounding: false,
        removeUseless: false,
      },
    },
  ],
};

export const profiles = [
  { id: "better-raw", kind: "better", svgo: false },
  { id: "better-current", kind: "better", svgo: true },
  { id: "better-narrow", kind: "better", svgo: narrow },
  { id: "better-precompiled", kind: "better", svgo: false, precompiled: true },
  { id: "better-precompiled-current", kind: "better", svgo: true, precompiled: true },
  { id: "better-precompiled-narrow", kind: "better", svgo: narrow, precompiled: true },
  { id: "svgr-raw", kind: "svgr", svgo: false },
  { id: "svgr-optimized", kind: "svgr", svgo: true },
  { id: "inline", kind: "inline" },
  { id: "better-url", kind: "url" },
  { id: "react-svg", kind: "injector" },
];

export const summarize = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    samples: values,
    median: sorted[Math.floor(sorted.length / 2)] ?? null,
    p95: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? null,
  };
};
