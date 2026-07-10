# Agent Instructions

This file defines how AI agents and human contributors work in this repository.
It exists so that any session — interactive or autonomous — can pick up work
without re-deriving conventions from chat history.

## Repository at a glance

- Monorepo managed with **pnpm workspaces** + **Turbo** (`pnpm-workspace.yaml`,
  `turbo.json`).
- Two publishable packages:
  - [`packages/svg`](./packages/svg) — `@mhaadi/svg` on npm, versioned
    semver, published via `publishConfig`.
  - [`packages/flutter`](./packages/flutter) — `svg_flutter` on pub.dev
    (currently `publish_to: none`, not yet released).
- Internal packages: `packages/config` (`@better-svg/config`),
  `packages/env` (`@better-svg/env`), `packages/infra` (`@better-svg/infra`).
- One app: `apps/web` (Astro documentation site deployed to
  [svg.mhaadi.dev](https://svg.mhaadi.dev)).
- Implementation plans live in [`plans/`](./plans) and are the source of
  truth for in-flight work.

## Branching & pull requests

- **Default branch is `main`.** It must always be green and releasable.
- **Major features go on a dedicated branch** (e.g.
  `feat/<short-slug>` or `advisor/<NNN>-<slug>` for plans). Do not develop
  major features directly on `main`.
- Branch name conventions:
  - `feat/...` — new user-facing capability.
  - `fix/...` — bug fix.
  - `chore/...` — tooling, deps, refactors with no behavior change.
  - `docs/...` — documentation only.
  - `advisor/NNN-...` — work driven by a plan in `plans/`.
- **Open a pull request as soon as the feature is confirmed working.** Do
  not sit on a branch waiting to be asked. The PR is the review surface and
  the integration point.
- PR description must include:
  - What changed and why (one short paragraph).
  - Linked plan file (if applicable).
  - Verification steps actually run (commands + results).
  - Release impact: list any package that needs a version bump + changelog
    entry (see "Releases" below).
- Squash-merge or rebase-merge is preferred; the merge commit on `main`
  should tell a clean story.

## Commits

- **Commit frequently without being asked.** Do not batch a session's worth
  of work into one commit "at the end."
- **Keep commits small and focused.** A commit should be the smallest unit
  that compiles, lints, and tests cleanly on its own when practical.
- **Do not over-split.** A commit that touches one logical change across
  three files is fine; three commits that each rename one variable are
  noise. Aim for commits that read as a coherent step in the diff.
- **Maintain good separation of concerns.** If a commit mixes a refactor
  with a behavior change, split it. If a fix requires a test, the test
  belongs in the same commit (or a tightly-paired follow-up) — never
  land the fix without its verification.
- Write commit messages in the form `<type>(<scope>): <imperative summary>`
  using the same `<type>` vocabulary as branch names (`feat`, `fix`,
  `chore`, `docs`, `refactor`, `test`, `build`, `ci`).
  - `<scope>` is the affected package or area (`svg`, `flutter`, `web`,
    `infra`, `plans`, `root`, etc.).
  - Summary is lowercase, no trailing period, ≤72 chars.
  - Body (when needed) explains the _why_; the diff explains the _what_.
- Never commit secrets, build artifacts (`dist/`, `node_modules/`,
  `.turbo/`), or generated lockfile churn unrelated to the change.

## Releases & versioning

The repo ships two consumer packages. **Any patch or update that lands in
a package must be released as part of the same change set that merges to
`main` (or, for major features, as part of the PR before it is merged).**
A merged change that bumps behavior in a published package without a
corresponding version bump + tag is a defect.

Rules per package:

- **`@mhaadi/svg` (npm, `packages/svg`)**
  - Follow semver. Bump in `packages/svg/package.json` on every change to
    source under `packages/svg/src/`.
  - Update `CHANGELOG.md` (add one if missing) under a new versioned
    heading with a bullet list of user-visible changes.
  - After merging to `main`, tag the merge commit: `git tag @mhaadi/svg@<version>`
    and push the tag. Tags are the release trigger.
  - Build artifacts (`dist/`) are gitignored and produced by `pnpm run build`
    at publish time — do not commit them.

- **`svg_flutter` (pub.dev, `packages/flutter`)**
  - Follow semver. Bump `version` in `packages/flutter/pubspec.yaml` on
    every change to `packages/flutter/lib/`.
  - Update `packages/flutter/CHANGELOG.md` under a new versioned heading.
  - While `publish_to: none` is set, no `git tag` is required; publishing
    is gated on flipping that flag. When that happens, adopt the same
    tag-per-version convention as `@mhaadi/svg`.

- **Internal packages** (`@better-svg/config`, `@better-svg/env`,
  `@better-svg/infra`) do not need tags, but their `version` must still
  be bumped when consumers depend on the change, and downstream workspace
  `workspace:*` references must resolve.

### GitHub releases

When tagging a release, create a GitHub Release from the tag. Release
notes are user-facing, not internal — they are what consumers read in
the npm UI, the GitHub Releases page, and dependency update PRs (Renovate,
Dependabot). Follow the Keep a Changelog format:

- **Title**: the tag name (e.g. `@mhaadi/svg@0.2.3`).
- **Body**: one section per change type, using the headings `### Added`,
  `### Changed`, `### Fixed`, `### Removed`, `### Security`. Omit empty
  sections. Each entry is one line, written for the consumer ("Cache
  parsed SVGs so re-mounts skip DOMParser" — not "Add
  `ensureParsedSvg` to `core/cache.ts`").
- **Full Changelog link**: end with
  `**Full Changelog**: https://github.com/mhaadiabu/better-svg/compare/<prev-tag>...<tag>`.
- No commit lists, no verification steps, no plan references, no
  "what's in the stack", no internal notes. Those belong in the PR
  description, not the release notes.
- The `CHANGELOG.md` entry and the GitHub release body should contain
  the same information. The changelog is the source of truth; the
  release body is its copy.

- Before pushing to `main` or opening a PR that touches a package's
  source, verify: (1) the version is bumped, (2) the changelog is updated,
  (3) for npm packages the corresponding tag is planned. Do not merge
  until all three hold.

## Plans

- `plans/README.md` is the index. Each plan file is `NNN-<slug>.md`.
- When a plan is selected for execution, mark it `IN PROGRESS` in the
  index and create a branch named `advisor/NNN-<slug>`.
- When the work lands, mark the plan `DONE` (or `BLOCKED` with a one-line
  reason) and reference the merged PR.

## Local verification

Run from the repo root unless a per-package command is listed.

- `pnpm install` — sync workspace.
- `pnpm run check-types` — TypeScript across the workspace.
- `pnpm run lint` — Oxlint.
- `pnpm run check` — Oxlint + Oxfmt write.
- `pnpm run test` — Vitest via Turbo (covers `packages/svg`).
- `pnpm run build` — Build all packages and apps.
- For Flutter: `cd packages/flutter && flutter pub get && flutter test`
  (only if the Flutter toolchain is available; otherwise note the gap in
  the PR description).

A change is "confirmed working" only after the relevant subset of the
above has been run and is green. Do not open a PR on red.

## Scope of an agent's work

- Stay within the scope of the request. If a fix reveals a sibling issue,
  note it (in the PR description or a plan) rather than expanding the
  diff.
- Prefer reading existing code over guessing. Follow local conventions
  for naming, exports, and file layout before introducing new patterns.
- Do not introduce comments unless the surrounding code already uses
  them; this repo's source files are intentionally uncommented.
