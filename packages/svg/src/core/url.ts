export const isInlineSvg = (source: string) => {
  const trimmed = source.trim();
  return trimmed.startsWith("<svg") || trimmed.startsWith("<?xml");
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

export const isSafeUrl = (value: string) => {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed || trimmed.startsWith("#")) return true;
  if (trimmed.startsWith("//")) return true;
  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!schemeMatch) return true;
  const scheme = schemeMatch[1];
  if (!scheme) return false;
  const normalized = scheme.toLowerCase();
  if (normalized === "http" || normalized === "https" || normalized === "blob") {
    return true;
  }
  if (normalized === "data") return /^data:image\//i.test(trimmed);
  return false;
};

export const hasUnsafeUrl = (value: string) => {
  const pattern = /url\(([^)]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    const raw = match[1]?.trim() ?? "";
    if (!isSafeUrl(raw)) return true;
  }
  return false;
};
