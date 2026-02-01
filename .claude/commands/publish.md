Publish a new version of quickbooks-mcp to npm and the MCP Registry.

## Arguments

$ARGUMENTS should be the version bump type: `patch`, `minor`, or `major`.
If no argument is provided, ask the user which bump type they want (patch, minor, or major) before proceeding.

## Steps

### 1. Pre-flight checks

- Verify the working directory is clean (`git status` shows no uncommitted changes). If there are uncommitted changes, stop and ask the user to commit or stash them first.
- Verify you are on the `master` branch. Warn if not.
- Verify `npm whoami` succeeds (user is logged into npm).

### 2. Version bump

- Read the current version from `package.json`.
- Compute the new version based on the bump type argument (patch/minor/major) using semver rules.
- Update the `version` field in `package.json`.
- Update both the top-level `version` and `packages[0].version` fields in `server.json` to match.
- Show the user: "Bumping version: {old} -> {new}" and confirm before proceeding.

### 3. Build verification

- Run `npm run build` and verify it completes without errors.
- If the build fails, stop and show the errors. Do not proceed with publishing.

### 4. Commit and tag

- Stage `package.json` and `server.json`.
- Commit with message: `v{new_version}`
- Create a git tag: `v{new_version}`

### 5. Publish to npm

- Run `npm publish`.
- Verify it succeeds. If it fails, inform the user but continue to try the remaining steps.

### 6. Publish to MCP Registry

- Run `mcp-publisher publish` from the repo root.
- If it fails (e.g., expired token), inform the user they may need to run `mcp-publisher login github` to re-authenticate, but don't block on this.

### 7. Push to GitHub

- Run `git push && git push --tags`.

### 8. Summary

Print a summary:
```
Published quickbooks-mcp v{new_version}
  npm: https://www.npmjs.com/package/quickbooks-mcp
  MCP Registry: https://registry.modelcontextprotocol.io/
  GitHub: https://github.com/laf-rge/quickbooks-mcp
```
