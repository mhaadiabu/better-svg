import {
  createComponent,
  createEffect,
  createMemo,
  createSignal,
  mergeProps,
  onCleanup,
  splitProps,
  untrack,
  Show,
  type JSX,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import { withSvgRootId } from "../core/ids";
import { withSvgColorOverrides } from "../core/colors";
import {
  createWebSvgController,
  mergeSvgAttributes,
  type WebSvgOptions,
  type WebSvgState,
} from "../core/web";

import { createSvgPresentation, type SvgPresentation } from "../core/presentation";

export type SvgProps = Omit<
  JSX.SvgSVGAttributes<SVGSVGElement>,
  "children" | "innerHTML" | "ref" | "style"
> &
  WebSvgOptions &
  SvgPresentation & {
    style?: string;
    loading?: JSX.Element;
    fallback?: JSX.Element;
  };

export const SVG = (props: SvgProps): JSX.Element => {
  const [options, attributes] = splitProps(props, [
    "title",
    "desc",
    "size",
    "src",
    "name",
    "fetchOptions",
    "cache",
    "sanitize",
    "uniqueIds",
    "onSvgLoad",
    "onSvgError",
    "loading",
    "fallback",
  ]);
  const [state, setState] = createSignal<WebSvgState>({ status: "loading" });
  const controller = createWebSvgController();
  const present = createSvgPresentation();

  createEffect(() => {
    const request: WebSvgOptions = {
      src: options.src,
      name: options.name,
      fetchOptions: options.fetchOptions,
      cache: options.cache,
      sanitize: options.sanitize,
      uniqueIds: options.uniqueIds,
      onSvgLoad: (markup) => untrack(() => options.onSvgLoad?.(markup)),
      onSvgError: (error) => untrack(() => options.onSvgError?.(error)),
    };
    untrack(() => void controller.load(request, setState));
  });
  onCleanup(controller.abort);

  const ready = createMemo(() => {
    const current = state();
    return current.status === "ready" ? current.content : undefined;
  });
  return Show({
    get when() {
      return ready();
    },
    keyed: true,
    get fallback() {
      return state().status === "loading" ? options.loading : options.fallback;
    },
    children: (content: NonNullable<ReturnType<typeof ready>>) => {
      const presentation = createMemo(() =>
        present(
          withSvgRootId(
            withSvgColorOverrides(content, { fill: attributes.fill, stroke: attributes.stroke }),
            attributes.id,
          ),
          options,
        ),
      );
      return createComponent(
        Dynamic,
        mergeProps(
          () => ({
            ...attributes,
            ...mergeSvgAttributes(presentation(), { ...attributes, size: options.size }),
            innerHTML: presentation().innerHTML,
          }),
          { component: "svg" },
        ),
      );
    },
  });
};

export default SVG;
