import {
  ensureParsedSvg,
  resolveMarkup,
  resolveSource,
  type SvgNameInput,
} from "../core";

export type SvelteSvgProps = {
  src?: string;
  name?: SvgNameInput;
  fetchOptions?: RequestInit;
  cache?: boolean;
  sanitize?: boolean;
  loading?: unknown;
  fallback?: unknown;
  onSvgLoad?: (markup: string) => void;
  onSvgError?: (error: Error) => void;
  class?: string;
  style?: string;
  width?: string | number;
  height?: string | number;
  viewBox?: string;
  fill?: string;
  stroke?: string;
  role?: string;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
};

const svgCache = new Map<string, string>();

export type ParsedSvg = {
  attrs: Record<string, string>;
  className?: string;
  style?: string;
  innerHTML: string;
};

export const parseSvgMarkup = (
  source: string,
  markup: string,
  sanitize: boolean,
  cache = true,
): ParsedSvg | null => {
  const inline = ensureParsedSvg(source, markup, sanitize, cache);
  if (!inline) return null;
  const styleText = inline.style
    ? Object.entries(inline.style).map(([k, v]) => `${k}:${v}`).join(";")
    : undefined;
  return {
    attrs: inline.attrs,
    className: inline.className,
    style: styleText,
    innerHTML: inline.innerHTML,
  };
};

export type SvgState =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; content: ParsedSvg; markup: string };

export const createSvgController = () => {
  let current: AbortController | null = null;
  let cache = svgCache;
  let lastSource: string | null = null;

  const load = async (props: SvelteSvgProps, update: (state: SvgState) => void) => {
    if (current) current.abort();
    const controller = new AbortController();
    current = controller;

    const resolved = resolveSource(props.src, props.name);
    if (!resolved) {
      const err = new Error("Either name or src is required.");
      update({ status: "error", error: err });
      props.onSvgError?.(err);
      return;
    }

    if (lastSource === resolved && cache.has(resolved)) {
      const cached = cache.get(resolved) ?? "";
      const parsed = parseSvgMarkup(resolved, cached, props.sanitize ?? true, true);
      if (parsed) {
        update({ status: "ready", content: parsed, markup: cached });
        props.onSvgLoad?.(cached);
        return;
      }
    }

    update({ status: "loading" });

    try {
      const markup = await resolveMarkup(resolved, {
        fetchOptions: props.fetchOptions,
        signal: controller.signal,
        cache: props.cache ?? true,
      });
      if (controller.signal.aborted) return;
      if (props.cache ?? true) {
        cache.set(resolved, markup);
        lastSource = resolved;
      }
      const parsed = parseSvgMarkup(resolved, markup, props.sanitize ?? true, props.cache ?? true);
      if (!parsed) throw new Error("SVG markup is invalid or unavailable in this environment.");
      update({ status: "ready", content: parsed, markup });
      props.onSvgLoad?.(markup);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      const normalized = err instanceof Error ? err : new Error("Failed to load SVG.");
      update({ status: "error", error: normalized });
      props.onSvgError?.(normalized);
    }
  };

  const abort = () => {
    if (current) current.abort();
  };

  return { load, abort };
};
