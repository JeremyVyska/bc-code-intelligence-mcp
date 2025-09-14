# Contributing to Business Central Knowledge Base MCP Server

## Overview
This repository contains the MCP server implementation providing intelligent access to BC knowledge through a layered architecture.

## Development Standards

### Code Quality
- **TypeScript**: Strict mode enabled, no any types
- **Testing**: Comprehensive unit tests for all layer resolution logic
- **Performance**: Sub-100ms response times for knowledge queries
- **MCP Compliance**: Full Model Context Protocol specification adherence

### Architecture Principles
- **Layer Integrity**: Maintain clean layer resolution hierarchy
- **Service Separation**: Keep services focused and modular
- **Interface Stability**: Preserve MCP tool signatures for backward compatibility
- **Extensibility**: Design for future layer source types (git, HTTP, etc.)

## Development Setup
```bash
git clone <repository-url>
cd bc-knowledgebase-mcp
git submodule update --init --recursive  # Initialize knowledge submodule
npm install
npm run build
npm run test
```

## Submission Process
1. Fork the repository
2. Create feature branch from main
3. Implement changes with comprehensive tests
4. Ensure all existing MCP tools continue functioning
5. Verify layer resolution logic remains intact
6. Submit pull request with clear description

## Testing Requirements
- **Unit Tests**: All layer resolution logic
- **Integration Tests**: Complete MCP tool workflows
- **Performance Tests**: Response time validation
- **Compatibility Tests**: Existing tool functionality preserved

## Code Review Criteria
- TypeScript builds without errors or warnings
- All tests pass (unit, integration, performance)
- MCP tools maintain backward compatibility
- Layer resolution system integrity preserved
- Performance benchmarks maintained

## Common Development Areas
- **New MCP Tools**: Adding BC knowledge access capabilities
- **Layer Sources**: Supporting new knowledge source types
- **Performance**: Optimizing knowledge search and caching
- **Version Awareness**: BC version compatibility features
- **Specialist System**: AI persona management enhancements