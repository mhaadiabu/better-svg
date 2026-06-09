import {
  domParserAvailable,
  parseInlineStyle,
  resolveMarkup,
  resolveSource,
  toCamelCase,
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

const toCamelCaseStyle = (style: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(style)) {
    out[key.startsWith("--") ? key : toCamelCase(key)] = value;
  }
  return out;
};

export const parseSvgMarkup = (markup: string, sanitize: boolean): ParsedSvg | null => {
  if (!domParserAvailable()) return null;
  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(markup, "image/svg+xml");
  if (parsedDocument.querySelector("parsererror")) return null;
  const svg = parsedDocument.querySelector("svg");
  if (!svg) return null;

  if (sanitize) {
    svg
      .querySelectorAll("script, foreignObject, iframe, object, embed")
      .forEach((node) => node.remove());
    const walker = svg.ownerDocument.createTreeWalker(svg, NodeFilter.SHOW_ELEMENT);
    let current: Element | null = svg;
    while (current) {
      for (const attr of Array.from(current.attributes)) {
        const name = attr.name;
        if (name.startsWith("on")) {
          current.removeAttribute(name);
          continue;
        }
        if (name === "style" && /url\(/i.test(attr.value)) {
          current.removeAttribute(name);
          continue;
        }
        if (name === "href" || name === "xlink:href") {
          if (!/^(#|\/|[a-zA-Z][a-zA-Z0-9+.-]*:)/.test(attr.value) && attr.value.trim() !== "") {
            current.removeAttribute(name);
          }
        }
      }
      current = walker.nextNode() as Element | null;
    }
  }

  const attrs: Record<string, string> = {};
  for (const attr of Array.from(svg.attributes)) attrs[attr.name] = attr.value;

  const className = attrs.class;
  if (className) delete attrs.class;
  let style: string | undefined;
  if (attrs.style) {
    const parsed = toCamelCaseStyle(parseInlineStyle(attrs.style));
    const styleText = Object.entries(parsed)
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
    if (styleText) style = styleText;
    delete attrs.style;
  }

  return {
    attrs,
    className,
    style,
    innerHTML: svg.innerHTML,
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

  const load = async (
    props: SvelteSvgProps,
    update: (state: SvgState) => void,
  ) => {
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
      const parsed = parseSvgMarkup(cached, props.sanitize ?? true);
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
      const parsed = parseSvgMarkup(markup, props.sanitize ?? true);
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
