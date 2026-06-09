import 'package:flutter_test/flutter_test.dart';
import 'package:svg_flutter/svg_flutter.dart';

void main() {
  group('sanitizeSvgMarkup', () {
    test('strips script tags and event handlers', () {
      const input = '''
<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
  <script>alert('xss')</script>
  <g onclick="hack()">
    <rect x="0" y="0" width="10" height="10"/>
  </g>
</svg>
''';
      final output = sanitizeSvgMarkup(input);
      expect(output.contains('<script'), isFalse);
      expect(output.contains('</script'), isFalse);
      expect(output.contains('onload'), isFalse);
      expect(output.contains('onclick'), isFalse);
    });

    test('drops unsafe href schemes', () {
      const input =
          '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a></svg>';
      final output = sanitizeSvgMarkup(input);
      expect(output.contains('javascript:'), isFalse);
    });

    test('keeps safe http and relative hrefs', () {
      const input =
          '<svg xmlns="http://www.w3.org/2000/svg"><a href="https://example.com"><rect/></a></svg>';
      final output = sanitizeSvgMarkup(input);
      expect(output.contains('https://example.com'), isTrue);
    });

    test('removes foreignObject and iframe', () {
      const input = '''
<svg xmlns="http://www.w3.org/2000/svg">
  <foreignObject width="10" height="10"><div/></foreignObject>
  <iframe src="https://example.com"/>
  <rect/>
</svg>
''';
      final output = sanitizeSvgMarkup(input);
      expect(output.contains('foreignObject'), isFalse);
      expect(output.contains('iframe'), isFalse);
      expect(output.contains('<rect'), isTrue);
    });

    test('drops style attributes with javascript urls', () {
      const input =
          '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url(javascript:alert(1))"/></svg>';
      final output = sanitizeSvgMarkup(input);
      expect(output.contains('javascript:'), isFalse);
    });
  });
}
