import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'sanitize.dart';
import 'url.dart';

typedef LocalSvgResolver = String? Function(String name);

class SvgException implements Exception {
  SvgException(this.message);

  final String message;

  @override
  String toString() => 'SvgException: $message';
}

class SvgResolver {
  SvgResolver({
    this.cache = true,
    http.Client? client,
    this.localResolver,
    this.headers = const {'Accept': 'image/svg+xml'},
  }) : _injectedClient = client != null;

  final bool cache;
  final LocalSvgResolver? localResolver;
  final Map<String, String> headers;
  final bool _injectedClient;
  http.Client _client = http.Client();

  final Map<String, String> _cache = {};

  http.Client get client => _client;
  set client(http.Client value) {
    if (!_injectedClient) _client.close();
    _client = value;
  }

  void clearCache() => _cache.clear();

  String? resolveSource({String? src, String? name}) {
    if (name != null && name.isNotEmpty) {
      final resolved = localResolver?.call(name);
      if (resolved != null && resolved.isNotEmpty) return resolved;
      return 'assets/svg/$name.svg';
    }
    return src;
  }

  Future<String> resolveMarkup(
    String source, {
    Map<String, String>? extraHeaders,
  }) async {
    final trimmed = source.trim();
    if (trimmed.isEmpty) {
      throw SvgException('SVG src is required.');
    }
    if (isInlineSvg(trimmed)) return trimmed;
    final dataSvg = decodeDataUrl(trimmed);
    if (dataSvg != null) return dataSvg;

    if (cache && _cache.containsKey(source)) {
      return _cache[source]!;
    }

    final merged = <String, String>{...headers, ...?extraHeaders};
    final response = await _client.get(Uri.parse(source), headers: merged);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw SvgException(
        'Failed to fetch SVG: ${response.statusCode} ${response.reasonPhrase}',
      );
    }
    final body = utf8.decode(response.bodyBytes, allowMalformed: true);
    if (cache) _cache[source] = body;
    return body;
  }
}

String sanitizeForRender(String markup, {bool sanitize = true}) {
  if (!sanitize) return markup;
  return sanitizeSvgMarkup(markup);
}
