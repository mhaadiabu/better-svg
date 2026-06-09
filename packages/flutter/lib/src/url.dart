import 'dart:convert';

bool isInlineSvg(String source) {
  final t = source.trimLeft();
  return t.startsWith('<svg') || t.startsWith('<?xml');
}

String? decodeDataUrl(String source) {
  final match = RegExp(
    r'^data:image/svg\+xml(?:;charset=[^;,]+)?(;base64)?,(.*)$',
    caseSensitive: false,
  ).firstMatch(source);
  if (match == null) return null;
  final isBase64 = match.group(1) != null;
  final data = match.group(2) ?? '';
  try {
    if (isBase64) {
      return String.fromCharCodes(base64Decode(data));
    }
    return Uri.decodeComponent(data);
  } catch (_) {
    return null;
  }
}

bool isSafeUrl(String value) {
  final v = value.trim().replaceAll(RegExp(r"^['\"]|['\"]$"), '');
  if (v.isEmpty || v.startsWith('#')) return true;
  if (v.startsWith('//')) return true;
  final schemeMatch = RegExp(r'^([a-zA-Z][a-zA-Z0-9+.\-]*):').firstMatch(v);
  if (schemeMatch == null) return true;
  final scheme = schemeMatch.group(1)?.toLowerCase() ?? '';
  if (scheme == 'http' || scheme == 'https' || scheme == 'blob') return true;
  if (scheme == 'data') {
    return RegExp(r'^data:image/', caseSensitive: false).hasMatch(v);
  }
  return false;
}

bool hasUnsafeUrl(String value) {
  final pattern = RegExp(r'url\(([^)]+)\)', caseSensitive: false);
  for (final m in pattern.allMatches(value)) {
    final raw = (m.group(1) ?? '').trim();
    if (!isSafeUrl(raw)) return true;
  }
  return false;
}
