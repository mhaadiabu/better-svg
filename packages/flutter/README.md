# svg_flutter

Inline SVG rendering for Flutter. Mirrors the API of `@mhaadi/svg` (React, React Native, Vue, Svelte):

- Local SVG lookup by name
- Remote SVG fetching with cache
- Inline SVG strings and `data:` URLs
- Optional sanitization (strips `<script>`, `<foreignObject>`, `<iframe>`, event handlers, and unsafe URLs)
- Loading and fallback widgets
- `onSvgLoad` / `onSvgError` callbacks

## Install

Add to `pubspec.yaml`:

```yaml
dependencies:
  svg_flutter: ^0.1.0
  flutter_svg: ^2.0.10
```

## Usage

```dart
import 'package:svg_flutter/svg_flutter.dart';

Svg(
  src: 'https://cdn.example.com/icon.svg',
  width: 24,
  height: 24,
  color: const Color(0xFF111827),
)

Svg(name: 'logo', width: 24, height: 24)
```

## API

| Prop | Type | Description |
| --- | --- | --- |
| `src` | `String?` | Inline SVG, `data:` URL, or remote URL |
| `name` | `String?` | Resolve a local SVG by name |
| `width` | `double?` | Render width |
| `height` | `double?` | Render height |
| `color` | `Color?` | Override `currentColor` |
| `cache` | `bool` (default `true`) | Cache remote SVG markup in memory |
| `sanitize` | `bool` (default `true`) | Remove unsafe SVG content before rendering |
| `loading` | `Widget?` | Render while loading or parsing |
| `fallback` | `Widget?` | Render when loading fails |
| `placeholderBuilder` | `Widget Function(BuildContext)?` | Alias for `loading` |
| `fetchHeaders` | `Map<String, String>?` | Headers passed to the fetch client |
| `onSvgLoad` | `void Function(String)?` | Called with the resolved markup |
| `onSvgError` | `void Function(Object)?` | Called on fetch or parse failure |
| `httpClient` | `http.Client?` | Inject a custom HTTP client (testing) |
| `localResolver` | `String? Function(String)?` | Resolve a `name` to a URL or inline string |
