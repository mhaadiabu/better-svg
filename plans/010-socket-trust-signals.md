# Plan 010: Restore Socket/npm trust signals and ship 0.2.3

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9af3c16..HEAD -- packages/svg/package.json packages/svg/README.md LICENSE .github/workflows/deploy.yml`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent of plan 009)
- **Category**: dx, docs, packaging, security-posture
- **Planned at**: commit `9af3c16`, 2026-06-25

## Why this matters

`@mhaadi/svg`'s Socket quality score dropped from 100 (0.2.1) to 85 (0.2.2)
with no code change — the only diff between those releases was
`packages/svg/package.json` (version bump) and `packages/svg/README.md`
(shrunk from 131 lines to 46, all redirected to the docs site). That drop
came from signals Socket and npm-score tools weight heavily:

1. **No `LICENSE` in the published tarball.** `files: ["dist"]` excludes
   the repo-root `LICENSE`, so the 0.2.2 tarball has none. `npm view
   @mhaadi/svg license` returns empty; npm falls back to `"Proprietary"`,
   a hard trust-signal loss.
2. **README trimmed to a redirect.** 0.2.1's README had a Security
   section, a prop table, an install section, and a subpath table. 0.2.2's
   has one line of install + one line of "see docs site" + one line of
   "sanitization is on by default." Socket's static analyzer cannot
   follow external links; the in-package docs signals (security posture,
   API surface, install path) all score zero.
3. **No `repository`/`homepage`/`bugs` fields** in `package.json`. These
   are routine Socket/npm heuristics.
4. **No `engines.node`.** Compatibility signal.
5. **No `keywords`.** Discoverability/category signal.
6. **`devDependencies` are visible on the registry** (vitest, happy-dom,
   svelte compiler, vue, etc.) even though `files: ["dist"]` excludes
   them from the tarball. The metadata still reads as a kit, not a
   consumer package.

This plan restores all six signals with a metadata-only change. No source
code, no behavior change, no breaking change. It also bumps to 0.2.3 per
the repo's release rules in `AGENTS.md` (any package-source change ships
with a version bump + changelog + tag). A `CHANGELOG.md` is added (AGENTS.md
says: "Update `CHANGELOG.md` (add one if missing) under a new versioned
heading"). Plan 009 ships as 0.2.3 in the same release; this plan
documents 0.2.3 in the changelog and tags the release.

## Current state

- `packages/svg/package.json` — current contents (excerpted):
  ```json
  {
    "name": "@mhaadi/svg",
    "version": "0.2.2",
    "description": "Inline SVG rendering for React, React Native, Vue, and Svelte.",
    "files": ["dist"],
    "type": "module",
    "sideEffects": false,
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "svelte": "./dist/svelte/SVG.svelte",
    "exports": { ... 6 subpath entries ... },
    "publishConfig": { "access": "public" },
    "scripts": { ... },
    "devDependencies": { ... },
    "peerDependencies": { "react": ">=18", "react-dom": ">=18" },
    "peerDependenciesMeta": { ... }
  }
  ```
  No `license`, `repository`, `homepage`, `bugs`, `engines`, `keywords`,
  `funding` fields.

- `packages/svg/README.md` — 46 lines, all of which link out to
  `https://svg.mhaadi.dev/...`. No Security section, no prop table, no
  subpath table, no install steps beyond the one `pnpm add` line.

- `LICENSE` — exists at the repo root (`/home/haadi/Desktop/Code/better-svg/LICENSE`,
  MIT, copyright "Mohammed Haadi Abubakar 2026"). Not inside `packages/svg/`.

- `packages/svg/CHANGELOG.md` — does not exist. AGENTS.md instructs: "add
  one if missing" for `@mhaadi/svg`. (`packages/flutter/CHANGELOG.md`
  exists as the format exemplar.)

- `npm view @mhaadi/svg` confirms: `license: <empty>`, `homepage: <empty>`,
  `repository: <empty>`, `bugs: <empty>`, `engines: <empty>`. The 0.2.2
  tarball is 112.8 kB unpacked, no LICENSE file, no `README.md` file
  (because `files: ["dist"]` excludes both).

