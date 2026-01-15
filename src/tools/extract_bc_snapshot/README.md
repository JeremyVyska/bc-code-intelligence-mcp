# Extract BC Snapshot Tool

## Overview

The `extract_bc_snapshot` tool extracts Business Central snapshot (.snap) files for debugging analysis. Snapshots are ZIP archives containing debug traces (.mdc files) and AL source code (.al files) captured during snapshot debugging sessions.

## What Are BC Snapshots?

Business Central snapshot files (.snap) are ZIP archives that contain:
- **Debug Trace Files (.mdc)**: Sequential execution steps with call stacks, variable values, and record data
- **AL Source Files (.al)**: The actual AL code that was executing (with URL-encoded filenames)
- **Version Information**: BC platform version and app metadata

Snapshots enable offline debugging analysis without requiring a live debugger connection.

## Tool Usage

### Basic Extraction

```typescript
{
  "name": "extract_bc_snapshot",
  "arguments": {
    "snapshot_path": "C:/snapshots/error-investigation.snap"
  }
}
```

### Output

The tool returns:
1. **Temporary directory path** - Where files were extracted
2. **Metadata** - Count of MDC and AL files, BC version, app info
3. **File tree** - Visual representation of contents
4. **Notable files** - Largest MDC file and decoded AL filenames

### Example Response

```
✅ BC Snapshot Extracted Successfully

📁 Temporary Directory: C:\Users\...\AppData\Local\Temp\bc-snapshot-abc123

## 📊 Snapshot Summary

- Debug Trace Files: 579 .mdc files
- AL Source Files: 12 .al files
- BC Version: 26.5.38752.42305

### 📦 Application Info

- Base Application (Microsoft)
  - Version: 26.5.38752.42305
  - App ID: 437dbf0e84ff417a965ded2bb9650972

## 📂 File Structure

📁 bc-snapshot-abc123
├─ 📊 Debug Traces (579 .mdc files)
│  ├─ 0.mdc
│  ├─ ... (577 more files)
│  └─ 578.mdc
├─ 📄 AL Source Files (12 files)
│  ├─ CodeUnit%6500.al (codeunit 6500)
│  ├─ Table%27.al (table 27)
│  └─ ... (10 more files)

## 🔍 Key Files

- Largest Debug Trace: 578.mdc (often contains the most interesting debugging data)

## 💡 Next Steps

1. Read debug traces: Use file reading tools on .mdc files
2. Examine AL source: Check the .al files to see code that was executing
3. Start with largest .mdc: 578.mdc typically has key execution data
4. Look for patterns: Search for call stacks, variable values, and execution flow
```

## Integration with Dean's Knowledge

Dean Debug has specific knowledge about snapshot analysis:
- `snapshot-debugging-structure.md` - File structure and extraction process
- `snapshot-analysis-workflow.md` - Systematic analysis workflow
- `mdc-file-format.md` - Understanding .mdc file contents

Once extracted, Dean can guide agents through:
1. Understanding the scope (file counts, objects involved)
2. Finding key execution points (largest MDC files)
3. Analyzing call stacks and variable values
4. Correlating MDC line numbers with AL source code

## Agent Workflow

```typescript
// 1. Extract the snapshot
const extraction = await extract_bc_snapshot({
  snapshot_path: "/path/to/snapshot.snap"
});

// 2. Read the largest MDC file (often most interesting)
const tempDir = extraction.temp_directory;
const largestMdc = extraction.notable_files.largest_mdc;

// 3. Use standard file reading tools
const mdcContent = await read_file({
  filePath: `${tempDir}/${largestMdc}`,
  startLine: 1,
  endLine: 100
});

// 4. Search for specific patterns
const callStacks = grep_search({
  query: "Call Stack",
  includePattern: `${tempDir}/**/*.mdc`
});

// 5. Examine related AL source
const alFiles = extraction.notable_files.al_files;
// Read specific AL files to see the code that was executing
```

## Implementation Details

### Service Layer
- `SnapshotService` handles ZIP extraction using Node's `unzipper` package
- Extracts to system temp directory (`os.tmpdir()`)
- Parses metadata from MDC and version files
- Decodes URL-encoded AL filenames

### File Decoding
AL files use URL encoding for special characters:
- `CodeUnit%6500.al` → Codeunit 6500
- `Table%27.al` → Table 27
- `Page%7324.al` → Page 7324

The service automatically decodes these and extracts object type/ID.

### Temp Directory Management
- Extracted files persist in system temp directory
- Path returned to agent for file access
- Cleanup can be done manually or via system temp cleanup
- Consider adding a cleanup tool if needed

## Testing

Test the extraction manually:

```bash
tsx dev-tools/test-snapshot-extraction.ts /path/to/your.snap
```

## Future Enhancements

Potential additions (not in v1):
- `analyze_snapshot_structure` tool for automated analysis
- Pattern detection (find errors, slow operations, etc.)
- Call stack visualization
- Variable value extraction
- Correlation between MDC and AL files
