import { renderNode, type SvgNode } from "./ast.js";
import { inlineSvgFromNode, type ParsedInlineSvg } from "./sanitize.js";

let nextId = 0;
const instanceKey = Math.random().toString(36).slice(2);
const rootOverrides = new WeakMap<ParsedInlineSvg, { id: string; content: ParsedInlineSvg }>();
const contentIds = new WeakMap<ParsedInlineSvg, readonly string[]>();
const renderedChildren = new WeakMap<SvgNode, string>();

const decodeCssId = (value: string) =>
  value.replace(
    /\\([\da-f]{1,6})(?:\r\n|[\t\n\f\r ])?|\\([^\n\r\f])/gi,
    (_match, hex: string | undefined, character: string | undefined) => {
      if (!hex) return character ?? "";
      const point = Number.parseInt(hex, 16);
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : "\ufffd";
    },
  );

const escapeCssId = (value: string) => {
  if (!/^-?\d|[^\da-z_-]/i.test(value)) return value;
  return Array.from(value)
    .map((character, index) => {
      if (
        /[\da-z_-]/i.test(character) &&
        !(index === 0 && /\d/.test(character)) &&
        !(index === 1 && value[0] === "-" && /\d/.test(character))
      )
        return character;
      return `\\${character.codePointAt(0)?.toString(16)} `;
    })
    .join("");
};

export const createSvgId = () => `svg-${instanceKey}-${++nextId}`;

const idReferenceAttributes = new Set([
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-owns",
  "aria-flowto",
  "aria-activedescendant",
  "aria-details",
  "aria-errormessage",
]);

export const rewriteSvgValue = (name: string, value: string, ids: ReadonlyMap<string, string>) => {
  const lower = name.toLowerCase();
  if ((lower === "href" || lower === "xlink:href") && value.startsWith("#")) {
    return `#${ids.get(value.slice(1)) ?? value.slice(1)}`;
  }
  if (idReferenceAttributes.has(lower)) return value.replace(/\S+/g, (id) => ids.get(id) ?? id);
  if (lower === "begin" || lower === "end") {
    return value
      .split(";")
      .map((timing) => {
        const trimmed = timing.trimStart();
        const id = [...ids.keys()]
          .sort((a, b) => b.length - a.length)
          .find((id) => trimmed.startsWith(`${id}.`));
        return id ? timing.replace(id, ids.get(id) ?? id) : timing;
      })
      .join(";");
  }
  if (!value.includes("#")) return value;
  return value.replace(
    /url\(\s*(['"]?)#((?:\\[\da-f]{1,6}\s?|\\.|[^\s'"()\\])+)\1\s*\)/gi,
    (match, quote: string, id: string) => {
      const replacement = ids.get(decodeCssId(id));
      return replacement !== undefined
        ? `url(${quote}#${escapeCssId(replacement)}${quote})`
        : match;
    },
  );
};

const rewriteStylesheet = (css: string, ids: ReadonlyMap<string, string>) => {
  const rewritten = rewriteSvgValue("style", css, ids);
  return rewritten.replace(/([^{}]+)(?=\{)/g, (selector: string) => {
    if (selector.trimStart().startsWith("@")) return selector;
    return selector.replace(
      /\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#((?:\\[\da-f]{1,6}\s?|\\.|[\w-]|\P{ASCII})+)/giu,
      (match, id: string | undefined) => {
        if (!id) return match;
        const replacement = ids.get(decodeCssId(id));
        return replacement !== undefined ? `#${escapeCssId(replacement)}` : match;
      },
    );
  });
};

const rewriteNodeIds = (node: SvgNode, ids: ReadonlyMap<string, string>): SvgNode => {
  let attrs = node.attrs;
  for (const [index, attr] of node.attrs.entries()) {
    const { name, value } = attr;
    const next =
      name.toLowerCase() === "id" ? (ids.get(value) ?? value) : rewriteSvgValue(name, value, ids);
    if (next === value) continue;
    if (attrs === node.attrs) attrs = attrs.slice();
    attrs[index] = { name, value: next };
  }

  let children = node.children;
  const style = node.tag.toLowerCase() === "style";
  for (const [index, child] of node.children.entries()) {
    let next = child;
    if (style && child.tag === "#text") {
      const text = rewriteStylesheet(child.text ?? "", ids);
      if (text !== child.text) next = { ...child, text };
    } else {
      next = rewriteNodeIds(child, ids);
    }
    if (next === child) continue;
    if (children === node.children) children = children.slice();
    children[index] = next;
  }
  return attrs === node.attrs && children === node.children ? node : { ...node, attrs, children };
};

const collectIds = (root: SvgNode) => {
  const ids = new Set<string>();
  const collect = (node: SvgNode) => {
    for (const attr of node.attrs) {
      if (attr.name.toLowerCase() === "id") ids.add(attr.value);
    }
    node.children.forEach(collect);
  };
  collect(root);
  return [...ids];
};

const scopedIds = (names: readonly string[], prefix: string) => {
  const ids = new Map<string, string>();
  for (const name of names) ids.set(name, `${prefix}-${ids.size}`);
  return ids;
};

export const scopeSvgNodeIds = (root: SvgNode, prefix: string) => {
  const ids = scopedIds(collectIds(root), prefix);
  return { node: ids.size ? rewriteNodeIds(root, ids) : root, ids };
};

export const withSvgRootId = (
  content: ParsedInlineSvg,
  id: string | undefined,
): ParsedInlineSvg => {
  if (id === undefined) return content;
  const previousId = content.node.attrs.find((attr) => attr.name.toLowerCase() === "id")?.value;
  if (previousId === undefined || id === previousId) return content;
  const cached = rootOverrides.get(content);
  if (cached?.id === id) return cached.content;
  const parsed = inlineSvgFromNode(rewriteNodeIds(content.node, new Map([[previousId, id]])));
  if (content.ids)
    parsed.ids = new Map(
      Array.from(content.ids, ([original, scoped]) => [
        original,
        scoped === previousId ? id : scoped,
      ]),
    );
  else parsed.ids = new Map([[previousId, id]]);
  rootOverrides.set(content, { id, content: parsed });
  return parsed;
};

export const scopeParsedSvgIds = (content: ParsedInlineSvg, prefix: string): ParsedInlineSvg => {
  let names = contentIds.get(content);
  if (!names) {
    names = collectIds(content.node);
    contentIds.set(content, names);
  }
  if (!names.length) return content;

  const ids = scopedIds(names, prefix);
  const node = rewriteNodeIds(content.node, ids);
  const parsed = inlineSvgFromNode(node, () =>
    node.children
      .map((child, index) => {
        if (child !== content.node.children[index]) return renderNode(child);
        let markup = renderedChildren.get(child);
        if (markup === undefined) {
          markup = renderNode(child);
          renderedChildren.set(child, markup);
        }
        return markup;
      })
      .join(""),
  );
  parsed.ids = ids;
  return parsed;
};

export const rewriteSvgAttributes = <T extends object>(
  attributes: T,
  ids?: ReadonlyMap<string, string>,
): T => {
  if (!ids?.size) return attributes;
  return Object.fromEntries(
    Object.entries(attributes).map(([name, value]) => {
      if (typeof value === "string") return [name, rewriteSvgValue(name, value, ids)];
      if (name === "style" && value && typeof value === "object")
        return [name, rewriteSvgAttributes(value, ids)];
      return [name, value];
    }),
  ) as T;
};
