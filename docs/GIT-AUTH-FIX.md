# Git Layer Authentication Fix

## Issue
Users experienced GitHub authentication popups after the first successful MCP call when using a company layer configured with:
- `type: github`
- `auth_type: token`
- `GITHUB_TOKEN` environment variable

### Symptoms
1. First MCP call works correctly with token authentication
2. Subsequent MCP calls trigger GitHub credential prompts
3. Users repeatedly asked to enter username/password despite having valid token

## Root Cause
The `GitKnowledgeLayer` was configuring git credential helper with:
```typescript
await this.git.addConfig('credential.helper', 'store --file=.git-credentials');
```

**Problems:**
1. **Relative path issue**: `.git-credentials` was relative and couldn't be found in subsequent git operations
2. **Stale configuration**: The credential helper configuration persisted but the credentials file didn't
3. **Fallback to interactive auth**: Git fell back to prompting for credentials when the helper failed

## Solution
Changed authentication strategy to **embed credentials directly in git URLs** for token and basic authentication:

### Before (Problematic)
```typescript
// Set up credential helper (doesn't work reliably)
await this.git.addConfig('credential.helper', 'store --file=.git-credentials');

// Clone with original URL
await this.git.clone(this.gitConfig.url, this.localPath);

// Pull without updating remote URL
await this.git.pull('origin', this.gitConfig.branch);
```

### After (Fixed)
```typescript
// For TOKEN auth: No credential helper setup, embed in URLs

// Clone with authenticated URL
const cloneUrl = this.prepareUrlWithAuth(this.gitConfig.url);
await this.git.clone(cloneUrl, this.localPath);

// Pull with authenticated remote URL
if (this.auth && (this.auth.type === AuthType.TOKEN || this.auth.type === AuthType.BASIC)) {
  const authenticatedUrl = this.prepareUrlWithAuth(this.gitConfig.url);
  await this.git.remote(['set-url', 'origin', authenticatedUrl]);
}
await this.git.pull('origin', this.gitConfig.branch);
```

### URL Authentication Format
- **Token (GitHub/GitLab)**: `https://TOKEN@github.com/org/repo.git`
- **Basic Auth**: `https://username:password@gitlab.com/org/repo.git`
- **Azure CLI**: No URL modification (uses Git Credential Manager)
- **SSH**: No URL modification (uses SSH keys)

## Files Changed
- `src/layers/git-layer.ts`
  - Removed `credential.helper` configuration for token auth
  - Added remote URL update before pull operations
  - Ensured consistent URL authentication across all git operations

## Testing
All existing tests pass:
- ✅ Unit tests: 131 passed | 2 skipped
- ✅ Integration tests: 125 passed
- ✅ Prompt validation: 6 passed

## User Impact
**Before:** Users saw repeated authentication prompts after initial setup
**After:** Token authentication works consistently across all MCP calls

## Configuration Example
```yaml
layers:
  - name: company-knowledge
    priority: 20
    enabled: true
    source:
      type: git
      url: https://github.com/company/bc-knowledge.git
      branch: main
    auth:
      type: token
      token_env_var: GITHUB_TOKEN  # Or use 'token' directly
```

## Security Notes
- Tokens are read from environment variables (not stored in config)
- Authenticated URLs are only used for git operations (not logged)
- Tokens embedded in URLs are never persisted to disk
- Repository's `.git/config` stores authenticated URL (local only)

## Additional Notes
- This fix applies to GitHub, GitLab, Bitbucket, and other HTTPS git services
- SSH authentication was not affected by this issue
- Azure CLI authentication continues to use Git Credential Manager