- `AGENTS.md` "Releases & versioning" rules: bump version, update
  `CHANGELOG.md`, tag the merge commit. Tags are the release trigger
  (`git tag @mhaadi/svg@<version>`). The current tags are `v0.2.0` and
  `v0.2.1` (the maintainer tagged `v` prefix historically; 0.2.2 was
  not tagged — likely an oversight). Plan 010 uses the AGENTS.md-mandated
  `@mhaadi/svg@<version>` form for the new tag.

Repo conventions:
- License: MIT (per `LICENSE`).
- Repo URL: inferred from `git remote` — STOP and report if not
  `https://github.com/mhaadiabu/better-svg` (or the maintainer's actual
  public repo). If the remote is private or missing, the `repository`
  field still helps if the maintainer runs `npm publish` from CI with
  the correct remote configured.
- `AGENTS.md` says no comments in source. `package.json` has no comment
  style; use plain JSON.
- Conventional commit style: `<type>(<scope>): <imperative summary>`.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `pnpm install`                   | exit 0              |
| Typecheck | `pnpm check-types`               | exit 0              |
| Lint      | `pnpm lint`                      | no new errors       |
| Test      | `pnpm -F @mhaadi/svg test`       | all pass            |
| Build     | `pnpm -F @mhaadi/svg build`      | exit 0              |
| Pack dry  | `cd packages/svg && npm pack --dry-run` | lists files in tarball; expect LICENSE, README.md, dist/ |
| Pack      | `cd packages/svg && npm pack`    | produces `.tgz`; check contents |
| Tag       | `git tag @mhaadi/svg@0.2.3`      | exit 0 |
| Push tag  | `git push origin @mhaadi/svg@0.2.3` | exit 0; **do not run unless explicitly asked** |

## Scope

**In scope** (the only files you should modify or create):
- `packages/svg/package.json` — add `license`, `repository`, `homepage`,
  `bugs`, `engines`, `keywords`, `funding`, `sideEffects` is already set;
  verify the rest. Bump `version` to `0.2.3`. Add `files` entry for
  `LICENSE` and `README.md` (currently excluded by `files: ["dist"]`).
- `packages/svg/README.md` — restore Security section, prop table, subpath
  table, install steps, while keeping the docs-site link for the full
  reference. Match the 0.2.1 README's structure (which scored 100).
- `packages/svg/LICENSE` — **create.** Copy from the repo-root `LICENSE`
  (MIT, copyright "Mohammed Haadi Abubakar 2026"). The package needs its
  own copy because `files: ["dist"]` excludes the root one; npm
  recommends per-package LICENSE.
