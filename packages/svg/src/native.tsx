import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import {
  Svg,
  G,
  Path,
  Rect,
  Circle,
  Ellipse,
  Line,
  Polyline,
  Polygon,
  Text as SvgText,
  TSpan,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  ClipPath,
  Mask,
  Use,
  Symbol as SvgSymbol,
  Image as SvgImage,
} from "react-native-svg";
import {
  ensureParsedNode,
  resolveMarkup,
  resolveSource,
  type SvgAttribute,
  type SvgNameInput,
  type SvgNode,
} from "./core";

const TAG_MAP: Record<string, React.ComponentType<Record<string, unknown>>> = {
  svg: Svg as unknown as React.ComponentType<Record<string, unknown>>,
  g: G as unknown as React.ComponentType<Record<string, unknown>>,
  path: Path as unknown as React.ComponentType<Record<string, unknown>>,
  rect: Rect as unknown as React.ComponentType<Record<string, unknown>>,
  circle: Circle as unknown as React.ComponentType<Record<string, unknown>>,
  ellipse: Ellipse as unknown as React.ComponentType<Record<string, unknown>>,
  line: Line as unknown as React.ComponentType<Record<string, unknown>>,
  polyline: Polyline as unknown as React.ComponentType<Record<string, unknown>>,
  polygon: Polygon as unknown as React.ComponentType<Record<string, unknown>>,
  text: SvgText as unknown as React.ComponentType<Record<string, unknown>>,
  tspan: TSpan as unknown as React.ComponentType<Record<string, unknown>>,
  defs: Defs as unknown as React.ComponentType<Record<string, unknown>>,
  lineargradient: LinearGradient as unknown as React.ComponentType<Record<string, unknown>>,
  radialgradient: RadialGradient as unknown as React.ComponentType<Record<string, unknown>>,
  stop: Stop as unknown as React.ComponentType<Record<string, unknown>>,
  clippath: ClipPath as unknown as React.ComponentType<Record<string, unknown>>,
  mask: Mask as unknown as React.ComponentType<Record<string, unknown>>,
  use: Use as unknown as React.ComponentType<Record<string, unknown>>,
  symbol: SvgSymbol as unknown as React.ComponentType<Record<string, unknown>>,
  image: SvgImage as unknown as React.ComponentType<Record<string, unknown>>,
};

const NUMERIC_ATTRS = new Set([
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "width",
  "height",
  "stroke-width",
  "stroke-width",
  "stroke-miterlimit",
  "stroke-dashoffset",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "font-size",
  "offset",
  "fx",
  "fy",
  "fr",
  "gradientUnits",
  "gradientTransform",
  "rotate",
  "startOffset",
  "textLength",
  "lengthAdjust",
  "fontWeight",
  "scale",
  "k",
  "dx",
  "dy",
]);

const toCamelCase = (value: string) =>
  value.replace(/^-/, "").replace(/-([a-z])/g, (_, char) => char.toUpperCase());

const isNumericAttr = (name: string) => {
  const lower = name.toLowerCase();
  return NUMERIC_ATTRS.has(lower) || lower.startsWith("stroke-width");
};

const coerceNumeric = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === "") return value;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return value;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(trimmed)) return value;
  return parsed;
};

const buildProps = (attrs: SvgAttribute[]): Record<string, unknown> => {
  const props: Record<string, unknown> = {};
  for (const attr of attrs) {
    const name = attr.name;
    if (name === "class" || name === "style") continue;
    const lower = name.toLowerCase();
    let key: string;
    if (lower === "xlink:href" || lower === "href") {
      key = "href";
    } else if (lower.includes(":")) {
      key = name;
    } else {
      key = toCamelCase(name);
    }
    if (isNumericAttr(lower)) {
      props[key] = coerceNumeric(attr.value);
    } else {
      props[key] = attr.value;
    }
  }
  return props;
};

type StyleOverride = {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  color?: string;
};

const buildStyle = (
  attrs: SvgAttribute[],
  override: StyleOverride,
): Record<string, string | number> | undefined => {
  const styleAttr = attrs.find((a) => a.name === "style");
  const style: Record<string, string | number> = {};
  if (styleAttr) {
    for (const entry of styleAttr.value.split(";")) {
      const [rawProp, ...rawValue] = entry.split(":");
      if (!rawProp || rawValue.length === 0) continue;
      const prop = rawProp.trim();
      const value = rawValue.join(":").trim();
      if (!prop || !value) continue;
      const key = prop.startsWith("--") ? prop : toCamelCase(prop);
      style[key] = value;
    }
  }
  let applied = false;
  if (override.color) {
    style.color = override.color;
    applied = true;
  }
  if (override.fill) {
    style.fill = override.fill;
    applied = true;
  }
  if (override.stroke) {
    style.stroke = override.stroke;
    applied = true;
  }
  if (override.strokeWidth !== undefined) {
    style.strokeWidth = override.strokeWidth;
    applied = true;
  }
  return applied || Object.keys(style).length > 0 ? style : undefined;
};

const fillAttr = (attrs: SvgAttribute[], name: string): string | undefined =>
  attrs.find((a) => a.name === name)?.value;

const renderChildren = (children: SvgNode[], override: StyleOverride): React.ReactNode[] =>
  children.map((child, index) => renderNode(child, index, override));

