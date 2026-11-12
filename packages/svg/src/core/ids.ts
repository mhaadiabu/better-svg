import type { SvgNode } from "./ast.js";
import { inlineSvgFromNode, type ParsedInlineSvg } from "./sanitize.js";

let nextId = 0;
const instanceKey = Math.random().toString(36).slice(2);
const rootOverrides = new WeakMap<ParsedInlineSvg, { id: string; content: ParsedInlineSvg }>();

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

const escapeCssId = (value: string) =>
  Array.from(value)
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

export const createSvgId = () => `svg-${instanceKey}-${++nextId}`;

export const rewriteSvgValue = (name: string, value: string, ids: ReadonlyMap<string, string>) => {
  const lower = name.toLowerCase();
  if ((lower === "href" || lower === "xlink:href") && value.startsWith("#")) {
    return `#${ids.get(value.slice(1)) ?? value.slice(1)}`;
  }
  if (
    [
      "aria-labelledby",
      "aria-describedby",
      "aria-controls",
      "aria-owns",
      "aria-flowto",
      "aria-activedescendant",
      "aria-details",
      "aria-errormessage",
    ].includes(lower)
  ) {
    return value.replace(/\S+/g, (id) => ids.get(id) ?? id);
  }
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

const rewriteNodeIds = (node: SvgNode, ids: ReadonlyMap<string, string>): SvgNode => ({
  ...node,
  attrs: node.attrs.map(({ name, value }) => ({
    name,
    value:
      name.toLowerCase() === "id" ? (ids.get(value) ?? value) : rewriteSvgValue(name, value, ids),
  })),
  children: node.children.map((child) =>
    node.tag.toLowerCase() === "style" && child.tag === "#text"
      ? { ...child, text: rewriteStylesheet(child.text ?? "", ids) }
      : rewriteNodeIds(child, ids),
  ),
});

export const scopeSvgNodeIds = (root: SvgNode, prefix: string) => {
  const ids = new Map<string, string>();
  const collect = (node: SvgNode) => {
    for (const attr of node.attrs) {
      if (attr.name.toLowerCase() === "id" && !ids.has(attr.value)) {
        ids.set(attr.value, `${prefix}-${ids.size}`);
      }
    }
    node.children.forEach(collect);
  };
  collect(root);
  if (!ids.size) return { node: root, ids };

  return { node: rewriteNodeIds(root, ids), ids };
};

export const withSvgRootId = (
  content: ParsedInlineSvg,
  id: string | undefined,
): ParsedInlineSvg => {
  const previousId = content.node.attrs.find((attr) => attr.name.toLowerCase() === "id")?.value;
  if (id === undefined || previousId === undefined || id === previousId) return content;
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
  const { node, ids } = scopeSvgNodeIds(content.node, prefix);
  if (!ids.size) return content;
  const parsed = inlineSvgFromNode(node);
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
