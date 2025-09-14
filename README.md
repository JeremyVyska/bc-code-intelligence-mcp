# Business Central Knowledge Base MCP Server

Model Context Protocol server providing intelligent access to Business Central knowledge through a layered architecture system.

## Features
- **Layered Knowledge System**: Embedded → Company → Team → Project overrides
- **7+ MCP Tools**: find_bc_topics, get_bc_knowledge, methodology workflows, etc.
- **Zero Configuration**: Works immediately with embedded knowledge
- **Extensible**: Support for git repositories, company standards, project overrides

## Quick Start
```bash
npm install
npm run build
npm start
```

## Architecture
- **Layer Resolution**: Multi-source knowledge with intelligent override system
- **Version Awareness**: BC version compatibility filtering
- **Specialist System**: AI persona management with domain expertise
- **Pure TypeScript**: Clean separation from knowledge content

## Knowledge Source
Knowledge content is linked via git submodule from [bc-knowledgebase](../bc-knowledgebase).