# Company Layer Setup Guide

Complete guide for adding your company's Business Central knowledge and coding standards to the BC Code Intelligence MCP server.

---

## Table of Contents
- [Quick Start](#quick-start)
- [Step-by-Step Setup](#step-by-step-setup)
- [Repository Structure](#repository-structure)
- [Authentication Methods](#authentication-methods)
- [Real-World Examples](#real-world-examples)
- [Testing Your Setup](#testing-your-setup)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

**3 steps to add your company layer:**

### 1. Create Configuration Directory
```powershell
# Windows (PowerShell)
mkdir $env:USERPROFILE\.bc-code-intel

# macOS/Linux (Bash)
mkdir ~/.bc-code-intel
```

### 2. Create Configuration File
Create `config.yaml` in the directory above:

**Windows:** `C:\Users\YourUsername\.bc-code-intel\config.yaml`  
**macOS/Linux:** `~/.bc-code-intel/config.yaml`

### 3. Add Your Configuration
```yaml
layers:
  - name: embedded
    priority: 0
    source:
      type: embedded
    enabled: true

  - name: company
    priority: 20
    source:
      type: git
      url: "https://github.com/yourcompany/bc-knowledge"
      branch: main
    auth:
      type: token
      token_env_var: GITHUB_TOKEN
    enabled: true
```

Done! The MCP server will **automatically discover and load** your company knowledge at startup - no additional setup needed.

**Note:** Company layers are loaded globally for all workspaces. Once configured in `~/.bc-code-intel/config.yaml`, your company standards are available everywhere!

---

## Step-by-Step Setup

### Step 1: Prepare Your Knowledge Repository

Your company Git repository should follow this structure:

```
your-company-bc-knowledge/
├── domains/              ← OR use "topics/" (both work!)
│   ├── naming-conventions.md
│   ├── error-handling-standards.md
│   ├── company-patterns.md
│   └── security-guidelines.md
├── specialists/          ← Optional: company experts
│   └── company-architect.md
└── methodologies/        ← Optional: company workflows
    └── code-review-process.md
```

**Important:** The system supports **both** `domains/` and `topics/` directory names!

#### Example Topic File (`domains/naming-conventions.md`):

```markdown
---
topic_id: company-naming-conventions
title: Company AL Naming Conventions
category: standards
bc_version: "14.0+"
priority: high
tags: [naming, standards, conventions]
---

# Company AL Naming Conventions

Our company standards for AL object naming...

## Tables
- Prefix: `CMP` (Company)
- Format: `CMP <Object Name>`
- Example: `CMP Customer Order`

## Codeunits
- Suffix with purpose: `Mgt`, `Handler`, `Integration`
- Example: `CMP Order Mgt.`
```

### Step 2: Choose Your Configuration Location

**Option A: User-level (Recommended)**
- Location: `~/.bc-code-intel/config.yaml`
- Applies to: All AL projects for your user account
- Best for: Company standards that apply everywhere

**Option B: Project-level**
- Location: `./bc-code-intel-config.yaml` (workspace root)
- Applies to: Only this specific AL project
- Best for: Project-specific overrides

**Option C: Environment Variable**
- Set: `BC_CODE_INTEL_CONFIG_PATH=/path/to/config.yaml`
- Applies to: Current environment/session
- Best for: CI/CD or shared environments

### Step 3: Configure Authentication

Choose the authentication method that matches your Git provider:

#### GitHub with Personal Access Token

1. Create token: https://github.com/settings/tokens (needs `repo` scope)
2. Set environment variable:
   ```powershell
   # Windows (PowerShell) - persistent
   [System.Environment]::SetEnvironmentVariable('GITHUB_TOKEN', 'ghp_yourtoken', 'User')
   
   # macOS/Linux (Bash) - add to ~/.bashrc or ~/.zshrc
   export GITHUB_TOKEN="ghp_yourtoken"
   ```
3. Configure:
   ```yaml
   auth:
     type: token
     token_env_var: GITHUB_TOKEN
   ```

#### Azure DevOps with Azure CLI

1. Install Azure CLI: https://learn.microsoft.com/cli/azure/install-azure-cli
2. Login once:
   ```powershell
   az login
   ```
3. Configure:
   ```yaml
   auth:
     type: az_cli
   ```

That's it! Azure CLI handles authentication automatically.

#### GitLab with Personal Access Token

1. Create token: https://gitlab.com/-/profile/personal_access_tokens (needs `read_repository` scope)
2. Set environment variable:
   ```bash
   export GITLAB_TOKEN="glpat-yourtoken"
   ```
3. Configure:
   ```yaml
   auth:
     type: token
     token_env_var: GITLAB_TOKEN
   ```

#### SSH Key Authentication

1. Ensure SSH key is added to Git provider
2. Add key to ssh-agent:
   ```bash
   ssh-add ~/.ssh/id_rsa
   ```
3. Configure:
   ```yaml
   source:
     url: "git@github.com:yourcompany/bc-knowledge.git"  # SSH URL!
   auth:
     type: ssh_key
     ssh_key_path: "~/.ssh/id_rsa"
   ```

### Step 4: Complete Configuration File

Create your full `~/.bc-code-intel/config.yaml`:

```yaml
# BC Code Intelligence - Company Configuration
# Location: ~/.bc-code-intel/config.yaml

layers:
  # Required: Embedded base knowledge
  - name: embedded
    priority: 0
    source:
      type: embedded
      path: ./embedded-knowledge
    enabled: true

  # Company Layer: Your standards and guidelines
  - name: company
    priority: 20
    source:
      type: git
      url: "https://github.com/yourcompany/bc-knowledge-base"
      branch: main
      subpath: ""  # Optional: subdirectory within repo
    auth:
      type: token
      token_env_var: GITHUB_TOKEN
    enabled: true
    cache_duration: "2h"  # How often to check for updates

  # Optional: Project-specific overrides
  - name: project
    priority: 100
    source:
      type: local
      path: ./bc-code-intel-overrides
    enabled: true

# Optional: Advanced settings
resolution:
  strategy: best_match
  conflict_resolution: priority_wins
  enable_fallback: true

cache:
  strategy: moderate
  max_size_mb: 100
  background_refresh: true
```

---

## Repository Structure

### Minimum Required Structure

```
your-repo/
└── domains/              ← At least one topic file
    └── your-topic.md
```

OR

```
your-repo/
└── topics/               ← "topics/" also works!
    └── your-topic.md
```

### Recommended Structure

```
your-repo/
├── domains/              ← Your knowledge topics
│   ├── architecture/
│   │   ├── layer-patterns.md
│   │   └── extension-design.md
│   ├── coding-standards/
│   │   ├── naming-conventions.md
│   │   ├── error-handling.md
│   │   └── code-documentation.md
│   └── security/
│       ├── permission-sets.md
│       └── data-protection.md
├── specialists/          ← Optional: custom experts
│   └── company-architect.md
└── methodologies/        ← Optional: workflows
    └── review-process.md
```

### Subdirectory Support

If your knowledge is nested in a subdirectory:

```
your-repo/
├── docs/
├── src/
└── bc-knowledge/         ← Knowledge is here
    ├── domains/
    ├── specialists/
    └── methodologies/
```

Configure with `subpath`:
```yaml
source:
  type: git
  url: "https://github.com/yourcompany/repo"
  subpath: "bc-knowledge"  # Points to subdirectory
```

---

## Authentication Methods

### Comparison Table

| Method | Best For | Setup Complexity | Security |
|--------|----------|------------------|----------|
| `az_cli` | Azure DevOps | ⭐ Easiest | ⭐⭐⭐ Excellent |
| `token` | GitHub/GitLab | ⭐⭐ Easy | ⭐⭐ Good |
| `ssh_key` | Any Git provider | ⭐⭐⭐ Moderate | ⭐⭐⭐ Excellent |
| `basic` | Self-hosted | ⭐⭐ Easy | ⭐ Limited |

### Azure CLI (Recommended for Azure DevOps)

**Why:** No tokens to manage, automatic credential refresh, supports MFA.

```yaml
auth:
  type: az_cli
```

**Prerequisites:**
```powershell
# Install Azure CLI (Windows)
winget install Microsoft.AzureCLI

# Login (opens browser, supports MFA)
az login

# Verify
az account show
```

### Personal Access Token

**Why:** Works with all Git providers, easy to rotate.

```yaml
auth:
  type: token
  token_env_var: GITHUB_TOKEN  # or GITLAB_TOKEN, etc.
```

**Token Scopes Needed:**
- **GitHub:** `repo` (full control of private repositories)
- **GitLab:** `read_repository`
- **Azure DevOps:** `Code (Read)`

### SSH Key

**Why:** Most secure, no tokens in environment variables.

```yaml
source:
  url: "git@github.com:yourcompany/repo.git"  # SSH URL format!
auth:
  type: ssh_key
  ssh_key_path: "~/.ssh/id_rsa"
```

**Setup:**
```bash
# Generate key (if needed)
ssh-keygen -t rsa -b 4096 -C "your_email@company.com"

# Add to ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_rsa

# Add public key to Git provider
cat ~/.ssh/id_rsa.pub
```

---

## Real-World Examples

### Example 1: GitHub Company Knowledge

```yaml
layers:
  - name: embedded
    priority: 0
    source:
      type: embedded
    enabled: true

  - name: acme-standards
    priority: 20
    source:
      type: git
      url: "https://github.com/acme-corp/bc-standards"
      branch: main
    auth:
      type: token
      token_env_var: GITHUB_TOKEN
    enabled: true
```

**Environment setup:**
```powershell
$env:GITHUB_TOKEN = "ghp_abc123..."  # Session
[Environment]::SetEnvironmentVariable('GITHUB_TOKEN', 'ghp_abc123...', 'User')  # Persistent
```

### Example 2: Azure DevOps with Subdirectory

```yaml
layers:
  - name: embedded
    priority: 0
    source:
      type: embedded
    enabled: true

  - name: contoso-guidelines
    priority: 20
    source:
      type: git
      url: "https://dev.azure.com/contoso/BCProjects/_git/Guidelines"
      branch: master
      subpath: "bc-knowledge"  # Knowledge is in bc-knowledge/ subdirectory
    auth:
      type: az_cli
    enabled: true
```

**Prerequisites:**
```powershell
az login
```

### Example 3: Multiple Company Layers

```yaml
layers:
  - name: embedded
    priority: 0
    source:
      type: embedded
    enabled: true

  # Corporate standards (lower priority = loaded first)
  - name: corporate
    priority: 10
    source:
      type: git
      url: "https://github.com/megacorp/bc-corporate-standards"
      branch: main
    auth:
      type: token
      token_env_var: CORPORATE_TOKEN
    enabled: true

  # Division standards (higher priority = overrides corporate)
  - name: division
    priority: 20
    source:
      type: git
      url: "https://github.com/megacorp/bc-division-emea"
      branch: main
    auth:
      type: token
      token_env_var: CORPORATE_TOKEN
    enabled: true

  # Project overrides (highest priority = overrides everything)
  - name: project
    priority: 100
    source:
      type: local
      path: ./bc-code-intel-overrides
    enabled: true
```

### Example 4: GitLab with SSH

```yaml
layers:
  - name: embedded
    priority: 0
    source:
      type: embedded
    enabled: true

  - name: company
    priority: 20
    source:
      type: git
      url: "git@gitlab.com:your-company/bc-knowledge.git"  # SSH URL
      branch: main
    auth:
      type: ssh_key
      ssh_key_path: "~/.ssh/id_ed25519"
    enabled: true
```

---

## Testing Your Setup

### 1. Verify Configuration Discovery

```bash
# Test config loading (from MCP server directory)
npx tsx -e "
import { ConfigurationLoader } from './src/config/config-loader.js';
const config = await ConfigurationLoader.loadConfiguration();
console.log('✅ Configuration loaded');
console.log('📚 Layers:', config.layers.map(l => ({ name: l.name, priority: l.priority })));
"
```

Expected output:
```
✅ Configuration loaded
📚 Layers: [
  { name: 'embedded', priority: 0 },
  { name: 'company', priority: 20 }
]
```

### 2. Test Layer Initialization

Create `test-company-layer.ts`:

```typescript
import { ConfigurationLoader } from './src/config/config-loader.js';
import { LayerService } from './src/layers/layer-service.js';

async function testCompanyLayer() {
  console.log('🧪 Testing Company Layer\n');

  // Load configuration
  const config = await ConfigurationLoader.loadConfiguration();
  console.log('✅ Config loaded from:', config.sources?.[0] || 'default');
  console.log('📚 Layers:', config.layers.map(l => l.name).join(', '));

  // Initialize layers
  const layerService = new LayerService(config);
  await layerService.initialize();

  // Get statistics
  const stats = layerService.getStatistics();
  console.log('\n📊 Layer Statistics:');
  for (const [name, stat] of Object.entries(stats.layers)) {
    console.log(`   ${name}: ${stat.topics} topics, ${stat.load_time_ms}ms`);
  }

  console.log(`\n✅ Total topics: ${stats.total_topics}`);
}

testCompanyLayer().catch(console.error);
```

Run:
```bash
npx tsx test-company-layer.ts
```

### 3. Query Company Topics

```typescript
// In your test file or MCP client
const results = await layerService.searchTopics('company naming', {
  bc_version: '23.0'
});

console.log('Found topics:', results.map(r => ({
  id: r.topic.topic_id,
  title: r.topic.title,
  layer: r.layer
})));
```

---

## Troubleshooting

### Configuration Not Loading

**Problem:** MCP server doesn't find your config file.

**Solution:**
1. Verify file location:
   ```powershell
   # Windows
   Test-Path "$env:USERPROFILE\.bc-code-intel\config.yaml"
   
   # macOS/Linux
   ls -la ~/.bc-code-intel/config.yaml
   ```

2. Check YAML syntax:
   ```bash
   # Use a YAML validator or:
   npx js-yaml ~/.bc-code-intel/config.yaml
   ```

3. Verify file permissions:
   ```bash
   # Should be readable by current user
   ls -l ~/.bc-code-intel/config.yaml
   ```

### Git Authentication Failing

**Problem:** Cannot clone/pull from Git repository.

**Solutions by auth type:**

**Token authentication:**
```powershell
# Windows - Check if token is set
echo $env:GITHUB_TOKEN

# If empty, set it:
$env:GITHUB_TOKEN = "ghp_yourtoken"

# Make it persistent:
[Environment]::SetEnvironmentVariable('GITHUB_TOKEN', 'ghp_yourtoken', 'User')

# macOS/Linux
echo $GITHUB_TOKEN
export GITHUB_TOKEN="ghp_yourtoken"  # Add to ~/.bashrc or ~/.zshrc
```

**Azure CLI authentication:**
```powershell
# Verify Azure CLI is installed
az --version

# Check if logged in
az account show

# If not logged in:
az login

# Test access to Azure DevOps
az devops project list --org https://dev.azure.com/YourOrg
```

**SSH authentication:**
```bash
# Test SSH connection
ssh -T git@github.com
# or
ssh -T git@gitlab.com

# Check if key is loaded
ssh-add -l

# If not loaded:
ssh-add ~/.ssh/id_rsa
```

### No Topics Loading from Company Layer

**Problem:** Company layer initializes but loads 0 topics.

**Solution:**

1. **Check repository structure:**
   ```powershell
   # Clone repo manually to inspect structure
   git clone <your-repo-url> test-clone
   cd test-clone
   ls -R
   ```

   Verify you have `domains/` OR `topics/` directory with `.md` files.

2. **Verify branch name:**
   ```powershell
   # Check what branches exist
   git branch -a
   ```

   Common issue: Config says `main` but repo uses `master` (or vice versa).

3. **Check subpath configuration:**
   If your knowledge is in a subdirectory, add `subpath`:
   ```yaml
   source:
     type: git
     url: "..."
     subpath: "bc-knowledge"  # Path to directory containing domains/
   ```

4. **Enable debug logging:**
   ```yaml
   developer:
     debug_layers: true
     log_level: debug
   ```

### Topics Not Overriding

**Problem:** Company topics don't override embedded topics.

**Solution:**

1. **Check topic IDs match:**
   ```yaml
   # Both files need same topic_id to override
   # embedded-knowledge/domains/performance/caching.md
   ---
   topic_id: al-caching-best-practices
   ---
   
   # your-repo/domains/performance/caching.md
   ---
   topic_id: al-caching-best-practices  # ← Must match!
   ---
   ```

2. **Verify priorities:**
   ```yaml
   layers:
     - name: embedded
       priority: 0      # Lower number
     - name: company
       priority: 20     # Higher number = wins in override
   ```

3. **Test resolution:**
   ```typescript
   const resolution = await layerService.resolveTopicLayers('al-caching-best-practices');
   console.log('Topic resolved from:', resolution.map(r => r.layer));
   // Should show: ['company', 'embedded'] - company wins
   ```

### Cache Issues

**Problem:** Changes to Git repo not appearing.

**Solution:**

1. **Clear Git cache:**
   ```powershell
   # Delete cached repositories
   Remove-Item -Recurse -Force .bckb-cache/git-repos
   ```

2. **Force refresh:**
   ```yaml
   cache:
     strategy: aggressive  # Always fetch latest
     ttl:
       git: "5m"  # Check every 5 minutes
   ```

3. **Manual git pull:**
   ```powershell
   # Find cached repo
   cd .bckb-cache/git-repos/<hash>
   git pull
   ```

---

## Best Practices

### 1. Start Small
Begin with a few essential topics:
- Naming conventions
- Error handling standards
- One company-specific pattern

Add more as you validate the setup works.

### 2. Use User-Level Config
Place config at `~/.bc-code-intel/config.yaml` so it applies to all your AL projects automatically.

### 3. Document Your Standards
Include a README in your knowledge repo explaining:
- How to contribute new topics
- Topic structure requirements
- Review process for changes

### 4. Version Control Your Config
For team environments, commit a template config file to your AL project repo:
```
your-al-project/
├── .vscode/
├── src/
└── .bc-code-intel-config.template.yaml  ← Team members copy to config.yaml
```

### 5. Test Before Deploying
Always test new topics in a local layer first:
```yaml
- name: testing
  priority: 50
  source:
    type: local
    path: ./test-topics
  enabled: true
```

### 6. Use Semantic Versioning
Tag your knowledge repo with versions:
```bash
git tag -a v1.0.0 -m "Initial company standards"
git push --tags
```

Pin to specific versions in config:
```yaml
source:
  url: "..."
  branch: "v1.0.0"  # Use tag instead of branch for stability
```

---

## Next Steps

1. ✅ **Set up your configuration** following this guide
2. 📚 **Create your first company topic** using the structure above
3. 🧪 **Test with the verification scripts** to ensure everything loads
4. 🚀 **Start using company knowledge** in your MCP clients (Claude, Copilot, etc.)
5. 📖 **Share this guide** with your team for consistent setup

For more information:
- [Main README](../README.md) - Full MCP server documentation
- [Configuration Examples](../bc-code-intel-config.example.yaml) - All config options
- [Example Topics](../embedded-knowledge/domains/) - Reference topic structure

---

**Questions or issues?** Open an issue on GitHub with the `company-layer` label.
