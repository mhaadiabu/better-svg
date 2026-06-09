import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:http/http.dart' as http;

import 'resolver.dart';

class Svg extends StatefulWidget {
  const Svg({
    super.key,
    this.src,
    this.name,
    this.width,
    this.height,
    this.color,
    this.cache = true,
    this.sanitize = true,
    this.loading,
    this.fallback,
    this.placeholderBuilder,
    this.fetchHeaders,
    this.onSvgLoad,
    this.onSvgError,
    this.httpClient,
    this.localResolver,
    this.fit = BoxFit.contain,
    this.alignment = Alignment.center,
    this.matchTextDirection = false,
    this.allowDrawingOutsideViewBox = false,
  }) : assert(
          src != null || name != null,
          'Either src or name must be provided.',
        );

  final String? src;
  final String? name;
  final double? width;
  final double? height;
  final Color? color;
  final bool cache;
  final bool sanitize;
  final Widget? loading;
  final Widget? fallback;
  final Widget Function(BuildContext)? placeholderBuilder;
  final Map<String, String>? fetchHeaders;
  final void Function(String markup)? onSvgLoad;
  final void Function(Object error)? onSvgError;
  final http.Client? httpClient;
  final LocalSvgResolver? localResolver;
  final BoxFit fit;
  final AlignmentGeometry alignment;
  final bool matchTextDirection;
  final bool allowDrawingOutsideViewBox;

  @override
  State<Svg> createState() => _SvgState();
}

class _SvgState extends State<Svg> {
  late SvgResolver _resolver;
  String? _markup;
  Object? _error;
  bool _loading = true;
  int _requestId = 0;
  http.Client? _ownedClient;

  @override
  void initState() {
    super.initState();
    _resolver = SvgResolver(
      cache: widget.cache,
      localResolver: widget.localResolver,
      client: widget.httpClient,
    );
    _resolve();
  }

  @override
  void didUpdateWidget(covariant Svg oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.httpClient != oldWidget.httpClient) {
      _resolver.client = widget.httpClient ?? (_ownedClient ??= http.Client());
    }
    if (widget.cache != oldWidget.cache ||
        widget.localResolver != oldWidget.localResolver ||
        widget.src != oldWidget.src ||
        widget.name != oldWidget.name) {
      _resolver = SvgResolver(
        cache: widget.cache,
        localResolver: widget.localResolver,
        client: widget.httpClient ?? (_ownedClient ??= http.Client()),
      );
      _resolve();
    }
  }

  @override
  void dispose() {
    _ownedClient?.close();
    super.dispose();
  }

  Future<void> _resolve() async {
    final id = ++_requestId;
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
      _markup = null;
    });

    final resolved = _resolver.resolveSource(src: widget.src, name: widget.name);
    if (resolved == null || resolved.isEmpty) {
      final err = SvgException('Either name or src is required.');
      if (!mounted || id != _requestId) return;
      setState(() {
        _error = err;
        _loading = false;
      });
      widget.onSvgError?.call(err);
      return;
    }

    try {
      final markup = await _resolver.resolveMarkup(
        resolved,
        extraHeaders: widget.fetchHeaders,
      );
      if (!mounted || id != _requestId) return;
      setState(() {
        _markup = sanitizeForRender(markup, sanitize: widget.sanitize);
        _loading = false;
      });
      widget.onSvgLoad?.call(markup);
    } catch (e) {
      if (!mounted || id != _requestId) return;
      setState(() {
        _error = e;
        _loading = false;
      });
      widget.onSvgError?.call(e);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      final builder = widget.placeholderBuilder;
      if (builder != null) return builder(context);
      return widget.loading ?? const SizedBox.shrink();
    }
    if (_error != null || _markup == null) {
      return widget.fallback ?? const SizedBox.shrink();
    }

    final placeholder = widget.placeholderBuilder?.call(context);
    final color = widget.color;
    return SvgPicture.string(
      _markup!,
      width: widget.width,
      height: widget.height,
      fit: widget.fit,
      alignment: widget.alignment,
      matchTextDirection: widget.matchTextDirection,
      allowDrawingOutsideViewBox: widget.allowDrawingOutsideViewBox,
      colorFilter: color == null
          ? null
          : ui.ColorFilter.mode(color, ui.BlendMode.srcIn),
      placeholderBuilder: placeholder == null ? null : (_) => placeholder,
    );
  }
}

@visibleForTesting
class SvgStateSnapshot {
  SvgStateSnapshot({this.markup, this.error, this.loading = true});

  final String? markup;
  final Object? error;
  final bool loading;
}
