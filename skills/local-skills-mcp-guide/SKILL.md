---
name: local-skills-mcp-guide
description: "Repository implementation guide for the local-skills-mcp codebase. Use when asked: how src/index.ts and src/skill-loader.ts work together; where MCP tool handlers are defined and registered; how getAllSkillsDirectories priority and override behavior works; how local-skills-mcp discovers skills and merges metadata across directories; where validate_skill and evaluate_skill are implemented in this repository; or how integration tests are structured in this local-skills-mcp project."
---

You are an expert guide specifically for the **Local Skills MCP server repository** (kdpa-llc/local-skills-mcp).

Your task is to help users understand this specific MCP server's repository structure, implementation details, and how to navigate and work with the Local Skills MCP codebase.

## What is Local Skills MCP?

Local Skills MCP is a universal Model Context Protocol (MCP) server that enables any LLM or AI agent to access expert skills from the local filesystem. It uses the SKILL.md format with YAML frontmatter and implements lazy loading for context efficiency.

**Repository**: https://github.com/kdpa-llc/local-skills-mcp

## Local Skills MCP Project Structure

```
local-skills-mcp/
├── src/                    # TypeScript source code
│   ├── index.ts           # Main MCP server implementation
│   ├── skill-loader.ts    # Skill loading and aggregation logic
│   └── types.ts           # TypeScript type definitions
├── skills/                # Example skills included with the server
│   ├── local-skills-mcp-guide/
│   ├── skill-creator/
│   └── mcp-setup-helper/
├── dist/                  # Compiled JavaScript output (generated)
├── package.json           # npm package configuration
├── tsconfig.json          # TypeScript compiler configuration
├── README.md              # Comprehensive project documentation
├── QUICK_START.md         # Quick setup guide
├── CONTRIBUTING.md        # Contribution guidelines
├── CHANGELOG.md           # Version history
├── SECURITY.md            # Security policy
└── LICENSE                # MIT License
```

## Key Components of Local Skills MCP

### 1. MCP Server Implementation (src/index.ts)

**What it does**: Core MCP server that implements the Model Context Protocol

**Key responsibilities**:

- Initializes the MCP server using the `@modelcontextprotocol/sdk`
- Exposes `get_skill`, `validate_skill`, and `evaluate_skill` tools to MCP clients
- Handles skill discovery by aggregating skill metadata
- Dynamically updates tool descriptions with current available skills
- Implements request handlers for tool invocation
- Manages server lifecycle and stdio transport

**Important functions**:

- Server initialization and tool registration
- Dynamic tool description generation (includes skill list)
- Skill invocation handler

### 2. Skill Loading System (src/skill-loader.ts)

**What it does**: Multi-directory skill aggregation engine

**Key responsibilities**:

- Discovers skills from multiple configured directories:
  - `~/.claude/skills/` (personal/Claude-compatible skills)
  - `./.claude/skills/` (project-local skills)
  - `./skills` (Local Skills MCP repository example skills)
  - `$SKILLS_DIR` (user-defined custom directory)
- Parses SKILL.md files with YAML frontmatter
- Validates skill format (name, description requirements)
- Implements skill caching for performance
- Resolves skill name conflicts (later directories override earlier)

**Important functions**:

- `loadSkills()` - Main aggregation function
- YAML frontmatter parsing
- Skill validation logic

### 3. Type Definitions (src/types.ts)

**What it does**: TypeScript type system for Local Skills MCP

**Defines**:

- `Skill` interface (metadata and content)
- MCP tool definitions
- Configuration types

## How Local Skills MCP Works

### Startup Sequence

1. Server starts via stdio transport
2. Skill loader aggregates skills from all configured directories
3. Skills are validated and cached in memory
4. MCP server initializes and registers the skill tools
5. `get_skill` description is generated with current skill list and metadata

### Skill Discovery (Lazy Loading)

1. MCP client queries available tools
2. Local Skills MCP returns a tool list (including `get_skill`)
3. `get_skill` description includes names and brief descriptions of all available skills
4. **Context efficiency**: Only ~50 tokens per skill at this stage

### Skill Invocation

1. User requests a skill (e.g., "use the skill-creator skill")
2. AI invokes `get_skill` tool with skill name parameter
3. Local Skills MCP loads full skill content from cache
4. Full skill instructions returned to AI
5. AI applies the expert instructions

### Skill Aggregation Priority

Skills are loaded in this order (later overrides earlier):

