import 'url.dart';

const _dangerousTags = <String>{
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
};

String sanitizeSvgMarkup(String markup) {
  if (markup.isEmpty) return markup;

  var cleaned = markup
      .replaceAll(RegExp(r'<\?xml[\s\S]*?\?>'), '')
      .replaceAll(RegExp(r'<!DOCTYPE[\s\S]*?>', caseSensitive: false), '');

  for (final tag in _dangerousTags) {
    final open = RegExp('<$tag\\b[^>]*>', caseSensitive: false);
    final close = RegExp('</$tag\\s*>', caseSensitive: false);
    cleaned = cleaned.replaceAll(open, '').replaceAll(close, '');
  }

  final attributePattern = RegExp(
    r'([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|\'([^\']*)\'|([^\s"\'>]+))',
  );

  String sanitizeInside(String input) {
    return input.replaceAllMapped(RegExp(r'<([a-zA-Z][a-zA-Z0-9:\-]*)\b([^>]*)>'), (match) {
      final tag = match.group(1) ?? '';
      final attrsRaw = match.group(2) ?? '';
      final lower = tag.toLowerCase();
      if (_dangerousTags.contains(lower)) return '';
      final buffer = StringBuffer();
      buffer
        ..write('<')
        ..write(tag);
      for (final attr in attributePattern.allMatches(attrsRaw)) {
        final name = attr.group(1) ?? '';
        final value = attr.group(3) ?? attr.group(4) ?? attr.group(5) ?? '';
        final lowerName = name.toLowerCase();
        if (lowerName.startsWith('on')) continue;
        if (lowerName == 'style' && hasUnsafeUrl(value)) continue;
        if ((lowerName == 'href' || lowerName == 'xlink:href') && !isSafeUrl(value)) {
          continue;
        }
        final escaped = value
            .replaceAll('&', '&amp;')
            .replaceAll('"', '&quot;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');
        buffer
          ..write(' ')
          ..write(name)
          ..write('="')
          ..write(escaped)
          ..write('"');
      }
      if (RegExp(r'/\s*$').hasMatch(attrsRaw)) {
        buffer.write(' />');
      } else {
        buffer.write('>');
      }
      return buffer.toString();
    });
  }

  return sanitizeInside(cleaned);
}