const renderNode = (node: SvgNode, index: number, override: StyleOverride): React.ReactNode => {
  if (node.tag === "#text") {
    return <TSpan key={`t-${index}`}>{node.text ?? ""}</TSpan>;
  }
  const Component = TAG_MAP[node.tag.toLowerCase()];
  if (!Component) return null;
  const localOverride: StyleOverride = { ...override };
  if (fillAttr(node.attrs, "fill") === undefined && override.fill) {
    localOverride.fill = undefined;
  }
  if (fillAttr(node.attrs, "stroke") === undefined && override.stroke) {
    localOverride.stroke = undefined;
  }
  if (fillAttr(node.attrs, "stroke-width") === undefined && override.strokeWidth !== undefined) {
    localOverride.strokeWidth = undefined;
  }
  const props = buildProps(node.attrs);
  const style = buildStyle(node.attrs, localOverride);
  const merged = style ? { ...props, style } : props;
  return (
    <Component key={`${node.tag}-${index}`} {...merged}>
      {renderChildren(node.children, localOverride)}
    </Component>
  );
};

export const renderSvgNode = (
  root: SvgNode,
  override: StyleOverride,
  size?: { width?: number | string; height?: number | string },
): React.ReactNode => {
  if (root.tag.toLowerCase() !== "svg") return null;
  const props = buildProps(root.attrs);
  const style = buildStyle(root.attrs, override);
  const merged = style ? { ...props, style } : props;
  if (size?.width !== undefined) merged.width = size.width;
  if (size?.height !== undefined) merged.height = size.height;
  return (
    <Svg key="root" {...merged}>
      {renderChildren(root.children, override)}
    </Svg>
  );
};

type SvgSourceProps = { src: string; name?: never } | { name: SvgNameInput; src?: never };

export type NativeSvgProps = SvgSourceProps & {
  width?: number | string;
  height?: number | string;
  color?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  fetchOptions?: RequestInit;
  cache?: boolean;
  sanitize?: boolean;
  loading?: React.ReactNode;
  fallback?: React.ReactNode;
  onSvgLoad?: (markup: string) => void;
  onSvgError?: (error: Error) => void;
};

const svgCache = new Map<string, string>();

const fetchAvailable = () => typeof fetch === "function";

export const SVG = React.forwardRef<unknown, NativeSvgProps>(
  (
    {
      src,
      name,
      width,
      height,
      color,
      fill,
      stroke,
      strokeWidth,
      style,
      fetchOptions,
      cache = true,
      sanitize = true,
      loading,
      fallback,
      onSvgLoad,
      onSvgError,
    },
    _ref,
  ) => {
    const [content, setContent] = React.useState<SvgNode | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);

    const resolvedSource = React.useMemo(() => resolveSource(src, name), [name, src]);

    const onLoadRef = React.useRef(onSvgLoad);
    const onErrorRef = React.useRef(onSvgError);
    React.useEffect(() => {
      onLoadRef.current = onSvgLoad;
      onErrorRef.current = onSvgError;
    });

    React.useEffect(() => {
      let active = true;
      const controller = new AbortController();
      setIsLoading(true);
      setError(null);
      setContent(null);

      if (!resolvedSource) {
        const err = new Error("Either name or src is required.");
        setError(err);
        setIsLoading(false);
        onErrorRef.current?.(err);
        return () => {
          active = false;
          controller.abort();
        };
      }

      const finish = (markup: string) => {
        const parsed = ensureParsedNode(resolvedSource, markup, sanitize, cache);
        if (!parsed) {
          throw new Error("SVG markup is invalid.");
        }
        setContent(parsed);
        setIsLoading(false);
        onLoadRef.current?.(markup);
      };

      if (cache && svgCache.has(resolvedSource)) {
        try {
          finish(svgCache.get(resolvedSource) ?? "");
        } catch (err) {
          if (!active) return;
          const normalized = err instanceof Error ? err : new Error("Failed to load SVG.");
          setError(normalized);
          setIsLoading(false);
          onErrorRef.current?.(normalized);
        }
        return () => {
          active = false;
          controller.abort();
        };
      }

      if (!fetchAvailable()) {
        const err = new Error("Fetch is not available in this environment.");
        if (active) {
          setError(err);
          setIsLoading(false);
          onErrorRef.current?.(err);
        }
        return () => {
          active = false;
          controller.abort();
        };
      }

      resolveMarkup(resolvedSource, { fetchOptions, signal: controller.signal, cache })
        .then((markup) => {
          if (!active) return;
          if (cache) svgCache.set(resolvedSource, markup);
          finish(markup);
        })
        .catch((err) => {
          if (!active) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          const normalized = err instanceof Error ? err : new Error("Failed to load SVG.");
          setError(normalized);
          setIsLoading(false);
          onErrorRef.current?.(normalized);
        });

      return () => {
        active = false;
        controller.abort();
      };
    }, [resolvedSource, fetchOptions, cache, sanitize]);

    if (isLoading) {
      return loading ? <>{loading}</> : null;
    }

    if (error || !content) {
      return fallback ? <>{fallback}</> : null;
    }

    return (
      <View style={style}>
        {renderSvgNode(content, { color, fill, stroke, strokeWidth }, { width, height })}
      </View>
    );
  },
);

SVG.displayName = "SVG";
