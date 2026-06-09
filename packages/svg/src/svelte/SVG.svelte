<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { createSvgController, type SvelteSvgProps, type SvgState } from "./runtime";

  let {
    src,
    name,
    fetchOptions,
    cache = true,
    sanitize = true,
    loading,
    fallback,
    onSvgLoad,
    onSvgError,
    class: className,
    style,
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
  let state: SvgState = $state({ status: "loading" });

  $effect(() => {
    const props: SvelteSvgProps = {
      src,
      name,
      fetchOptions,
      cache,
      sanitize,
      onSvgLoad,
      onSvgError,
    };
    untrack(() => controller.load(props, (next) => (state = next)));
  });

  onDestroy(() => controller.abort());

  const mergedClass = $derived.by(() => {
    const parts: string[] = [];
    if (state.status === "ready" && state.content.className) parts.push(state.content.className);
    if (className) parts.push(className);
    return parts.filter(Boolean).join(" ");
  });

  const mergedStyle = $derived.by(() => {
    const parts: string[] = [];
    if (state.status === "ready" && state.content.style) parts.push(state.content.style);
    if (style) parts.push(style);
    return parts.filter(Boolean).join(";") || undefined;
  });

  const rootAttrs = $derived.by(() => {
    if (state.status !== "ready") return {};
    const attrs: Record<string, string | number | undefined> = { ...state.content.attrs };
    if (width !== undefined) attrs.width = width;
    if (height !== undefined) attrs.height = height;
    if (viewBox !== undefined) attrs.viewBox = viewBox;
    else if (!state.content.attrs.viewBox && (width !== undefined || height !== undefined)) {
      attrs.viewBox = state.content.attrs.viewBox ?? "0 0 24 24";
    }
    if (fill !== undefined) attrs.fill = fill;
    if (stroke !== undefined) attrs.stroke = stroke;
    if (role !== undefined) attrs.role = role;
    if (ariaLabel !== undefined) attrs["aria-label"] = ariaLabel;
    if (ariaHidden !== undefined) attrs["aria-hidden"] = ariaHidden;
    return attrs;
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
  >{@html state.content.innerHTML}</svg>
{/if}
