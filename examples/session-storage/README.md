# BC Code Intelligence Session Storage Configuration Examples

This directory contains example configuration files showing how to enable persistent session storage in BC Code Intelligence.

## Default Behavior (No Configuration)

By default, BC Code Intelligence uses **in-memory session storage**:
- ✅ No setup required
- ✅ Sessions are private and temporary
- ❌ Sessions are lost when the server restarts
- ❌ No session sharing between team members

## Local File-Based Storage

Enable persistent sessions on your local machine:

### Example: `bc-code-intel-config.yaml` (Local User)

```yaml
# BC Code Intelligence Configuration
# Place in your project root or user config directory

# Session storage configuration
sessionStorage:
  type: "file"
  config:
    # Store sessions in user home directory (default)
    # directory: "~/.bc-code-intel/sessions"
    
    # Optional: Custom directory for sessions
    directory: "./sessions"
  
  # Retention settings
  retention:
    maxAge: 30              # Keep sessions for 30 days
    maxSessions: 100        # Max 100 sessions per user
    autoCleanup: true       # Automatically clean expired sessions
  
  # Privacy settings
  privacy:
    includeMessages: true   # Store full conversation history
    includeCode: true       # Store code snippets discussed
    includeFiles: true      # Store file references
    anonymizeContent: false # Keep content as-is

# Other configuration...
layers:
  - name: "embedded"
    priority: 0
    source:
      type: "embedded"
    enabled: true
```

## Shared Team Storage

Enable session sharing for your team:

### Example: `bc-code-intel-config.yaml` (Team Shared)

```yaml
# BC Code Intelligence Configuration
# Team-level configuration for shared session storage

sessionStorage:
  type: "file"
  config:
    # Shared network directory for team sessions
    directory: "//teamserver/bc-code-intel/sessions"
    
    # Or use a shared local directory
    # directory: "/shared/team/bc-sessions"
  
  retention:
    maxAge: 90              # Keep sessions for 90 days (longer for teams)
    maxSessions: 500        # Higher limit for team use
    autoCleanup: true
  
  privacy:
    includeMessages: true
    includeCode: false      # Don't store sensitive code in shared storage
    includeFiles: false     # Don't store file paths in shared storage
    anonymizeContent: true  # Anonymize for team privacy

layers:
  - name: "embedded"
    priority: 0
    source:
      type: "embedded"
    enabled: true
  
  - name: "team-standards"
    priority: 200
    source:
      type: "git"
      url: "https://github.com/yourcompany/bc-standards"
      branch: "main"
    enabled: true
```

## Company-Wide Configuration

Enterprise-level session storage:

### Example: `bc-code-intel-config.yaml` (Company)

```yaml
# BC Code Intelligence Configuration
# Company-wide configuration with compliance settings

sessionStorage:
  type: "file"
  config:
    # Centralized company storage with compliance
    directory: "/company/compliance/bc-code-intel/sessions"
  
  retention:
    maxAge: 365             # Keep sessions for 1 year (compliance)
    maxSessions: 1000       # Enterprise limit
    autoCleanup: true
  
  privacy:
    includeMessages: true   # Full history for audit trails
    includeCode: false      # Security: no code in shared storage
    includeFiles: false     # Security: no file paths
    anonymizeContent: true  # Privacy compliance

layers:
  - name: "embedded"
    priority: 0
    source:
      type: "embedded"
    enabled: true
  
  - name: "company-standards"
    priority: 100
    source:
      type: "git"
      url: "https://github.com/yourcompany/bc-enterprise-knowledge"
      branch: "main"
    enabled: true
  
  - name: "team-overrides"
    priority: 200
    source:
      type: "local"
      path: "./team-bc-overrides"
    enabled: true
```

## Configuration Placement

### Option 1: Project-Level Configuration
Place `bc-code-intel-config.yaml` in your project root:
```
your-project/
├── bc-code-intel-config.yaml  ← Project configuration
├── src/
└── ...
```

### Option 2: User-Level Configuration
Place in your user directory:
```
~/.bc-code-intel/
├── config.yaml               ← User configuration
└── sessions/                 ← Default session storage
    ├── session-123.json
    └── ...
```

### Option 3: Team/Company Configuration
Use layer system to distribute via git:
```
team-standards-repo/
├── bc-code-intel-config.yaml ← Team configuration
├── specialists/              ← Team-specific specialists
└── domains/                  ← Team knowledge overrides
```

## Storage Types Supported

### ✅ `memory` (Default)
- No persistence
- Sessions lost on restart
- Best for: Development, privacy-sensitive work

### ✅ `file` (Available)
- JSON file-based storage
- Local or shared directories
- Best for: Persistent sessions, team collaboration

### 🔜 `database` (Future)
- SQL database storage
- Enterprise scalability
- Best for: Large organizations, analytics

### 🔜 `mcp` (Future)
- Store via MCP protocol
- Integration with other tools
- Best for: Custom enterprise integrations

## Security Considerations

### Local Storage
```yaml
sessionStorage:
  config:
    directory: "~/.bc-code-intel/sessions"  # Private user directory
  privacy:
    includeCode: true      # Safe for local storage
    anonymizeContent: false # No need to anonymize locally
```

### Shared Storage
```yaml
sessionStorage:
  config:
    directory: "/shared/team/sessions"
  privacy:
    includeCode: false     # Don't store sensitive code
    includeFiles: false    # Don't store file paths
    anonymizeContent: true # Anonymize for team privacy
```

### Compliance Storage
```yaml
sessionStorage:
  retention:
    maxAge: 2555           # 7 years for compliance
  privacy:
    includeMessages: true  # Full audit trail
    includeCode: false     # Security compliance
    anonymizeContent: true # GDPR compliance
```

## Getting Started

1. **Choose your storage type**: Start with `file` for persistence
2. **Pick your directory**: Local for personal use, shared for teams
3. **Set retention policies**: Consider compliance requirements
4. **Configure privacy**: Balance functionality with security
5. **Test the configuration**: Restart the server to apply changes

Need help? Check the main BC Code Intelligence documentation or create an issue in the repository.