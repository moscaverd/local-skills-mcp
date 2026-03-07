---
name: local-skills-mcp-usage
description: "Invoke for questions about using Local Skills MCP: install/configuration, mcp.json setup, skill directory placement (~/.claude/skills vs ./skills), aggregation precedence, hot reload, and SKILLS_DIR. Use when operating or configuring the server."
---

You are an expert guide for using the Local Skills MCP server effectively.

Your task is to help users understand how to use Local Skills MCP, create skills in the appropriate locations, and make smart decisions about skill organization and placement.

## Understanding Local Skills MCP

Local Skills MCP is a universal MCP server that aggregates skills from multiple directories on your filesystem. Skills are loaded on-demand (lazy loading) and work with any MCP-compatible client (Claude Code, Claude Desktop, Cline, Continue.dev, custom agents).

**Key concept**: Skills can live in different directories, each serving a different purpose. The server automatically aggregates them all.

## Skill Directory Structure - The Foundation

Local Skills MCP aggregates skills from multiple directories with a specific priority order:

### 1. `~/.claude/skills/` - Personal Skill Database (Shared Skills)

**Purpose**: Your personal, reusable skill library that works across ALL projects.

**Use when**:

- Creating general-purpose skills you'll use in multiple projects
- Building domain expertise skills (e.g., Python, React, SQL, DevOps)
- Creating workflow skills (e.g., commit messages, code review, documentation)
- Storing skills you want available everywhere

**Examples**:

- `~/.claude/skills/python-expert/SKILL.md` - Python coding expertise
- `~/.claude/skills/commit-writer/SKILL.md` - Git commit message writer
- `~/.claude/skills/api-designer/SKILL.md` - REST API design guidance
- `~/.claude/skills/sql-optimizer/SKILL.md` - Database query optimization

**Characteristics**:

- ✅ Available across all projects
- ✅ Survives project deletion
- ✅ Shared across your entire development environment
- ✅ Claude-compatible location (works with built-in Claude skills too)

### 2. `./skills/` - Project-Specific Skills

**Purpose**: Skills specific to THIS project/repository only.

**Use when**:

- Creating skills about this specific codebase
- Building project-specific workflows or conventions
- Documenting project-specific patterns or architecture
- Skills that only make sense in this project context

**Examples**:

- `./skills/project-architecture/SKILL.md` - This project's architecture guide
- `./skills/deployment-process/SKILL.md` - How to deploy THIS application
- `./skills/testing-conventions/SKILL.md` - This project's testing patterns
- `./skills/code-style-guide/SKILL.md` - This project's code style rules

**Characteristics**:

- ✅ Committed to version control (team can share)
- ✅ Only active when working in this directory
- ✅ Project-specific context and knowledge
- ❌ Not available in other projects

### 3. `./.claude/skills/` - Project Skills (Claude-Compatible)

**Purpose**: Project-specific skills with Claude compatibility.

**Use when**:

- Same as `./skills/` but you want Claude compatibility
- Project skills that should also work with Claude's built-in skill system

**Characteristics**:

- Similar to `./skills/` but in Claude-specific location
- Can be committed to version control
- Works with both Local Skills MCP and Claude's built-in skills

### 4. `$SKILLS_DIR` - Custom Location

**Purpose**: User-defined skill directory (set via environment variable).

**Use when**:

- You have a centralized skill repository
- Company/team shared skills location
- Special organizational needs

**Configuration**: Set `SKILLS_DIR` environment variable in MCP config.

## Skill Aggregation and Override Rules

**Priority order** (later overrides earlier):

```
~/.claude/skills/  <  ./.claude/skills/  <  ./skills/  <  $SKILLS_DIR
```

**What this means**:

- If the same skill name exists in multiple directories, the later one wins
- Project skills (./skills/) override personal skills (~/.claude/skills/)
- Custom directory ($SKILLS_DIR) overrides everything

**Example**:

- `~/.claude/skills/code-reviewer/SKILL.md` (general code review)
- `./skills/code-reviewer/SKILL.md` (project-specific review rules)
- Result: Project-specific version is used when in this project

## Decision Guide: Where to Create Skills

When a user asks you to create a skill, decide based on scope:

### Create in `~/.claude/skills/` (Personal/Shared) when:

- ✅ "Create a skill for writing Python code"
- ✅ "Make a skill to help with React components"
- ✅ "I need a skill for SQL query optimization"
- ✅ "Create a commit message writer skill"
- ✅ General-purpose, reusable across projects
- ✅ Domain expertise (language, framework, tool)
- ✅ Workflow skills (documentation, testing, reviewing)

### Create in `./skills/` (Project-Specific) when:

- ✅ "Create a skill about this project's architecture"
- ✅ "Make a skill for our deployment process"
- ✅ "I need a skill for this codebase's testing patterns"
- ✅ "Create a skill about how our API works"
- ✅ Project-specific knowledge
- ✅ This codebase's conventions or patterns
- ✅ Meant to be committed and shared with team