- `packages/svg/CHANGELOG.md` — **create.** Match the structure of
  `packages/flutter/CHANGELOG.md`. Add a 0.2.3 entry that covers BOTH
  plan 009 (parsed cache) and plan 010 (this plan's packaging fixes).
- `.github/workflows/deploy.yml` — no required changes; review-only.
  Optional: add `pnpm -F @mhaadi/svg build && npm view` step in CI for
  future releases — explicitly out of scope, deferred.

**Out of scope** (do NOT touch):
- `LICENSE` (repo root) — keep as is. The package gets its own copy.
- `packages/svg/src/**` — no source changes. This plan is metadata/docs
  only. (If plan 009's source changes need to ride the same release,
  they do — the changelog covers both, but the source edits live in
  plan 009's branch/commit, not this one.)
- `packages/svg/dist/**` — gitignored. Built by `pnpm build`.
- `apps/web/**` — no changes.
- `packages/flutter/**` — separate package, separate release cadence.
- `package.json` (root) — no changes.
- `turbo.json` — no changes.
- The actual `git push` and `npm publish` — the executor is not
  authorized to publish or push. The plan stops at the local tag and
  surfaces the publish step to the operator.
- `npm view @mhaadi/svg` queries against the live registry — the
  executor has no auth for publish. Pack dry-run and pack are local
  only.

## Git workflow

- Branch: `advisor/010-socket-trust-signals`
- Suggested commits (in order):
  1. `docs(svg): restore security, prop, and subpath sections to README`
  2. `chore(svg): add MIT LICENSE copy to packages/svg`
  3. `chore(svg): add repository, homepage, bugs, engines, keywords metadata`
  4. `chore(svg): add CHANGELOG.md and bump to 0.2.3`
- Tag at the merge commit: `git tag @mhaadi/svg@0.2.3` (per AGENTS.md
  release rules). Do not push or publish unless explicitly asked.
- Do not open a PR automatically; the operator drives releases.

## Steps

### Step 1: Add `packages/svg/LICENSE`

Copy the repo-root `LICENSE` verbatim to `packages/svg/LICENSE`. Do not
modify the content. The license is MIT; the copyright line is
"Copyright (c) 2026 Mohammed Haadi Abubakar".

```bash
cp /home/haadi/Desktop/Code/better-svg/LICENSE /home/haadi/Desktop/Code/better-svg/packages/svg/LICENSE
```

**Verify**:
- `diff /home/haadi/Desktop/Code/better-svg/LICENSE /home/haadi/Desktop/Code/better-svg/packages/svg/LICENSE` → no output.
- `head -3 /home/haadi/Desktop/Code/better-svg/packages/svg/LICENSE` → starts with "MIT License".

### Step 2: Add `packages/svg/CHANGELOG.md`

Create `packages/svg/CHANGELOG.md` matching `packages/flutter/CHANGELOG.md`'s
format. Include the prior 0.2.x releases as inferred from git tags
(`v0.2.0`, `v0.2.1`) for completeness, then 0.2.2, then 0.2.3. If
historical entries are not reliably reconstructable from the commit log
(use `git log --oneline v0.2.1..v0.2.0 -- packages/svg/` to find the
0.2.0→0.2.1 diff), keep historical entries brief and note "see git log":

```markdown
# Changelog

## 0.2.3

- Fix: cache the parsed SVG (not just the markup) so a cache hit skips `DOMParser` and a re-mount with a new `fetchOptions` identity does not re-parse. Applies to React, React Native, Vue, and Svelte adapters.
- Fix: Svelte adapter no longer tracks `onSvgLoad`/`onSvgError` in its `$effect`, so inline callbacks no longer cause refetch + reparse.
- Docs: restore Security section, props table, subpath table, and install steps in the package README.
- Packaging: add `LICENSE` (MIT), `repository`/`homepage`/`bugs`/`engines`/`keywords`/`funding` fields to `package.json` for npm and Socket trust signals.

## 0.2.2

- Docs: trim the package README to link to the docs site.

## 0.2.1

- Fix: isolate Vite glob in `/vite` entry to unblock React Native.

## 0.2.0

- Initial public release.
```

If the historical entries for 0.2.0/0.2.1 are not accurately recallable
from the commit log, replace their bullets with `see git log for
0.2.0...0.2.1`. The 0.2.3 entry must be specific (it's the entry that
ships with the release).

**Verify**: `cat packages/svg/CHANGELOG.md` → four headings, the 0.2.3
entry references "parsed SVG" or "DOMParser" and "Svelte" and
"README".

### Step 3: Restore `packages/svg/README.md`

The 0.2.1 README scored 100. Restore its structure: install, subpath
table, Security section, prop table. Keep the "Full docs" link at the
top to drive traffic to the docs site (the 0.2.2 link was the only
useful thing about it). Match the 0.2.1 structure as a starting point;
update the prop table to reflect the current API (plan 006 added the
latest-ref pattern; plan 009 adds parsed cache — both are internal
implementation details, not new public props, so the prop table does
not change).

Recover the 0.2.1 README from git:

```bash
git show 3ecf95c^:packages/svg/README.md
```

Use that as the base. Adjust if any prop names/types changed in 0.2.2
(none should have — the 0.2.1→0.2.2 commit was README + version only).

The restored README must include at minimum:
- H1 with the package name
- One-line description
- "Full docs" link
- `## Install` with the `pnpm add` line
- `## Quick start` with a React example (the current README's example is
  fine; reuse it)
- `## Entry points` table (React default, `/react`, `/react-native`,
  `/vue`, `/svelte`)
- React Native peer-dep note
- `## Security` section explaining default sanitization, what gets
  stripped, and the `sanitize={false}` escape hatch's risk
- `## License` MIT

**Verify**:
- `wc -l packages/svg/README.md` → ≥ 80 lines (0.2.1 was 131; aim for
  ≥80 to recover the lost surface).
- `grep -n "## Security" packages/svg/README.md` → one match.
- `grep -n "## Entry points" packages/svg/README.md` → one match.
- `grep -n "## License" packages/svg/README.md` → one match.

### Step 4: Update `packages/svg/package.json`

Add the missing fields. Final shape (delta from current):

```json
{
  "name": "@mhaadi/svg",
  "version": "0.2.3",
  "description": "Inline SVG rendering for React, React Native, Vue, and Svelte.",
  "license": "MIT",
  "keywords": [
    "svg",
    "react",
    "react-native",
    "vue",
    "svelte",
    "inline-svg",
    "sanitize",
    "dompurify-alternative"
  ],
  "homepage": "https://svg.mhaadi.dev",
  "repository": {
    "type": "git",
    "url": "https://github.com/mhaadiabu/better-svg.git",
    "directory": "packages/svg"
  },
  "bugs": {
    "url": "https://github.com/mhaadiabu/better-svg/issues"
  },
  "funding": {
    "type": "github",
    "url": "https://github.com/sponsors/mhaadiabu"
  },
  "engines": {
    "node": ">=18"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "svelte": "./dist/svelte/SVG.svelte",
  "exports": { ... unchanged ... },
  "publishConfig": { "access": "public" },
  "scripts": { ... unchanged ... },
  "devDependencies": { ... unchanged ... },
  "peerDependencies": { ... unchanged ... },
  "peerDependenciesMeta": { ... unchanged ... }
}
```

**STOP — executor must verify these assumptions**:
- The `repository.url` assumes the public repo is at
  `https://github.com/mhaadiabu/better-svg`. Run `git remote get-url
  origin` from the repo root. If it returns a different URL, use that.
  If it returns a private/internal URL, **STOP and report** — do not
  hardcode a public URL the executor cannot verify.
- The `funding.url` assumes a GitHub Sponsors account at
  `mhaadiabu`. The executor cannot verify this. If the maintainer has
  no Sponsors account, **omit the `funding` field** rather than
  fabricating one. The plan's intent is to add the field only when it
  resolves to a real URL.
- The `engines.node` is `>=18` to match the React peer dep. The
  executor cannot verify this is sufficient for `@better-svg/env` or
  other transitive workspace deps. If turbo's `build` task in
  `packages/svg` errors with an engines complaint, **STOP and report**
  the minimum observed Node version.
- The `keywords` list is a suggested set. The executor may trim or
  extend based on what makes sense (e.g. `astro`, `tailwind`). Do not
  add keywords unrelated to the package's actual surface.

**Verify**:
- `node -e "console.log(JSON.parse(require('fs').readFileSync('packages/svg/package.json','utf8')).license)"` → `MIT`.
- `node -e "console.log(JSON.parse(require('fs').readFileSync('packages/svg/package.json','utf8')).repository.url)"` → `https://github.com/<actual-owner>/better-svg.git`.
- `node -e "console.log(JSON.parse(require('fs').readFileSync('packages/svg/package.json','utf8')).engines.node)"` → `>=18`.
- `node -e "console.log(JSON.parse(require('fs').readFileSync('packages/svg/package.json','utf8')).files)"` → array containing `"dist"`, `"README.md"`, `"LICENSE"`.
- `pnpm check-types` → exit 0.
- `pnpm -F @mhaadi/svg test` → all pass (no source change; should be unchanged from before).

### Step 5: Verify the tarball ships the metadata

```bash
cd /home/haadi/Desktop/Code/better-svg/packages/svg
npm pack --dry-run
```

Expected output: the file list includes `dist/`, `dist/index.js`,
`dist/index.d.ts`, `README.md`, `LICENSE`, `package.json`, and the other
`dist/` files. **No `node_modules/`, no `tsconfig.json`, no `vitest.config.ts`,
no `scripts/`, no `src/`.** The `files` whitelist and `npm` defaults
exclude them.

Then run a real pack to inspect contents:

```bash
cd /home/haadi/Desktop/Code/better-svg/packages/svg
npm pack
ls *.tgz
tar -tzf mhaadi-svg-0.2.3.tgz | sort
```

Expected entries include:
- `package/LICENSE`
- `package/README.md`
- `package/package.json`
- `package/dist/index.js`
- `package/dist/index.d.ts`
- ... (other dist files)
- `package/dist/svelte/SVG.svelte`
- `package/dist/svelte/SVG.svelte.js`
- `package/dist/svelte/SVG.svelte.d.ts`

Do **not** keep the `.tgz` file checked in (`.gitignore` already
excludes `*.tgz` via the `Misc` block — confirm).

**Verify**:
- `tar -tzf mhaadi-svg-0.2.3.tgz | grep -E "LICENSE|README\.md$"` → both
  present.
- `tar -tzf mhaadi-svg-0.2.3.tgz | grep -E "node_modules|vitest|src/"` → empty.
- `rm mhaadi-svg-0.2.3.tgz` → cleanup.

### Step 6: Build, test, lint, typecheck (full suite)

```bash
cd /home/haadi/Desktop/Code/better-svg
pnpm check-types
pnpm lint
pnpm -F @mhaadi/svg test
pnpm -F @mhaadi/svg build
```

All must exit 0. The build updates `dist/`; the dist is gitignored.

**Verify**:
- `pnpm check-types` → exit 0.
- `pnpm lint` → exit 0.
- `pnpm -F @mhaadi/svg test` → all pass.
- `pnpm -F @mhaadi/svg build` → exit 0; `ls packages/svg/dist/package.json` does not exist (no dist package.json emitted, expected).

### Step 7: Tag the release (local only; do not push)

Per `AGENTS.md` § "Releases & versioning":

> After merging to `main`, tag the merge commit: `git tag @mhaadi/svg@<version>`
> and push the tag. Tags are the release trigger.

The executor tags locally. Pushing and publishing are not in scope for
this plan — the operator drives that step.

```bash
cd /home/haadi/Desktop/Code/better-svg
git tag @mhaadi/svg@0.2.3
git tag -l "@mhaadi/svg@0.2.3"
```

Expected: the tag is listed. **Do not** `git push` the tag.

**Verify**:
- `git tag -l "@mhaadi/svg@0.2.3"` → matches `@mhaadi/svg@0.2.3`.
- `git show @mhaadi/svg@0.2.3 --no-patch` → shows the commit SHA and
  the version (verify the tagged commit is the one containing this
  plan's changes; if it's not — i.e. the executor tagged an earlier
  commit — STOP and re-tag on the correct commit).

### Step 8: Done criteria check

Confirm the full Done criteria below. Report the results in the PR
description (or the final executor report) for the operator to review
before merging and publishing.

## Test plan

This plan is metadata + docs. The verification commands above are the
test plan. There are no new automated tests because:
- The `package.json` changes are JSON literals; `pnpm check-types` and
  `pnpm build` will fail if a field is misnamed.
- The README changes are prose; review is the verification.
- The LICENSE is a copy; `diff` is the verification.
- The CHANGELOG is a new file; review is the verification.

If the executor wants belt-and-suspenders, add a single vitest test in
`packages/svg/src/package-json.test.ts` that reads the published
`package.json` and asserts the expected fields. **Not required** — the
upstream tooling (npm pack) catches the same things at publish time.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `packages/svg/LICENSE` exists, is a copy of repo-root `LICENSE`, starts with "MIT License"
- [ ] `packages/svg/CHANGELOG.md` exists with a `## 0.2.3` heading
- [ ] `packages/svg/README.md` is ≥80 lines and includes `## Security`, `## Entry points`, `## License` sections
- [ ] `packages/svg/package.json` has `license: "MIT"`, `repository.url`, `homepage`, `bugs.url`, `engines.node`, `keywords` (non-empty array), and `version: "0.2.3"`
- [ ] `packages/svg/package.json` `files` includes `"README.md"` and `"LICENSE"` alongside `"dist"`
- [ ] `pnpm check-types` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm -F @mhaadi/svg test` exits 0
- [ ] `pnpm -F @mhaadi/svg build` exits 0
- [ ] `npm pack --dry-run` lists `LICENSE` and `README.md` and excludes `node_modules/`, `vitest.config.ts`, `src/`
- [ ] `git tag -l "@mhaadi/svg@0.2.3"` matches `@mhaadi/svg@0.2.3`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 010 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `git remote get-url origin` returns a URL the executor cannot
  confidently map to a public repo (e.g. an internal gitlab URL).
  Verify with the operator before hardcoding the `repository` field.
- The maintainer has no GitHub Sponsors account at `mhaadiabu` — omit
  the `funding` field rather than fabricating a URL.
- `pnpm -F @mhaadi/svg build` errors with an `EBADENGINE` complaint
  about the `engines.node` floor — the floor is too aggressive. STOP
  and report the actual observed minimum.
- The `npm pack --dry-run` output includes files that should be
  excluded (e.g. `src/`, `vitest.config.ts`, `tsconfig.json`) — the
  `files` whitelist is incomplete. STOP and report the unexpected
  entries; the operator may need to add a `.npmignore` or extend
  the `files` array.
- The repo-root `LICENSE` has changed since this plan was written
  (i.e. the maintainer updated the copyright year or switched
  licenses) — re-read the root `LICENSE` and use the current content
  verbatim.
- The 0.2.1 README in git (commit `3ecf95c^`) is not retrievable (e.g.
  the SHA range is wrong) — STOP and report; the maintainer must
  provide a reference for the historical README.

## Maintenance notes

- **Tag format follows `AGENTS.md`.** The maintainer's prior tags
  (`v0.2.0`, `v0.2.1`) used a `v` prefix; `AGENTS.md` mandates
  `@mhaadi/svg@<version>` going forward. The new tag uses the
  AGENTS.md form. If the maintainer wants to consolidate, the old `v`
  tags can be deleted (`git tag -d v0.2.0 v0.2.1`) in a separate
  housekeeping commit. **Do not delete the old tags in this plan.**
- **`npm publish` is not in this plan.** The executor tags locally.
  The operator (with npm auth) runs `cd packages/svg && npm publish
  --access public` after merging to `main` and pushing the tag. The
  `publishConfig: { "access": "public" }` field is already set; no
  `--access` flag needed.
- **The README has a "Full docs" link to `https://svg.mhaadi.dev`.**
  This is a one-way link to the docs site (not a redirect away from
  npm-readable content). Both the in-package README and the docs site
  should be kept in sync for Security and prop-table content. The
  docs site is the canonical source for examples and tutorials; the
  in-package README is the Socket/npm-scoreable surface.
- **Reviewer focus:**
  - Verify the `repository.url` resolves to the actual public repo.
  - Verify the `keywords` list is honest (no SEO-spam keywords).
  - Verify the `engines.node` floor is consistent with the
    `peerDependencies.react: ">=18"` minimum (React 18 requires
    Node ≥16.14, but pnpm/Node 18+ is the modern baseline).
  - Verify the README's prop table matches the current TypeScript
    surface (`SvgProps` in `packages/svg/src/svg.tsx:20-29` is
    authoritative).
  - The CHANGELOG's 0.2.3 entry must mention BOTH the parsed-cache
    fix (plan 009) and the trust-signal fix (this plan), so a reader
    who upgrades sees the full change set.
