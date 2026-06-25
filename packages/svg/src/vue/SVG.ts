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

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; content: ParsedSvg; markup: string };

type ParsedSvg = {
  attrs: Record<string, string>;
  className?: string;
  style?: string;
  innerHTML: string;
};

const svgCache = new Map<string, string>();

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
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
};

export { styleToText };

export const SVG = defineComponent({
  name: "SVG",
  props: {
    src: { type: String as PropType<string | undefined>, default: undefined },
    name: { type: [String, Number] as PropType<SvgNameInput | undefined>, default: undefined },
    fetchOptions: { type: Object as PropType<RequestInit | undefined>, default: undefined },
    cache: { type: Boolean, default: true },
    sanitize: { type: Boolean, default: true },
    onSvgLoad: {
      type: Function as PropType<((markup: string) => void) | undefined>,
      default: undefined,
    },
    onSvgError: {
      type: Function as PropType<((error: Error) => void) | undefined>,
      default: undefined,
    },
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
  setup(props, { slots, emit }) {
    const state = ref<State>({ status: "loading" });
    let controller: AbortController | null = null;

    const run = (source: string | undefined, name: SvgNameInput | undefined, doCache: boolean) => {
      const resolved = resolveSource(source, name);
      if (!resolved) {
        const err = new Error("Either name or src is required.");
        state.value = { status: "error" };
        emit("svg-error", err);
        props.onSvgError?.(err);
        return;
      }

      if (doCache && svgCache.has(resolved)) {
        const cached = svgCache.get(resolved) ?? "";
        const inline = ensureParsedSvg(resolved, cached, props.sanitize ?? true);
        if (inline) {
          const styleText = inline.style
            ? Object.entries(inline.style).map(([k, v]) => `${k}:${v}`).join(";")
            : undefined;
          const parsed: ParsedSvg = {
            attrs: inline.attrs,
            className: inline.className,
            style: styleText,
            innerHTML: inline.innerHTML,
          };
          state.value = { status: "ready", content: parsed, markup: cached };
          emit("svg-load", cached);
          props.onSvgLoad?.(cached);
          return;
        }
      }

      if (controller) controller.abort();
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
          const inline = ensureParsedSvg(resolved, markup, props.sanitize ?? true);
          if (!inline) throw new Error("SVG markup is invalid or unavailable in this environment.");
          const styleText = inline.style
            ? Object.entries(inline.style).map(([k, v]) => `${k}:${v}`).join(";")
            : undefined;
          const parsed: ParsedSvg = {
            attrs: inline.attrs,
            className: inline.className,
            style: styleText,
            innerHTML: inline.innerHTML,
          };
          if (doCache) svgCache.set(resolved, markup);
          state.value = { status: "ready", content: parsed, markup };
          emit("svg-load", markup);
          props.onSvgLoad?.(markup);
        })
        .catch((err) => {
          if (c.signal.aborted) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          const normalized = err instanceof Error ? err : new Error("Failed to load SVG.");
          state.value = { status: "error" };
          emit("svg-error", normalized);
          props.onSvgError?.(normalized);
        });
    };

    watch(
      () => [props.src, props.name, props.fetchOptions, props.cache, props.sanitize],
      () => {
        run(props.src, props.name as SvgNameInput | undefined, props.cache ?? true);
      },
      { immediate: true },
    );

    onBeforeUnmount(() => {
      if (controller) controller.abort();
    });

    const mergedClass = computed(() => {
      if (state.value.status !== "ready") return undefined;
      const parts: string[] = [];
      if (state.value.content.className) parts.push(state.value.content.className);
      if (props.class) parts.push(props.class);
      return parts.filter(Boolean).join(" ") || undefined;
    });

    const mergedStyle = computed(() => {
      if (state.value.status !== "ready") return styleToText(props.style as never);
      const parts: string[] = [];
      if (state.value.content.style) parts.push(state.value.content.style);
      const propStyle = styleToText(props.style as never);
      if (propStyle) parts.push(propStyle);
      return parts.filter(Boolean).join(";") || undefined;
    });

    const rootAttrs = computed(() => {
      if (state.value.status !== "ready") return {};
      const out: Record<string, unknown> = { ...state.value.content.attrs };
      if (props.width !== undefined) out.width = props.width;
      if (props.height !== undefined) out.height = props.height;
      if (props.viewBox !== undefined) out.viewBox = props.viewBox;
      else if (
        !state.value.content.attrs.viewBox &&
        (props.width !== undefined || props.height !== undefined)
      ) {
        out.viewBox = state.value.content.attrs.viewBox ?? "0 0 24 24";
      }
      if (props.fill !== undefined) out.fill = props.fill;
      if (props.stroke !== undefined) out.stroke = props.stroke;
      if (props.role !== undefined) out.role = props.role;
      if (props.ariaLabel !== undefined) out["aria-label"] = props.ariaLabel;
      if (props.ariaHidden !== undefined) out["aria-hidden"] = props.ariaHidden;
      return out;
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
        class: mergedClass.value,
        style: mergedStyle.value,
        innerHTML: current.content.innerHTML,
      });
    };
  },
});

export default SVG;