1. `~/.claude/skills/`
2. `./.claude/skills/`
3. `./skills`
4. `$SKILLS_DIR`

## SKILL.md Format Used by Local Skills MCP

Each skill must be named `SKILL.md` with YAML frontmatter:

```markdown
---
name: skill-name # Required: lowercase, hyphens, max 64 chars
description: Brief desc... # Required: max 1024 chars, include trigger keywords
---

Skill instructions in Markdown format...
```

**Validation rules** (enforced by skill-loader.ts):

- File must be named exactly `SKILL.md`
- Must have `---` delimited YAML frontmatter
- `name` field is required and must be valid
- `description` field is required (max 1024 chars)

## Design Principles of Local Skills MCP

1. **Lazy Loading**: Only load full skill content when needed (context window efficiency)
2. **Universal Compatibility**: Works with any MCP-compatible client (Claude, Cline, custom agents)
3. **Multi-Source Aggregation**: Combine skills from personal, project, and custom directories
4. **Zero Configuration**: Works immediately with standard skill directories
5. **Progressive Disclosure**: Show minimal info upfront, load details on-demand
6. **Focused Tool Surface**: `get_skill` for loading, plus validation/evaluation helper tools

## Common Questions About Local Skills MCP

**Q: Where does Local Skills MCP store skills?**
A: It aggregates from multiple locations: `~/.claude/skills/`, `./.claude/skills/`, `./skills`, and `$SKILLS_DIR`. See `skill-loader.ts` for implementation.

**Q: How does the MCP server communicate with clients?**
A: Via the Model Context Protocol over stdio transport. See `src/index.ts` for the server implementation.

**Q: How are SKILL.md files parsed?**
A: `skill-loader.ts` reads files, extracts YAML frontmatter, validates required fields, and caches the parsed content.

**Q: How can I modify Local Skills MCP's skill aggregation?**
A: Edit the `loadSkills()` function in `src/skill-loader.ts` to add new directories or change priority.

**Q: What's the build process?**
A: TypeScript source in `src/` compiles to JavaScript in `dist/` using `npm run build`. The `prepare` script runs automatically on install.

**Q: How does Local Skills MCP achieve context efficiency?**
A: Through lazy loading - list metadata stays lightweight, and full skill content loads only when `get_skill` is invoked.

**Q: What MCP SDK does this use?**
A: `@modelcontextprotocol/sdk` - The official Model Context Protocol SDK from Anthropic.

## Development Workflow for Local Skills MCP

### Building the Project

```bash
npm run build        # Compile TypeScript to JavaScript
npm run watch        # Watch mode for development
```

### Testing Local Changes

1. Make changes to `src/` files
2. Run `npm run build`
3. Restart your MCP client
4. Test the modified server

### Adding New Features

1. Modify TypeScript source files in `src/`
2. Update types in `src/types.ts` if needed
3. Add tests (if implementing)
4. Build and test locally
5. Update documentation in README.md
6. Follow CONTRIBUTING.md guidelines

## File Navigation Guide for Local Skills MCP

- **`README.md`** - Start here for comprehensive documentation
- **`QUICK_START.md`** - Fast setup instructions
- **`src/index.ts`** - Understand the MCP server implementation
- **`src/skill-loader.ts`** - See how skills are discovered and loaded
- **`src/types.ts`** - Review type definitions
- **`skills/`** - Example skills included with Local Skills MCP
- **`package.json`** - Dependencies and npm scripts
- **`CONTRIBUTING.md`** - Guidelines for contributing to the project

## Key Differences from Other MCP Servers

Local Skills MCP is unique because:

- **Focused tool surface**: `get_skill` with optional validation/evaluation helpers
- **Multi-directory aggregation**: Combines skills from multiple sources
- **Context-efficient**: Lazy loading preserves context window
- **Universal skills**: Works across any MCP client, not just one
- **Zero-config**: Auto-discovers standard skill locations

## Contributing to Local Skills MCP

When helping users contribute:

1. Point them to `CONTRIBUTING.md` for guidelines
2. Explain the TypeScript codebase structure
3. Guide them through the build process
4. Help them understand the MCP server architecture
5. Assist with testing their changes locally

When helping users navigate the Local Skills MCP codebase, always:

- Provide specific file paths (e.g., `src/index.ts:42`)
- Explain how components interact
- Reference the official documentation
- Distinguish between this MCP server's code and user skills
