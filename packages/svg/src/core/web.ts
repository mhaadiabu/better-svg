import { ensureParsedSvg } from "./cache.js";
import { resolveMarkup, resolveSource } from "./resolve.js";
import type { SvgNameInput } from "./local.js";
import type { ParsedInlineSvg } from "./sanitize.js";
import { createSvgId, rewriteSvgAttributes, scopeParsedSvgIds } from "./ids.js";

export type WebSvgOptions = {
  src?: string;
  name?: SvgNameInput;
  fetchOptions?: RequestInit;
  cache?: boolean;
  sanitize?: boolean;
  uniqueIds?: boolean;
  onSvgLoad?: (markup: string) => void;
  onSvgError?: (error: Error) => void;
};

export type WebSvgState =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; content: ParsedInlineSvg };

export const createWebSvgController = () => {
  const prefix = createSvgId();
  let current: AbortController | undefined;

  const load = async (options: WebSvgOptions, update: (state: WebSvgState) => void) => {
    current?.abort();
    const controller = new AbortController();
    current = controller;
    update({ status: "loading" });

    try {
      const source = resolveSource(options.src, options.name);
      if (!source) throw new Error("Either name or src is required.");
      const markup = await resolveMarkup(source, {
        signal: controller.signal,
        cache: options.cache ?? true,
        fetchOptions: options.fetchOptions,
      });
      if (controller.signal.aborted) return;
      const content = ensureParsedSvg(
        source,
        markup,
        options.sanitize ?? true,
        options.cache ?? true,
      );
      if (!content) throw new Error("SVG markup is invalid or unavailable in this environment.");
      update({
        status: "ready",
        content: options.uniqueIds === false ? content : scopeParsedSvgIds(content, prefix),
      });
      options.onSvgLoad?.(markup);
    } catch (cause) {
      if (controller.signal.aborted) return;
      const error = cause instanceof Error ? cause : new Error("Failed to load SVG.");
      update({ status: "error", error });
      options.onSvgError?.(error);
    }
  };

  return { load, abort: () => current?.abort() };
};

import { svgDimensions, svgViewBox, type SvgPresentation } from "./presentation.js";

export type WebSvgAttributes = SvgPresentation & {
  width?: string | number;
  height?: string | number;
  viewBox?: string;
  fill?: string;
  stroke?: string;
  role?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-hidden"?: boolean | "true" | "false";
  class?: string;
  style?: string;
};

export const mergeSvgAttributes = (content: ParsedInlineSvg, overrides: WebSvgAttributes) => {
  const attrs: Record<string, string | number | boolean | undefined> = {
    ...content.attrs,
    ...svgDimensions(overrides),
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined && !["size", "title", "desc"].includes(key)) attrs[key] = value;
  }
  if (overrides["aria-label"] !== undefined && overrides["aria-labelledby"] === undefined)
    delete attrs["aria-labelledby"];
  const viewBox = svgViewBox(content.attrs, overrides);
  if (viewBox !== undefined) attrs.viewBox = viewBox;
  attrs.class = [content.className, overrides.class].filter(Boolean).join(" ") || undefined;
  attrs.style = [content.styleText, overrides.style].filter(Boolean).join(";") || undefined;
  return rewriteSvgAttributes(attrs, content.ids);
};
