# Plan 004: Fix Flutter sanitizer (discarded result + close-tag leak)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7e1b3b6..HEAD -- packages/flutter/lib/src/sanitize.dart packages/flutter/test/sanitize_test.dart`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-vitest-harness-core-tests.md (only for the principle of characterization tests; Flutter tests are Dart, not vitest)
- **Category**: correctness
- **Planned at**: commit `7e1b3b6`, 2026-06-23

## Why this matters

`sanitizeSvgMarkup` in `packages/flutter/lib/src/sanitize.dart` has two bugs
that defeat its purpose on any SVG with a dangerous element:

1. **Discarded replacement.** Lines 18-22 loop over dangerous tags and call
   `cleaned.replaceAll(open, '').replaceAll(close, '')` — but `cleaned` is
   declared `final` (line 14) and the result is thrown away. The dangerous
   open tags are **never removed**. The subsequent `sanitizeInside` does drop
   them via its own tag match (line 33), so open tags are partly caught
   there — but the explicit removal loop is dead code and misleading.
2. **Close-tag leak.** `sanitizeInside`'s regex
   `/<([a-zA-Z][a-zA-Z0-9:\-]*)\b([^>]*)>/g` only matches **open** tags. A
   `</script>` close tag passes through untouched. The existing test
   (`sanitize_test.dart:17`) asserts `output.contains('</script')` is false —
   **that assertion currently fails** if the test is run (the Dart toolchain
   is not in CI, so it silently isn't). This is the most concrete proof the
   sanitizer is broken.

## Current state

`packages/flutter/lib/src/sanitize.dart` (full, 69 lines):
```dart
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

  final cleaned = markup
      .replaceAll(RegExp(r'<\?xml[\s\S]*?\?>'), '')
      .replaceAll(RegExp(r'<!DOCTYPE[\s\S]*?>', caseSensitive: false), '');

  for (final tag in _dangerousTags) {
    final open = RegExp('<$tag\\b[^>]*>', caseSensitive: false);
    final close = RegExp('</$tag\\s*>', caseSensitive: false);
    cleaned.replaceAll(open, '').replaceAll(close, '');   // ← result discarded; cleaned is final
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
```

Existing test — `packages/flutter/test/sanitize_test.dart` (57 lines). The
first test (lines 6-20) asserts both `<script` and `</script` are absent. The
`</script` assertion fails today because of the close-tag leak.

Repo conventions:
- Dart/Flutter package, separate from the TS workspace (`pnpm-workspace.yaml`
  excludes `**/flutter`). No pnpm scripts for it.
- Flutter lints via `flutter_lints` (`pubspec.yaml` devDep). Tests run with
  `flutter test`.
- `pubspec.yaml` has `publish_to: none` — not published; but `README.md` and
  the root `README.md` document `svg_flutter` as a real package, so its
  sanitizer must actually work.

**Toolchain caveat:** `flutter` and `dart` are **not installed** in the
advisor's environment. The executor may or may not have them. See STOP
conditions — if the toolchain is absent, make the code + test edits anyway
and report "STOPPED: no flutter toolchain" so the reviewer verifies by
reading; do not skip the edits.

## Commands you will need

| Purpose       | Command                          | Expected on success |
|---------------|----------------------------------|---------------------|
| Flutter test  | `flutter test` (in `packages/flutter`) | all pass      |
| Flutter analyze | `flutter analyze` (in `packages/flutter`) | no issues   |

If `flutter` is not on PATH, both commands will fail with "command not found"
— that's a STOP condition, not a plan failure.

## Scope

**In scope** (the only files you should modify):
- `packages/flutter/lib/src/sanitize.dart` — fix the discarded replacement and the close-tag leak.
- `packages/flutter/test/sanitize_test.dart` — add regression cases for close tags and the discarded-replacement path.

**Out of scope** (do NOT touch):
- `packages/flutter/lib/src/url.dart` — `isSafeUrl`/`hasUnsafeUrl` are correct (mirror the TS core). Leave them.
- `packages/flutter/lib/src/resolver.dart`, `svg_widget.dart` — behavior unchanged.
- `packages/svg/**` — TS package; different plans.
- `pubspec.yaml` — no new deps.

## Git workflow

- Branch: `advisor/004-flutter-sanitizer`
- Commit: `fix(flutter): remove dangerous tags and their close tags in sanitizer`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Fix the discarded-replacement loop

In `packages/flutter/lib/src/sanitize.dart`, change `final cleaned` (line 14)
to a mutable variable and actually capture the replacement results. Replace
lines 14-22:

Current:
```dart
  final cleaned = markup
      .replaceAll(RegExp(r'<\?xml[\s\S]*?\?>'), '')
      .replaceAll(RegExp(r'<!DOCTYPE[\s\S]*?>', caseSensitive: false), '');

  for (final tag in _dangerousTags) {
    final open = RegExp('<$tag\\b[^>]*>', caseSensitive: false);
    final close = RegExp('</$tag\\s*>', caseSensitive: false);
    cleaned.replaceAll(open, '').replaceAll(close, '');
  }
```

New:
```dart
  var cleaned = markup
      .replaceAll(RegExp(r'<\?xml[\s\S]*?\?>'), '')
      .replaceAll(RegExp(r'<!DOCTYPE[\s\S]*?>', caseSensitive: false), '');

  for (final tag in _dangerousTags) {
    final open = RegExp('<$tag\\b[^>]*>', caseSensitive: false);
    final close = RegExp('</$tag\\s*>', caseSensitive: false);
    cleaned = cleaned.replaceAll(open, '').replaceAll(close, '');
  }
```

Two changes: `final` → `var`, and `cleaned = cleaned.replaceAll(...)`.

This single change fixes **both** bugs: the dangerous open tags are now
removed before `sanitizeInside` (so line 33's `if (_dangerousTags.contains...)`
becomes a redundant second defense — keep it, it's harmless), and the close
tags (`</script>`, `</iframe>`, etc.) are removed by the `close` regex. The
`sanitizeInside` regex never matched close tags, so this is the only place
they get stripped.

**Verify** (if flutter is available): `flutter test packages/flutter/test/sanitize_test.dart` → the existing `'</script'` assertion (line 17) now passes. If flutter is not available, skip to Step 3's verify note.

### Step 2: Add regression test cases for close tags

In `packages/flutter/test/sanitize_test.dart`, add tests inside the existing
`group('sanitizeSvgMarkup', ...)` (after the last test, before the closing `});`
of the group). Add:

```dart
    test('removes closing tags of dangerous elements', () {
      const input = '''
<svg xmlns="http://www.w3.org/2000/svg">
  <iframe src="https://example.com"></iframe>
  <foreignObject width="10" height="10"><div></div></foreignObject>
  <rect/>
</svg>
''';
      final output = sanitizeSvgMarkup(input);
      expect(output.contains('</iframe>'), isFalse);
      expect(output.contains('</foreignObject>'), isFalse);
      expect(output.contains('</script>'), isFalse);
    });

    test('does not strip safe closing tags', () {
      const input =
          '<svg xmlns="http://www.w3.org/2000/svg"><g><rect/></g></svg>';
      final output = sanitizeSvgMarkup(input);
      expect(output.contains('</g>'), isTrue);
      expect(output.contains('</svg>'), isTrue);
    });
```

Note: the existing `removes foreignObject and iframe` test (lines 36-48) uses a
self-closing `<iframe .../>` so it doesn't exercise the close-tag leak. The
new tests use explicit open+close pairs.

**Verify** (if flutter is available): `flutter test packages/flutter/test/sanitize_test.dart` → all pass, including the new ones.

### Step 3: Full verification

**Verify**:
- If `flutter` is installed: `flutter test` (in `packages/flutter`) → all pass. `flutter analyze` → no new issues.
- If `flutter` is **not** installed: report "STOPPED: no flutter toolchain" in the final report (see STOP conditions). Still confirm the edits are syntactically plausible by reading: `grep -n "var cleaned" packages/flutter/lib/src/sanitize.dart` → one match; `grep -n "cleaned = cleaned.replaceAll" packages/flutter/lib/src/sanitize.dart` → one match.
- Confirm no other files changed: `git status` → only `sanitize.dart` and `sanitize_test.dart`.

## Test plan

- Existing `sanitize_test.dart` first test (`</script` absent) — now passes.
- New: `removes closing tags of dangerous elements` — explicit close-tag regression.
- New: `does not strip safe closing tags` — guards against an over-broad fix that nukes all `</...>`.
- No changes to the `javascript:` href / style tests — those already pass (url.dart is correct).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "var cleaned" packages/flutter/lib/src/sanitize.dart` → one match (was `final`)
- [ ] `grep -n "cleaned = cleaned.replaceAll" packages/flutter/lib/src/sanitize.dart` → one match (assignment captured)
- [ ] `grep -c "test\(" packages/flutter/test/sanitize_test.dart` → at least 7 (was 5; +2 new)
- [ ] If `flutter` is available: `flutter test` (in `packages/flutter`) exits 0 with all tests passing
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated (mark DONE if tests pass; mark BLOCKED "no flutter toolchain — verified by reading" if not, with the grep proofs above)

## STOP conditions

Stop and report back (do not improvise) if:

- `flutter`/`dart` is not installed — make the edits, run the grep verifications,
  then report "STOPPED: no flutter toolchain" so the reviewer can verify by
  reading or run `flutter test` themselves. **Do not skip the code edits.**
- The existing test file's structure doesn't match the excerpt (e.g. the group
  name changed) — adapt the insertion point, but report the diff.
- After the fix, `flutter analyze` reports a lint error on `var cleaned`
  (e.g. `prefer_final`) — if so, the replacement genuinely mutates `cleaned`,
  so `var` is correct; suppress with `// ignore: prefer_final` if the linter
  can't see through the loop. Report it either way.

## Maintenance notes

- **`sanitizeInside` still has a redundant dangerous-tag check (line 33).**
  It's harmless (defense in depth) — leave it. Removing it would be a
  behavior-identical cleanup, not worth the risk in a sanitizer.
- **The regex sanitizer is inherently weaker than the TS DOM/AST sanitizers**
  (no tree structure). A future migration to an `xml` package parse would be
  stronger, but `publish_to: none` and the `flutter_svg` string-render path
  make regex pragmatic. Note for whoever next touches this.
- **Reviewer focus:** the `var cleaned` + `cleaned = cleaned.replaceAll`
  change is the entire fix. Read those two lines. Then confirm the new
  close-tag test would have failed before (it would: `</iframe>` survived)
  and passes after.
