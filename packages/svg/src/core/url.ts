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
  const pattern = /url\s*\(([^)]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    if (!isSameDocumentUrl(match[1] ?? "")) return true;
  }
  return false;
};
