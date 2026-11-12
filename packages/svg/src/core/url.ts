import {
  isTokenFunction,
  isTokenIdent,
  isTokenString,
  isTokenURL,
  isTokenWhiteSpaceOrComment,
  tokenize,
  TokenType,
} from "@csstools/css-tokenizer";

export const isInlineSvg = (source: string) => {
  const trimmed = source.trim();
  return (
    trimmed.startsWith("<svg") ||
    trimmed.startsWith("<?xml") ||
    /^(?:<!--|<!DOCTYPE\s)/i.test(trimmed)
  );
};

export const decodeDataUrl = (source: string) => {
  const match = source.match(/^data:image\/svg\+xml(?:;charset=[^;,]+)?(;base64)?,(.*)$/i);
  if (!match) return null;
  const isBase64 = Boolean(match[1]);
  const data = match[2] ?? "";
  try {
    if (isBase64) {
      if (typeof atob === "function") return atob(data);
      return null;
    }
    return decodeURIComponent(data);
  } catch {
    return null;
  }
};

const normalizeUrlTarget = (value: string) =>
  value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/[\p{Cc}\s]/gu, "");

const urlScheme = (normalized: string) =>
  normalized.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)?.[1]?.toLowerCase();

const isSameDocumentTarget = (normalized: string) => !normalized || normalized.startsWith("#");

export const isSafeUrl = (value: string) => {
  const normalized = normalizeUrlTarget(value);
  if (isSameDocumentTarget(normalized)) return true;
  if (normalized.startsWith("//")) return true;
  const scheme = urlScheme(normalized);
  if (!scheme) return true;
  if (scheme === "http" || scheme === "https" || scheme === "blob") return true;
  if (scheme === "data") return /^data:image\//i.test(normalized);
  return false;
};

export const isSameDocumentUrl = (value: string) => isSameDocumentTarget(normalizeUrlTarget(value));

export const isSafeHrefUrl = (value: string) => {
  const normalized = normalizeUrlTarget(value);
  if (urlScheme(normalized) === "data") return false;
  return isSafeUrl(value);
};

const dataImageUrlSubtype = (normalized: string) =>
  normalized.match(/^data:image\/([a-z0-9.+-]+)(?:[;,]|$)/i)?.[1]?.toLowerCase() ?? null;

export const isSafeResourceUrl = (value: string) => {
  const normalized = normalizeUrlTarget(value);
  if (isSameDocumentTarget(normalized)) return true;
  if (normalized.startsWith("//")) return true;
  const scheme = urlScheme(normalized);
  if (!scheme) return true;
  if (scheme === "http" || scheme === "https" || scheme === "blob") return true;
  if (scheme === "data") {
    const subtype = dataImageUrlSubtype(normalized);
    return subtype !== null && !subtype.startsWith("svg+xml");
  }
  return false;
};

export const hasUnsafeUrl = (value: string) => {
  let malformed = false;
  const tokens = tokenize(
    { css: value },
    {
      onParseError: () => {
        malformed = true;
      },
    },
  ).filter((token) => !isTokenWhiteSpaceOrComment(token));
  if (malformed) return true;
  for (const [index, token] of tokens.entries()) {
    if (token[0] === TokenType.BadURL || token[0] === TokenType.BadString) return true;
    if (isTokenURL(token) && !isSameDocumentUrl(token[4].value)) return true;
    if (
      isTokenIdent(token) &&
      token[4].value.toLowerCase() === "url" &&
      tokens[index + 1]?.[0] === TokenType.OpenParen
    )
      return true;
    if (!isTokenFunction(token)) continue;
    const name = token[4].value.toLowerCase();
    if (["image", "image-set", "-webkit-image-set", "src"].includes(name)) return true;
    if (name !== "url") continue;
    const target = tokens[index + 1];
    if (
      !isTokenString(target) ||
      tokens[index + 2]?.[0] !== TokenType.CloseParen ||
      !isSameDocumentUrl(target[4].value)
    )
      return true;
  }
  return false;
};
