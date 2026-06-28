# Plan 005: Run lint+test in CI; remove unused import

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7e1b3b6..HEAD -- .github/workflows/deploy.yml packages/infra/alchemy.run.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-vitest-harness-core-tests.md
- **Category**: dx
- **Planned at**: commit `7e1b3b6`, 2026-06-23

## Why this matters

CI (`.github/workflows/deploy.yml`) runs `pnpm check-types` and `pnpm build`
but **not** `pnpm test` or `oxlint`. So the type system guards against type
errors and the build guards against broken compilation, but nothing catches
runtime regressions (sanitizer, cache, parse) or lint drift. On top of that,
`pnpm check` (the repo's lint+fmt command) currently **fails on `main`**:
`packages/infra/alchemy.run.ts:3` imports `CloudflareStateStore` but never
uses it — a leftover from the state-store flip-flop visible in recent git
history (`7e1b3b6`, `29ac479`, `ee9cc8d`). Plan 001 adds `pnpm test` to CI;
this plan adds the oxlint gate and removes the dead import so `pnpm check`
is green and enforced.

## Current state

`.github/workflows/deploy.yml` `check` job (lines 14-27):
```yaml
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11.1.3
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm check-types
      - run: pnpm build
```
After Plan 001, a `- run: pnpm test` line sits between `check-types` and
`build`. This plan adds the lint step.

`packages/infra/alchemy.run.ts` lines 1-11:
```ts
import alchemy from "alchemy";
import { Vite } from "alchemy/cloudflare";
import { CloudflareStateStore, FileSystemStateStore } from "alchemy/state";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });

const app = await alchemy("better-svg", {
  stateStore: (scope) => new FileSystemStateStore(scope),
});
```
`CloudflareStateStore` is imported but never referenced (the app uses
`FileSystemStateStore`). Confirmed by `oxlint`:
`packages/infra/alchemy.run.ts:3:10: error eslint(no-unused-vars): Identifier 'CloudflareStateStore' is imported but never used.`

`pnpm-workspace.yaml` excludes `**/flutter` from the pnpm workspace, so
`oxlint` won't accidentally lint Dart. `.oxlintrc.json` enables
`correctness: "error"` with `typescript`, `unicorn`, `oxc` plugins.

The root `package.json` `check` script (line 16): `"check": "oxlint && oxfmt --write"`.
CI should run lint in **check mode** (no `--write`), not the local
auto-fixing `check` script. Use `npx oxlint .` directly, or add a
`lint:check` script. The repo has no separate lint-check script today.

## Commands you will need

| Purpose   | Command                | Expected on success |
|-----------|------------------------|---------------------|
| Lint      | `npx oxlint .`         | exit 0              |
| Typecheck | `pnpm check-types`     | exit 0              |
| Test      | `pnpm test`            | all pass            |
| Build     | `pnpm build`           | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `packages/infra/alchemy.run.ts` — remove the unused `CloudflareStateStore` import.
- `.github/workflows/deploy.yml` — add the `pnpm test` step (if Plan 001 hasn't already) and an oxlint step.
- `package.json` (root) — add a `lint` script that runs `oxlint` in check mode (no `--write`), for CI and local use.

**Out of scope** (do NOT touch):
- `packages/infra/alchemy.run.ts` logic — only the import line. Do not change the state store choice.
- `.oxlintrc.json`, `.oxfmtrc.json` — lint config is fine.
- `turbo.json` — the existing `lint` task (no inputs/outputs) is fine; CI calls `oxlint` directly to avoid a turbo cache layer hiding fresh failures.
- `oxfmt` in CI — formatting auto-fix belongs locally; CI gate is lint-only. (If the maintainer wants fmt-check in CI later, that's a separate plan.)

## Git workflow

- Branch: `advisor/005-lint-ci-unused-import`
- Commit: `chore(ci): lint in CI and remove unused CloudflareStateStore import`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Remove the unused import

In `packages/infra/alchemy.run.ts`, line 3, change:
```ts
import { CloudflareStateStore, FileSystemStateStore } from "alchemy/state";
```
to:
```ts
import { FileSystemStateStore } from "alchemy/state";
```

**Verify**: `npx oxlint .` → exit 0 (the one error is gone). `pnpm check-types` → exit 0.

### Step 2: Add a `lint` script to the root package.json

In `package.json` `scripts` (after `check`), add:
```json
"lint": "oxlint"
```
This is the CI-friendly check-mode lint (no `--write`). The existing `check`
script (which auto-fixes fmt) stays for local use. Do not change `check`.

Current scripts block:
```json
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "check-types": "turbo check-types",
    "dev:web": "turbo -F web dev",
    "deploy": "turbo -F @better-svg/infra deploy",
    "destroy": "turbo -F @better-svg/infra destroy",
    "check": "oxlint && oxfmt --write"
  },
```
Add `"lint": "oxlint",` after `"check"`.

**Verify**: `pnpm lint` → exit 0.

### Step 3: Wire lint + test into the CI `check` job

In `.github/workflows/deploy.yml`, the `check` job steps. After Plan 001, the
steps are:
```yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm check-types
      - run: pnpm test
      - run: pnpm build
```
Add the lint step. Final order (lint is fast, run it first to fail fast):
```yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm check-types
      - run: pnpm test
      - run: pnpm build
```
If Plan 001 did **not** add `pnpm test` (e.g. the executor skipped it), add it
now — it's required for this plan's verify. If it's already there, leave it.

**Verify**: `grep -n "pnpm lint" .github/workflows/deploy.yml` → one match. `grep -n "pnpm test" .github/workflows/deploy.yml` → one match.

### Step 4: Full verification

**Verify**:
- `pnpm lint` → exit 0.
- `pnpm check-types` → exit 0.
- `pnpm test` → exit 0 (all tests from 001/002/003/004).
- `pnpm build` → exit 0.
- `grep -rn "CloudflareStateStore" packages/infra/alchemy.run.ts` → no matches.

## Test plan

- No new tests — this is a CI + cleanup plan. The verification is that the
  existing test suite passes under the new CI gate and `pnpm lint` is green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx oxlint .` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `grep -n "CloudflareStateStore" packages/infra/alchemy.run.ts` → no matches
- [ ] `grep -n "pnpm lint" .github/workflows/deploy.yml` → one match
- [ ] `grep -n "pnpm test" .github/workflows/deploy.yml` → one match
- [ ] `pnpm check-types`, `pnpm test`, `pnpm build` all exit 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- After removing `CloudflareStateStore`, `pnpm check-types` reports an error
  in `alchemy.run.ts` — that would mean the import *is* used somewhere you
  didn't see. Report the exact tsc error.
- `npx oxlint .` reports a *different* lint error after the fix (not the
  removed one) — report it; don't fix unrelated issues here.
- The `check` job in `deploy.yml` already has a lint step (someone added it
  independently) — adapt rather than duplicate; report it.

## Maintenance notes

- **`pnpm check` (local, auto-fixing) vs `pnpm lint` (CI, check-only):** keep
  both. Developers run `pnpm check` to format; CI runs `pnpm lint` to gate.
- **Fmt in CI is deliberately omitted** — `oxfmt --write` mutates files and
  would require a commit-back workflow. If fmt drift becomes a problem, add a
  `oxfmt --check` step later.
- **The `CloudflareStateStore` import accumulated during the state-store
  flip-flop** (commits `7e1b3b6` → `46762dd`). When infra state-store logic
  next changes, watch for re-introduced unused imports — CI now catches them.
