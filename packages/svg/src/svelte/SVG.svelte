<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { createSvgController, type SvelteSvgProps, type SvgState } from "./runtime";
  import { rewriteSvgAttributes, rewriteSvgValue } from "../core/ids";
  import { withSvgColorOverrides } from "../core/colors";

  import { createSvgPresentation, svgDimensions, svgViewBox } from "../core/presentation";

  let {
    src,
    name,
    fetchOptions,
    cache = true,
    sanitize = true,
    uniqueIds = true,
    loading,
    fallback,
    onSvgLoad,
    onSvgError,
    class: className,
    style,
    size,
    title,
    desc,
    width,
    height,
    viewBox,
    fill,
    stroke,
    role,
    "aria-label": ariaLabel,
    "aria-hidden": ariaHidden,
  }: SvelteSvgProps = $props();

  const controller = createSvgController();
  const present = createSvgPresentation<string>();
  let state: SvgState = $state({ status: "loading" });

  $effect(() => {
    const props: SvelteSvgProps = {
      src,
      name,
      fetchOptions,
      cache,
      sanitize,
      uniqueIds,
      onSvgLoad: untrack(() => onSvgLoad),
      onSvgError: untrack(() => onSvgError),
    };
    controller.load(props, (next) => (state = next));
  });

  onDestroy(() => controller.abort());

  const mergedClass = $derived.by(() => {
    const parts: string[] = [];
    if (state.status === "ready" && state.content.className) parts.push(state.content.className);
    if (className) parts.push(className);
    return parts.filter(Boolean).join(" ");
  });

  const presentation = $derived(state.status === "ready" ? present(withSvgColorOverrides(state.content, { fill, stroke }), { title, desc }) : undefined);

  const mergedStyle = $derived.by(() => {
    const parts: string[] = [];
    if (presentation?.styleText) parts.push(presentation.styleText);
    if (style) parts.push(style);
    const merged = parts.filter(Boolean).join(";") || undefined;
    return merged && presentation?.ids ? rewriteSvgValue("style", merged, presentation.ids) : merged;
  });

  const rootAttrs = $derived.by(() => {
    if (state.status !== "ready") return {};
    const attrs: Record<string, string | number | boolean | undefined> = { ...presentation?.attrs, ...svgDimensions({ size, width, height }) };
    if (width !== undefined) attrs.width = width;
    if (height !== undefined) attrs.height = height;
    const viewport = svgViewBox(state.content.attrs, { size, width, height, viewBox });
    if (viewport !== undefined) attrs.viewBox = viewport;
    if (fill !== undefined) attrs.fill = fill;
    if (stroke !== undefined) attrs.stroke = stroke;
    if (role !== undefined) attrs.role = role;
    if (ariaLabel !== undefined) { attrs["aria-label"] = ariaLabel; delete attrs["aria-labelledby"]; }
    if (ariaHidden !== undefined) attrs["aria-hidden"] = ariaHidden;
    return rewriteSvgAttributes(attrs, state.content.ids);
  });
</script>

{#if state.status === "loading"}
  {#if loading}{@render loading()}{:else}{/if}
{:else if state.status === "error" || !state.content}
  {#if fallback}{@render fallback()}{:else}{/if}
{:else}
  <svg
    {...rootAttrs}
    class={mergedClass || undefined}
    style={mergedStyle}
  >{@html presentation?.innerHTML ?? ""}</svg>
{/if}