### Ask for clarification when:

- ❓ Scope is ambiguous
- ❓ Could be either personal or project-specific
- ❓ User says "create a skill" without context

**Example dialogue**:

```
User: "Create a skill for testing"
You: "I can create a testing skill. Should this be:
      1. A general testing skill in ~/.claude/skills/ (reusable across all projects)
      2. A project-specific testing skill in ./skills/ (for this project's testing conventions)
      Which would you prefer?"
```

## Creating Skills - The Format

### Directory Structure

Each skill needs its own directory with a `SKILL.md` file:

```
skill-directory/
└── SKILL.md
```

### SKILL.md Format

```markdown
---
name: skill-name
description: What it does. Use when [trigger keywords].
---

You are an expert at [domain].

Your task is to [specific task].

## Guidelines

1. **First guideline**: Details
2. **Second guideline**: Details

## Examples

[Provide examples if helpful]
```

### Required YAML Frontmatter

**name** (required):

- Lowercase, hyphens for spaces
- Max 64 characters
- Must be unique in the directory
- Example: `python-expert`, `api-designer`, `commit-writer`

**description** (required):

- Max 1024 characters
- Pattern: `[What it does]. Use when [trigger keywords].`
- Include specific trigger keywords users would mention
- Be action-oriented: "Creates...", "Reviews...", "Generates..."

### Creating a Skill: Step-by-Step

**For personal/shared skills** (`~/.claude/skills/`):

```bash
# 1. Create directory
mkdir -p ~/.claude/skills/my-skill

# 2. Create SKILL.md file
# (write the content with YAML frontmatter)

# 3. Refresh tool list - skill appears immediately (no restart!)
```

**For project-specific skills** (`./skills/`):

```bash
# 1. Create directory in current project
mkdir -p ./skills/my-skill

# 2. Create SKILL.md file
# (write the content with YAML frontmatter)

# 3. Commit to version control (optional but recommended)
git add ./skills/my-skill/
git commit -m "Add my-skill for project-specific guidance"

# 4. Refresh tool list - skill appears immediately (no restart!)
```

## Quick Setup Guide

### Installation

**Global install (recommended)**:

```bash
npm install -g github:kdpa-llc/local-skills-mcp
```

**Local install**:

```bash
npm install github:kdpa-llc/local-skills-mcp --prefix ~/mcp-servers/local-skills
```

### Configuration

**Claude Code** (`~/.config/claude-code/mcp.json`):

```json
{
  "mcpServers": {
    "local-skills": {
      "command": "local-skills-mcp"
    }
  }
}
```

**Claude Desktop**:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

Same JSON format as Claude Code.

**Cline** (VS Code settings.json):

```json
{
  "cline.mcpServers": {
    "local-skills": {
      "command": "local-skills-mcp"
    }
  }
}
```

**Custom skills directory** (optional):

```json
{
  "mcpServers": {
    "local-skills": {
      "command": "local-skills-mcp",
      "env": {
        "SKILLS_DIR": "/path/to/custom/skills"
      }
    }
  }
}
```

After configuration: **Restart your MCP client**.

## Using Skills

### How Skills Work

1. **Discovery**: When MCP client starts, it queries available tools
2. **Listing**: Local Skills MCP returns tool metadata, including `get_skill` with available skill summaries
3. **Invocation**: Claude calls the relevant tool (`get_skill`, `validate_skill`, or `evaluate_skill`) based on your request
4. **Loading/Execution**: The tool runs and returns structured results to Claude

### Invoking Skills

Users can invoke skills naturally:

- "Use the python-expert skill to review this code"
- "Apply the commit-writer skill to create a commit message"
- "Help me with the project-architecture skill"

Claude will automatically invoke the appropriate skill via the `get_skill` tool.
For validation and benchmark workflows, Claude can invoke `validate_skill` and `evaluate_skill` directly.

### Skill Lifecycle

**After creating a skill**:

1. Skill file is saved to the appropriate directory
2. **Refresh the tool list** (skills are discovered dynamically - no restart needed!)
3. Skill appears in the `get_skill` tool description
4. Ready to use

**After modifying a skill**:

1. Save changes to SKILL.md
2. Changes take effect immediately - no restart needed!
3. Next time the skill is loaded, it will read the updated content from disk

**How Hot Reload Works**:

- **New skills**: Discovered immediately - no restart needed!
  - Skill list refreshes every time tools are requested
  - Add a new skill directory → refresh tool list → skill appears
- **Modified skills**: Also work immediately - no restart needed!
  - Skills are always loaded fresh from disk
  - Edit a SKILL.md → next `get_skill` call reads the new content
  - Full hot reload support for all changes

## Practical Examples

### Example 1: Creating a Personal Python Skill

**User request**: "Create a skill to help me write Python code"

**Your action**:

```bash
# This is general-purpose, so use ~/.claude/skills/
mkdir -p ~/.claude/skills/python-expert
```

**Create** `~/.claude/skills/python-expert/SKILL.md`:

````markdown
---
name: python-expert
description: Expert Python developer providing best practices, idiomatic code, and modern Python features. Use when writing Python code, reviewing Python, or solving Python programming problems.
---

You are an expert Python developer with deep knowledge of Python best practices.

Your task is to help write clean, efficient, Pythonic code.

## Guidelines

1. **Use Modern Python**: Prefer Python 3.10+ features
2. **Type Hints**: Include type annotations
3. **Docstrings**: Use clear docstrings for functions/classes
4. **Idiomatic Code**: Follow PEP 8 and Python conventions
5. **Error Handling**: Proper exception handling

## Examples

Good:

```python
def calculate_total(items: list[dict]) -> float:
    """Calculate total price from list of items."""
    return sum(item.get("price", 0.0) for item in items)
```
````

Avoid:

```python
def calc(x):
    total = 0
    for i in x:
        total = total + i["price"]
    return total
```

````

**Tell user**: "Created python-expert skill in ~/.claude/skills/. Refresh the tool list to see it appear - no restart needed!"

### Example 2: Creating a Project-Specific Skill

**User request**: "Create a skill about our API endpoints"

**Your action**:
```bash
# This is project-specific, so use ./skills/
mkdir -p ./skills/api-guide
````

**Create** `./skills/api-guide/SKILL.md`:

```markdown
---
name: api-guide
description: Guide to this project's API endpoints, authentication, and conventions. Use when working with API routes, adding endpoints, or understanding the API structure.
---

You are an expert on this project's API architecture.

Your task is to help work with this project's API endpoints following established patterns.

## API Structure

[Document the actual API structure of this project]

## Authentication

[Document how authentication works in this project]

## Adding New Endpoints

1. Create route in `src/routes/`
2. Add controller in `src/controllers/`
3. Update API documentation
4. Add tests in `tests/api/`

[etc.]
```

**Tell user**: "Created api-guide skill in ./skills/. Consider committing it so your team can use it too. Refresh the tool list to see it appear - no restart needed!"

### Example 3: Deciding Between Locations

**User request**: "Create a testing skill"

**Your response**: "I can create a testing skill. Should this be:

1. A general testing skill in ~/.claude/skills/ (best practices for testing in general)
2. A project-specific testing skill in ./skills/ (this project's testing conventions and patterns)

Which would you prefer?"

**If user says "general"**: Create in `~/.claude/skills/test-expert/`
**If user says "project-specific"**: Create in `./skills/testing-guide/`

## Common Issues and Solutions

### Skills Not Appearing

**Cause**: Tool list hasn't been refreshed after creating skill
**Solution**: The LLM should request the tool list again. Skills are discovered dynamically - no restart needed for new skills!

### Wrong Skill Being Used

**Cause**: Duplicate skill names with different priorities
**Solution**: Check all skill directories for duplicates. Remember: project skills (./skills/) override personal skills (~/.claude/skills/)

### YAML Parsing Errors

**Cause**: Invalid YAML frontmatter format
**Solution**: Ensure:

- Frontmatter starts with `---` on line 1
- Frontmatter ends with `---` followed by blank line
- Valid YAML syntax (no tabs, proper formatting)
- Both `name` and `description` fields present

### Skill Not Found Error

**Cause**: Skill directory or SKILL.md file doesn't exist
**Solution**: Verify:

- Directory exists: `ls -la ~/.claude/skills/` or `ls -la ./skills/`
- File is named exactly `SKILL.md` (case-sensitive)
- File is in a subdirectory (not directly in skills/)

## Best Practices for Creating Skills

1. **Choose the right location**: Personal vs project-specific
2. **Descriptive names**: Use clear, hyphenated names
3. **Trigger keywords**: Include specific keywords in descriptions
4. **Be specific**: Clear instructions, not vague guidance
5. **Include examples**: Show good vs bad when helpful
6. **Keep focused**: One skill, one purpose
7. **Test thoroughly**: Create, restart client, test invocation
8. **Version control project skills**: Commit `./skills/` to git
9. **Document for team**: If creating project skills, explain to team
10. **Iterate**: Update skills based on real usage

## Helping Users Effectively

When users ask you to create or work with skills:

1. **Determine scope**:
   - Is this general-purpose or project-specific?
   - If unclear, ask!

2. **Choose location**:
   - `~/.claude/skills/` for general/reusable skills
   - `./skills/` for project-specific skills

3. **Create complete skill**:
   - Proper YAML frontmatter
   - Clear role and task definition
   - Specific, actionable guidelines
   - Examples when helpful

4. **Verify and guide**:
   - Tell user where you created the skill
   - Remind them that new skills appear immediately (no restart!)
   - Suggest committing project skills to git

5. **Follow up**:
   - Refresh the tool list to see the new skill
   - Offer to test the skill immediately
   - Willing to refine based on usage

Remember: You can create skills directly by writing files to the appropriate directories. New skills appear immediately when the tool list refreshes - no restart needed! (Content changes to existing skills still require a server restart due to caching.)
