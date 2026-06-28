# Plan 012: AGENTS.md release-notes convention + deploy workflow hardening

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9af3c16..HEAD -- AGENTS.md .github/workflows/deploy.yml`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx, ci, docs
- **Planned at**: commit `9af3c16`, 2026-06-25

## Why this matters

Two problems:

1. **GitHub release notes look like PR descriptions.** The v0.2.2 release
   (`gh release view v0.2.2`) contains a "Highlights" section with 10
   bullets, an "Upgrade" section, a "What's in the stack" section listing
   11 commits, a "Verification" section with checkmarks, and a "Notes"
   section with follow-up items. This is internal PR-description content,
   not user-facing release notes. Industry-standard release notes are
   brief, user-facing, grouped by change type (Keep a Changelog
   categories), and link to the full changelog. The AGENTS.md has no
   convention for how GitHub releases should be written, so each release
   ad-hocs the format.

2. **The deploy workflow has a pnpm version mismatch.** The root
   `package.json` declares `"packageManager": "pnpm@11.8.0"` but
   `.github/workflows/deploy.yml` pins `pnpm/action-setup@v4` with
   `version: 11.1.3` in both the `check` and `deploy` jobs. CI installs
   pnpm 11.1.3; the lockfile and `frozen-lockfile` resolution may behave
   differently than the maintainer's local pnpm 11.8.0. This is the most
   likely root cause of CI incidents. Additionally, the workflow has:
   no `permissions:` block (overly broad default token), no
   `timeout-minutes` (a hung job runs 6 hours), no GitHub Environment
   on the deploy job (no protection gate for production), and a single
   workflow named "Deploy" that runs checks on every PR (confusing
   naming — a PR that fails `pnpm lint` shows up as a "Deploy" failure).

## Current state

### `AGENTS.md`

The file has sections: "Repository at a glance", "Branching & pull
requests", "Commits", "Releases & versioning", "Plans", "Local
verification", "Scope of an agent's work". There is no section on
GitHub release notes format. The "Releases & versioning" section (lines
70–105) covers semver, changelog, and tags, but says nothing about the
GitHub release UI itself.

The v0.2.2 release notes (from `gh release view v0.2.2 --json body`):

```
## Highlights
- Vue & Svelte sanitization now uses the shared core ...
- React <SVG> cache now actually caches ...
...
## Upgrade
pnpm add @mhaadi/svg@0.2.2
...
## What's in the stack
The 11 commits below are in this release ...
1. test(svg): add vitest harness ...
...
## Verification
- pnpm check-types ✓
- pnpm lint ✓
...
## Notes
- One it.skip in ...
- pnpm-workspace.yaml still has ...
```

This is the format to prohibit. Compare with the v0.2.1 release notes:

```
### Patch
- Fix `import.meta` syntax error in React Native / Hermes ...

**Full Changelog**: https://github.com/mhaadiabu/better-svg/commits/v0.2.1
```

That is the correct format — brief, user-facing, one section per change
type, a link to the full changelog.

### `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11.1.3          # ← MISMATCH: package.json says 11.8.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm check-types
      - run: pnpm test
      - run: pnpm build

  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11.1.3          # ← MISMATCH: same here
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Deploy
        run: |
          [ -z "$CLOUDFLARE_ACCOUNT_ID" ] && unset CLOUDFLARE_ACCOUNT_ID
          [ -z "$CLOUDFLARE_API_TOKEN" ] && unset CLOUDFLARE_API_TOKEN
          pnpm deploy
        env:
          ALCHEMY_CI_STATE_STORE_CHECK: false
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Issues to fix:
1. pnpm version `11.1.3` → `11.8.0` (match `package.json`'s
   `packageManager` field). Or better: remove the hardcoded version and
   use `pnpm/action-setup@v4` with `run_install: false` so it reads
   `packageManager` automatically. The action supports this: just omit
   the `version` input and it reads `packageManager` from `package.json`.
