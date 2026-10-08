import {
  defineComponent,
  ref,
  computed,
  watch,
  onBeforeUnmount,
  h,
  type PropType,
  type Slot,
} from "vue";
import {
  ensureParsedSvg,
  resolveMarkup,
  resolveSource,
  toCamelCase,
  type SvgNameInput,
} from "../core";
import {
  createSvgId,
  rewriteSvgAttributes,
  rewriteSvgValue,
  scopeParsedSvgIds,
  withSvgRootId,
} from "../core/ids";
import { withSvgColorOverrides } from "../core/colors";

import type { ParsedInlineSvg } from "../core/sanitize";
import { createSvgPresentation, svgDimensions, svgViewBox } from "../core/presentation";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; content: ParsedSvg };

type ParsedSvg = ParsedInlineSvg;

const toCamelCaseStyle = (style: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(style)) {
    out[key.startsWith("--") ? key : toCamelCase(key)] = value;
  }
  return out;
};

export { toCamelCaseStyle };

const styleToText = (
  style: string | Record<string, string | number> | undefined,
): string | undefined => {
  if (!style) return undefined;
  if (typeof style === "string") return style;
  return Object.entries(style)
    .map(([key, value]) => {
      const property = key.startsWith("--")
        ? key
        : key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`).replace(/^ms-/, "-ms-");
      return `${property}:${value}`;
    })
    .join(";");
};

export { styleToText };

export const SVG = defineComponent({
  name: "SVG",
  inheritAttrs: false,
  props: {
    id: { type: String as PropType<string | undefined>, default: undefined },
    src: { type: String as PropType<string | undefined>, default: undefined },
    name: { type: [String, Number] as PropType<SvgNameInput | undefined>, default: undefined },
    fetchOptions: { type: Object as PropType<RequestInit | undefined>, default: undefined },
    cache: { type: Boolean, default: true },
    sanitize: { type: Boolean, default: true },
    uniqueIds: { type: Boolean, default: true },
    onSvgLoad: {
      type: Function as PropType<((markup: string) => void) | undefined>,
      default: undefined,
    },
    onSvgError: {
      type: Function as PropType<((error: Error) => void) | undefined>,
      default: undefined,
    },
    size: { type: [String, Number] as PropType<string | number | undefined>, default: undefined },
    title: { type: String, default: undefined },
    desc: { type: String, default: undefined },
    width: { type: [String, Number] as PropType<string | number | undefined>, default: undefined },
    height: { type: [String, Number] as PropType<string | number | undefined>, default: undefined },
    viewBox: { type: String as PropType<string | undefined>, default: undefined },
    fill: { type: String as PropType<string | undefined>, default: undefined },
    stroke: { type: String as PropType<string | undefined>, default: undefined },
    role: { type: String as PropType<string | undefined>, default: undefined },
    ariaLabel: { type: String as PropType<string | undefined>, default: undefined },
    ariaHidden: {
      type: [Boolean, String] as PropType<boolean | "true" | "false" | undefined>,
      default: undefined,
    },
    class: { type: String as PropType<string | undefined>, default: undefined },
    style: {
      type: [String, Object] as PropType<string | Record<string, string | number> | undefined>,
      default: undefined,
    },
  },
  emits: ["svg-load", "svg-error"],
  setup(props, { slots, emit, attrs }) {
    const prefix = createSvgId();
    const present = createSvgPresentation();
    const state = ref<State>({ status: "loading" });
    let controller: AbortController | null = null;

    const run = (source: string | undefined, name: SvgNameInput | undefined, doCache: boolean) => {
      if (controller) controller.abort();
      const resolved = resolveSource(source, name);
      if (!resolved) {
        const err = new Error("Either name or src is required.");
        state.value = { status: "error" };
        emit("svg-error", err);
        return;
      }

      const c = new AbortController();
      controller = c;
      state.value = { status: "loading" };

      resolveMarkup(resolved, {
        fetchOptions: props.fetchOptions,
        signal: c.signal,
        cache: doCache,
      })
        .then((markup) => {
          if (c.signal.aborted) return;
          const inline = ensureParsedSvg(resolved, markup, props.sanitize ?? true, doCache);
          if (!inline) throw new Error("SVG markup is invalid or unavailable in this environment.");
          const scoped = props.uniqueIds ? scopeParsedSvgIds(inline, prefix) : inline;
          state.value = { status: "ready", content: scoped };
          emit("svg-load", markup);
        })
        .catch((err) => {
          if (c.signal.aborted) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          const normalized = err instanceof Error ? err : new Error("Failed to load SVG.");
          state.value = { status: "error" };
          emit("svg-error", normalized);
        });
    };

    watch(
      () => [
        props.src,
        props.name,
        props.fetchOptions,
        props.cache,
        props.sanitize,
        props.uniqueIds,
      ],
      () => {
        run(props.src, props.name as SvgNameInput | undefined, props.cache ?? true);
      },
      { immediate: true },
    );

    onBeforeUnmount(() => {
      if (controller) controller.abort();
    });

    const presentation = computed(() => {
      if (state.value.status !== "ready") return undefined;
      const colored = withSvgColorOverrides(
        state.value.content,
        { fill: props.fill, stroke: props.stroke },
      );
      return present(withSvgRootId(colored, props.id), props);
    });

    const mergedClass = computed(() => {
      if (state.value.status !== "ready") return undefined;
      const parts: string[] = [];
      if (state.value.content.className) parts.push(state.value.content.className);
      if (props.class) parts.push(props.class);
      return parts.filter(Boolean).join(" ") || undefined;
    });

    const mergedStyle = computed(() => {
      if (state.value.status !== "ready") return styleToText(props.style);
      const parts: string[] = [];
      if (presentation.value?.styleText) parts.push(presentation.value.styleText);
      const propStyle = styleToText(props.style);
      if (propStyle) parts.push(propStyle);
      const style = parts.filter(Boolean).join(";") || undefined;
      const ids = presentation.value?.ids;
      return style && ids ? rewriteSvgValue("style", style, ids) : style;
    });

    const rootAttrs = computed(() => {
      if (state.value.status !== "ready") return {};
      const out: Record<string, unknown> = {
        ...presentation.value?.attrs,
        ...svgDimensions(props),
      };
      if (props.id !== undefined) out.id = props.id;
      if (props.width !== undefined) out.width = props.width;
      if (props.height !== undefined) out.height = props.height;
      const viewBox = svgViewBox(state.value.content.attrs, props);
      if (viewBox !== undefined) out.viewBox = viewBox;
      if (props.fill !== undefined) out.fill = props.fill;
      if (props.stroke !== undefined) out.stroke = props.stroke;
      if (props.role !== undefined) out.role = props.role;
      if (props.ariaLabel !== undefined) {
        out["aria-label"] = props.ariaLabel;
        delete out["aria-labelledby"];
      }
      if (props.ariaHidden !== undefined) out["aria-hidden"] = props.ariaHidden;
      return rewriteSvgAttributes(out, presentation.value?.ids);
    });

    return (): unknown => {
      const current = state.value;
      if (current.status === "loading") {
        const slot = (slots as Record<string, Slot | undefined>).loading;
        if (slot) return slot();
        return null;
      }
      if (current.status === "error") {
        const slot = (slots as Record<string, Slot | undefined>).fallback;
        if (slot) return slot();
        return null;
      }
      return h("svg", {
        ...rootAttrs.value,
        ...rewriteSvgAttributes(attrs, presentation.value?.ids),
        class: mergedClass.value,
        style: mergedStyle.value,
        innerHTML: presentation.value?.innerHTML,
      });
    };
  },
});

export default SVG;
