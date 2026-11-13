export type CatalogLiteral = {
  value: string;
  index: number;
  explicit: boolean;
};

const voidTags = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

export const catalogLiterals = (source: string, extension: string): CatalogLiteral[] => {
  const literals: CatalogLiteral[] = [];
  const text =
    extension === "mdx"
      ? source.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1[^\n]*$/gm, (block) =>
          block.replace(/[^\n]/g, " "),
        )
      : source;

  const record = (value: string, index: number, explicit: boolean) => {
    if (
      /^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9._-]*$/.test(value) ||
      /^[a-z0-9][a-z0-9-]*:[a-z0-9._-]*\$\{/.test(value)
    ) {
      literals.push({ value, index, explicit });
    }
  };

  const quotedEnd = (start: number, limit: number, explicit: boolean, collect: boolean) => {
    const quote = text[start];
    let position = start + 1;
    while (position < limit) {
      if (text[position] === "\\") {
        position += 2;
        continue;
      }
      if (text[position] === quote) {
        if (collect) record(text.slice(start + 1, position), start, explicit);
        return position + 1;
      }
      if (quote === "`" && text.startsWith("${", position)) {
        position = scanCode(position + 2, limit, true, explicit);
        continue;
      }
      position++;
    }
    return limit;
  };

  const scanTag = (start: number, limit: number) => {
    const head = /^<(\/?)([a-zA-Z][\w.:-]*|(?=>))/.exec(text.slice(start));
    if (!head) return undefined;
    const name = head[2] ?? "";
    const iconElement = /^[A-Z]/.test(name) || name === "svg" || name.includes("-");
    const closing = head[1] === "/";
    let position = start + head[0].length;
    while (position < limit) {
      if (/\s/.test(text[position] ?? "")) {
        position++;
        continue;
      }
      if (text.startsWith("/>", position))
        return { end: position + 2, name, closing, selfClosing: true };
      if (text[position] === ">")
        return { end: position + 1, name, closing, selfClosing: voidTags.has(name.toLowerCase()) };
      if (text[position] === "{") {
        position = scanCode(position + 1, limit, true);
        continue;
      }
      const attribute = /^[^\s=/>]+/.exec(text.slice(position))?.[0];
      if (!attribute) {
        position++;
        continue;
      }
      position += attribute.length;
      while (/\s/.test(text[position] ?? "")) position++;
      if (text[position] !== "=") continue;
      position++;
      while (/\s/.test(text[position] ?? "")) position++;
      const explicit =
        iconElement && ["name", ":name", "v-bind:name", "[name]"].includes(attribute);
      const before = literals.length;
      const quote = text[position];
      if (quote === '"' || quote === "'") {
        const end = quotedEnd(position, limit, explicit, explicit && attribute === "name");
        if (explicit && attribute !== "name") scanCode(position + 1, end - 1, false, true);
        position = end;
      } else if (quote === "{") {
        position = scanCode(position + 1, limit, true, explicit);
      } else {
        const value = /^[^\s>]+/.exec(text.slice(position))?.[0] ?? "";
        if (explicit) record(value, position, true);
        position += Math.max(1, value.length);
      }
      if (
        /^(?:class(?:Name|:.*)?|style|code)$/.test(attribute) ||
        (!iconElement && attribute === "name")
      )
        literals.length = before;
    }
    return { end: limit, name, closing, selfClosing: true };
  };

  const scanMarkup = (start: number, limit: number, rootName?: string): number => {
    let position = start;
    let depth = 0;
    while (position < limit) {
      if (text.startsWith("<!--", position)) {
        const end = text.indexOf("-->", position + 4);
        position = end < 0 ? limit : end + 3;
      } else if (text[position] === "{") {
        position = scanCode(position + 1, limit, true);
      } else if (text[position] === "`") {
        const marker = /^`+/.exec(text.slice(position))?.[0] ?? "`";
        const end = text.indexOf(marker, position + marker.length);
        position = end < 0 ? position + marker.length : end + marker.length;
      } else if (text[position] === "<") {
        const tag = scanTag(position, limit);
        if (!tag) {
          position++;
          continue;
        }
        position = tag.end;
        if (!tag.closing && ["script", "style", "pre", "code"].includes(tag.name.toLowerCase())) {
          const end = text.indexOf(`</${tag.name}`, position);
          if (tag.name.toLowerCase() === "script") scanCode(position, end < 0 ? limit : end);
          position = end < 0 ? limit : end;
        }
        if (rootName !== undefined && tag.name === rootName) {
          if (tag.closing) depth--;
          else if (!tag.selfClosing) depth++;
          if (depth === 0) return position;
        }
      } else position++;
    }
    return position;
  };

  const scanCode = (start: number, limit: number, expression = false, explicit = false): number => {
    let position = start;
    let depth = expression ? 1 : 0;
    while (position < limit) {
      if (text.startsWith("//", position)) {
        const end = text.indexOf("\n", position + 2);
        position = end < 0 ? limit : end + 1;
      } else if (text.startsWith("/*", position)) {
        const end = text.indexOf("*/", position + 2);
        position = end < 0 ? limit : end + 2;
      } else if (['"', "'", "`"].includes(text[position] ?? "")) {
        const importing = /\b(?:from|import)\s*(?:\(\s*)?$/.test(
          text.slice(Math.max(start, position - 80), position),
        );
        position = quotedEnd(position, limit, explicit, !importing);
      } else if (
        text[position] === "<" &&
        /^(?:tsx|jsx|js|mjs|astro|vue|svelte|html|mdx)$/.test(extension)
      ) {
        const name = /^<([a-zA-Z][\w.:-]*|(?=>))/.exec(text.slice(position))?.[1];
        if (
          name !== undefined &&
          (/^<[^>]*\/>/.test(text.slice(position)) || text.indexOf(`</${name}`, position) >= 0)
        ) {
          position = scanMarkup(position, limit, name);
        } else position++;
      } else {
        if (expression && text[position] === "{") depth++;
        if (expression && text[position] === "}" && --depth === 0) return position + 1;
        position++;
      }
    }
    return position;
  };

  if (["astro", "vue", "svelte", "html", "mdx"].includes(extension)) {
    const frontmatter = extension === "astro" ? /^---\r?\n[\s\S]*?\r?\n---/.exec(text) : undefined;
    if (frontmatter) scanCode(4, frontmatter[0].length - 3);
    scanMarkup(frontmatter?.[0].length ?? 0, text.length);
  } else scanCode(0, text.length);
  return literals;
};