2. No `permissions:` block — add `permissions: contents: read` at the
   workflow level. The deploy job needs `contents: read` and
   `deployments: write` if it creates GitHub deployments (Alchemy
   doesn't, so `contents: read` is sufficient for both).
3. No `timeout-minutes` — add `timeout-minutes: 10` to `check` and
   `timeout-minutes: 5` to `deploy`.
4. No `environment` on the deploy job — add `environment: production`
   so the maintainer can add protection rules (required reviewers,
   branch limits) in GitHub repo settings. Even without protection
   rules configured, the `environment` key makes the deploy visible
   in the repo's Environments UI and gives it a separate secrets
   namespace.
5. Workflow name "Deploy" is misleading for PR runs — rename to "CI"
   and split deploy into a separate workflow file
   (`.github/workflows/deploy.yml` stays for deploy;
   `.github/workflows/ci.yml` is new for checks). OR: keep one file
   but rename to "CI / Deploy" — the user's preference. **Decision:
   split into two files.** It's cleaner, and PRs only trigger `ci.yml`,
   not the deploy workflow at all.

### `packages/infra/.env`

This file exists on disk with one line (`ALCHEMY_STATE_TOKEN=...`). It
is **not tracked by git** (`git ls-files packages/infra/.env` returns
empty). It's a local development file. The CI deploy job does not
depend on it (Alchemy falls back to environment variables from the
GitHub secrets). **No change needed to this file.** The plan mentions
it only to document that CI is not secret-dependent on a local `.env`.

Repo conventions:
- `AGENTS.md` uses markdown headings (`##`) with bullet lists.
- Style is imperative, concise, no code comments.
- Conventional commits: `<type>(<scope>): <imperative summary>`.
- The repo is public (`gh repo view --json visibility` → `"PUBLIC"`).

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `pnpm install`                   | exit 0              |
| Typecheck | `pnpm check-types`               | exit 0              |
| Lint      | `pnpm lint`                      | no new errors       |
| Test      | `pnpm -F @mhaadi/svg test`       | all pass            |
| Build     | `pnpm build`                     | exit 0              |
| Workflow lint | `yamllint .github/workflows/*.yml` (if available) or `actionlint` (if available) | no errors |

## Scope

**In scope** (the only files you should modify or create):
- `AGENTS.md` — add a "GitHub releases" subsection under "Releases &
  versioning" with the industry-standard release-notes convention.
- `.github/workflows/deploy.yml` — rewrite: fix pnpm version, add
  `permissions`, `timeout-minutes`, `environment`, and narrow the
  trigger to `push: branches: [main]` only (no PR trigger — that moves
  to `ci.yml`).
- `.github/workflows/ci.yml` — **create.** The check job (lint,
  check-types, test, build) extracted from the current `deploy.yml`,
  triggered on `push: branches: [main]` and `pull_request: branches:
  [main]`.

**Out of scope** (do NOT touch):
- `packages/infra/alchemy.run.ts` — the deploy script is fine. The
  `FileSystemStateStore` and dotenv loading work as-is.
- `packages/infra/.env` — local file, not tracked. Leave it.
- `packages/infra/package.json` — no changes.
- `turbo.json` — no changes.
- `package.json` (root) — no changes (the `packageManager` field is
  already correct at `pnpm@11.8.0`; the fix is in CI matching it).
- `pnpm-workspace.yaml` — no changes.
- `packages/svg/**` — no source changes (plans 009–011 handle those).
- `apps/web/**` — no changes.
- The actual `npm publish` workflow — out of scope. The maintainer
  publishes manually after tagging. A future plan can add a
  release-on-tag workflow if desired.
- GitHub repo settings (Environment protection rules, branch
  protection) — the executor can't change these; the `environment:
  production` key in the workflow is the signal for the maintainer to
  configure protection in the repo UI.

## Git workflow

- Branch: `advisor/012-release-convention-deploy-hardening`
- Suggested commits (in order):
  1. `docs(root): add GitHub release-notes convention to AGENTS.md`
  2. `fix(ci): split check and deploy into separate workflows`
  3. `fix(ci): align pnpm version with packageManager and harden deploy`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add the release-notes convention to `AGENTS.md`

In `AGENTS.md`, under the "Releases & versioning" section, after the
"Internal packages" bullet and before the "Before pushing to `main`"
paragraph, add a new subsection:

```markdown
## GitHub releases

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
```

Insert this after the "Internal packages" bullet block (around line 99)
and before the "Before pushing to `main`" paragraph (around line 101).
The section heading is `## GitHub releases` (same level as "Releases &
versioning"). Actually — keep it as a subsection: use `### GitHub
releases` under `## Releases & versioning` to match the document's
heading hierarchy. Check the existing heading levels in `AGENTS.md`
before deciding: if "Releases & versioning" is `##`, use `###` for the
new subsection.

**Verify**: `grep -n "### GitHub releases" AGENTS.md` → one match,
inside the "Releases & versioning" section.

### Step 2: Create `.github/workflows/ci.yml`

Extract the `check` job from the current `deploy.yml` into its own
workflow file. This is the workflow that runs on PRs and pushes to
`main`.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm check-types
      - run: pnpm test
      - run: pnpm build
```

Key changes from the old `check` job:
- `pnpm/action-setup@v4` has **no `version` input** — the action reads
  `packageManager` from `package.json` automatically (pnpm 11.8.0).
- `permissions: contents: read` at the workflow level.
- `timeout-minutes: 10` on the job.
- `concurrency` group is `ci-${{ github.ref }}` (separate from deploy).

**Verify**: `cat .github/workflows/ci.yml` → file exists with the
content above. `grep -c "version: 11" .github/workflows/ci.yml` → 0
(no hardcoded pnpm version).

### Step 3: Rewrite `.github/workflows/deploy.yml`

Replace the entire file. The deploy workflow now only runs on pushes to
`main` (not PRs), depends on the CI workflow passing, and has
production hardening.

```yaml
name: Deploy

on:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

jobs:
  deploy:
    needs: []
    runs-on: ubuntu-latest
    timeout-minutes: 5
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Deploy
        run: |
          [ -z "$CLOUDFLARE_ACCOUNT_ID" ] && unset CLOUDFLARE_ACCOUNT_ID
          [ -z "$CLOUDFLARE_API_TOKEN" ] && unset CLOUDFLARE_API_TOKEN
          pnpm deploy
        env:
          ALCHEMY_CI_STATE_STORE_CHECK: false
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Key changes:
- Trigger is `push: branches: [main]` only — no PR trigger. CI is
  handled by `ci.yml`.
- `pnpm/action-setup@v4` has no `version` input — reads
  `packageManager` from `package.json`.
- `permissions: contents: read`.
- `timeout-minutes: 5`.
- `environment: production` — the maintainer can add protection rules
  (required reviewers, wait timer) in GitHub repo settings →
  Environments → production. Even without rules configured, this
  separates production secrets from the default namespace and makes
  the deploy visible in the Environments UI.
- `concurrency: cancel-in-progress: false` — don't cancel a deploy
  mid-flight if another push lands; queue it. A half-deployed worker
  is worse than a slightly delayed one.
- `needs: []` — the deploy job doesn't formally depend on the CI
  workflow (GitHub doesn't support cross-workflow `needs`). The CI
  workflow runs on the same push and will fail first if something is
  broken; the maintainer should check CI status before merging. A
  future enhancement could add a `workflow_run` trigger that waits
  for CI to pass, but that's out of scope.

**Verify**:
- `cat .github/workflows/deploy.yml` → content matches.
- `grep -c "version: 11" .github/workflows/deploy.yml` → 0.
- `grep -c "pull_request" .github/workflows/deploy.yml` → 0.
- `grep "environment: production" .github/workflows/deploy.yml` → 1.
- `grep "timeout-minutes" .github/workflows/deploy.yml` → 1.

### Step 4: Verify locally

```bash
cd /home/haadi/Desktop/Code/better-svg
pnpm install --frozen-lockfile
pnpm lint
pnpm check-types
pnpm -F @mhaadi/svg test
pnpm build
```

All must exit 0. The workflow file changes don't affect local
verification, but run the full suite to confirm nothing is broken.

**Verify**: all commands exit 0.

### Step 5: Validate workflow YAML

If `actionlint` is available:
```bash
actionlint .github/workflows/ci.yml .github/workflows/deploy.yml
```

If `yamllint` is available:
```bash
yamllint .github/workflows/ci.yml .github/workflows/deploy.yml
```

If neither is available, validate the YAML manually:
```bash
node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci.yml','utf8')); console.log('ci.yml OK')"
node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/deploy.yml','utf8')); console.log('deploy.yml OK')"
```

If `js-yaml` isn't installed either, skip this step and note it in the
report. The YAML is simple enough that the executor can eyeball it.

**Verify**: whichever linter is available passes; if none, note it.

## Test plan

This plan is config + docs. The verification commands above are the
test plan. There are no automated tests for GitHub workflow files in
this repo. The maintainer should:
1. Push the branch and open a PR — confirm `CI` workflow (not `Deploy`)
   runs on the PR.
2. After merge, confirm `Deploy` workflow runs on `main` push only.
3. In GitHub repo settings → Environments, configure the `production`
   environment with at least one required reviewer.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "### GitHub releases" AGENTS.md` → one match, under "Releases & versioning"
- [ ] `grep -c "No commit lists" AGENTS.md` → 1 (the convention is stated)
- [ ] `.github/workflows/ci.yml` exists
- [ ] `grep -c "version: 11" .github/workflows/ci.yml .github/workflows/deploy.yml` → 0 (no hardcoded pnpm version)
- [ ] `grep "pull_request" .github/workflows/deploy.yml` → no matches (deploy is push-only)
- [ ] `grep "pull_request" .github/workflows/ci.yml` → 1 match (CI runs on PRs)
- [ ] `grep "environment: production" .github/workflows/deploy.yml` → 1
- [ ] `grep "timeout-minutes" .github/workflows/deploy.yml .github/workflows/ci.yml` → 2 (one per file)
- [ ] `grep "permissions:" .github/workflows/deploy.yml .github/workflows/ci.yml` → 2
- [ ] `pnpm check-types` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm -F @mhaadi/svg test` exits 0
- [ ] `pnpm build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 012 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The `AGENTS.md` heading hierarchy doesn't match what the plan
  assumes (the plan says `### GitHub releases` under `## Releases &
  versioning` — if the existing headings use a different level,
  adapt the new heading level to match and note it).
- `pnpm/action-setup@v4` does not auto-detect `packageManager` from
  `package.json` when the `version` input is omitted. (The action's
  docs say it does since v4. If the executor can't confirm this,
  STOP and use `version: 11.8.0` as an explicit fallback — that's
  still a fix over `11.1.3`.)
- The `environment: production` key causes the deploy to fail because
  the maintainer hasn't created the `production` environment in GitHub
  repo settings. (GitHub auto-creates the environment on first use,
  so this shouldn't happen — but if it does, STOP and report.)
- `pnpm install --frozen-lockfile` fails with a lockfile-compatibility
  error after removing the explicit pnpm version — the auto-detected
  pnpm version may differ from the maintainer's local version in a
  way that breaks the lockfile. STOP and report the exact error.
- The split into two workflow files breaks the `concurrency` semantics
  in an unexpected way (e.g. both workflows run on push to main and
  the deploy doesn't wait for CI). This is expected — `needs: []`
  means deploy doesn't formally depend on CI. The plan documents
  this. If the maintainer wants cross-workflow gating, that's a
  follow-up using `workflow_run`.

## Maintenance notes

- **The `environment: production` key is the signal for the maintainer
  to configure protection.** Without it, the deploy has no protection
  gate. With it, the maintainer can add required reviewers in GitHub
  repo settings → Environments → production. The plan can't configure
  repo settings; the maintainer must do this manually.
- **The pnpm version is no longer hardcoded.** `pnpm/action-setup@v4`
  reads `packageManager` from `package.json`. When the maintainer bumps
  pnpm (e.g. to 11.9.0), CI automatically uses the new version. No
  more drift.
- **`cancel-in-progress: false` on deploy is intentional.** A
  half-deployed Cloudflare Worker is worse than a queued redeploy. The
  CI workflow keeps `cancel-in-progress: true` because check runs are
  cheap and disposable.
- **The release-notes convention in AGENTS.md is enforceable by
  review.** There's no automated check for release-notes format. The
  convention is a cultural one — reviewers should reject PRs that
  draft release notes with commit lists or verification steps.
- **Reviewer focus:**
  - Verify the AGENTS.md heading level matches the document's
    hierarchy.
  - Verify `pnpm/action-setup@v4` is called without `version:` in both
    workflow files.
  - Verify `deploy.yml` has no `pull_request` trigger.
  - Verify `ci.yml` has `pull_request` trigger.
  - The `environment: production` key is the most important deploy
    hardening — confirm it's present.
