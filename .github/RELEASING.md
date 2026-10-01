# Publishing @mhaadi/svg

The release workflow follows the npm trusted publishing setup in
`thinking-orbs-native`. It publishes only `packages/svg`.

## Configure npm once

In the [npm package settings](https://www.npmjs.com/package/@mhaadi/svg/access),
add a [trusted publisher](https://docs.npmjs.com/trusted-publishers/) for GitHub
Actions with these values:

- Organization or user: `mhaadiabu`
- Repository: `better-svg`
- Workflow filename: `release.yml`
- Environment name: leave blank
- Allowed actions: enable direct publishing with `npm publish`

The workflow authenticates through GitHub OIDC. It does not need an
`NPM_TOKEN` secret.

## Release a version

1. Update `packages/svg/package.json` to the chosen release version.
2. Move the relevant Unreleased notes in `packages/svg/CHANGELOG.md` under
   `## <version>`. Keep the `### Changed`, `### Fixed`, and other change
   sections that apply.
3. Commit the release changes and merge their PR into `main`.
4. Tag that commit with `@mhaadi/svg@<version>` and push the tag.

For example, after merging a future 0.2.4 release:

```sh
git switch main
git pull --ff-only
git tag @mhaadi/svg@0.2.4
git push origin @mhaadi/svg@0.2.4
```

The workflow verifies the tag and changelog entry, installs dependencies,
runs lint, type checks, and tests, builds the SVG package, and publishes it
with provenance. Stable versions use the npm `latest` tag. Prereleases use
`next` and create a prerelease on GitHub.

After publishing, the workflow creates a GitHub Release with the matching
changelog entry and a Full Changelog link. The link can use an older
`v*` tag, such as the existing `v0.2.3`, as its starting point.

The workflow does not change package versions. Pushing to `main` or opening
a PR does not publish a package.
