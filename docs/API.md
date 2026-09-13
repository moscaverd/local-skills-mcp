# API Reference

This document provides detailed API documentation for the local-skills-mcp package, including all public classes, interfaces, and functions.

## Table of Contents

- [Core Classes](#core-classes)
  - [LocalSkillsServer](#localskillsserver)
  - [SkillLoader](#skillloader)
- [Interfaces](#interfaces)
  - [Skill](#skill)
  - [SkillMetadata](#skillmetadata)
- [Utility Functions](#utility-functions)
  - [getAllSkillsDirectories](#getallskillsdirectories)

---

## Core Classes

### LocalSkillsServer

The main MCP server class that handles client connections and manages the skill system.

#### Constructor

```typescript
constructor();
```

Creates a new LocalSkillsServer instance with the following behavior:

- Initializes the MCP server with name and version from package.json
- Creates a SkillLoader with all configured skill directories
- Sets up request handlers for listing and calling tools
- Configures error handling and graceful shutdown

**Example:**

```typescript
import { LocalSkillsServer } from "local-skills-mcp";

const server = new LocalSkillsServer();
await server.run();
```

#### Methods

##### run()

```typescript
async run(): Promise<void>
```

Starts the MCP server and connects it to stdio transport for communication.

**Behavior:**

- Creates a stdio transport for MCP communication
- Connects the server to the transport
- Logs server startup information to stderr
- Logs all skill directories being monitored

**Example:**

```typescript
const server = new LocalSkillsServer();
await server.run();
// Server is now running and listening on stdio
```

**Output:**

```
Local Skills MCP Server v0.1.0 running on stdio
Aggregating skills from 3 directories:
  - /home/user/.claude/skills
  - /home/user/project/.claude/skills
  - /home/user/project/skills
```

---

### SkillLoader

Manages skill discovery, loading, and caching across multiple directories.

#### Constructor

```typescript
constructor(skillsPaths: string[])
```

Creates a new SkillLoader instance that monitors the specified directories.

**Parameters:**

- `skillsPaths` (string[]): Array of directory paths to search for skills

**Example:**

```typescript
import { SkillLoader } from "local-skills-mcp";

const loader = new SkillLoader([
  "/home/user/.claude/skills",
  "/home/user/project/skills",
]);
```

#### Methods

##### discoverSkills()

```typescript
async discoverSkills(): Promise<string[]>
```

Scans all configured directories and returns a list of available skill names.

**Returns:**

- Promise<string[]>: Sorted array of skill names

**Behavior:**

- Clears and rebuilds the internal skill registry
- Scans each directory for subdirectories containing `SKILL.md`
- Later directories override earlier ones for duplicate skill names
- Continues scanning even if some directories are inaccessible
- Returns alphabetically sorted skill names

**Example:**

```typescript
const skillNames = await loader.discoverSkills();
console.log(skillNames);
// Output: ['code-reviewer', 'test-generator', 'refactoring-expert']
```

##### loadSkill()

```typescript
async loadSkill(skillName: string): Promise<Skill>
```

Loads a specific skill by name, including its full content and metadata.

**Parameters:**

- `skillName` (string): The name of the skill to load

**Returns:**

- Promise<Skill>: Complete skill object with metadata and content

**Throws:**

- Error if skill is not found in the registry
- Error if SKILL.md file cannot be read or parsed

**Behavior:**

- Checks cache first for previously loaded skills
- Loads and parses the SKILL.md file
- Validates YAML frontmatter
- Caches the skill for subsequent calls
- Returns complete skill object

**Example:**

```typescript
const skill = await loader.loadSkill("code-reviewer");
console.log(skill.name); // 'Code Reviewer'
console.log(skill.description); // 'Expert code review assistant'
console.log(skill.content); // Full skill prompt content
console.log(skill.source); // '/home/user/.claude/skills'
```

##### getSkillMetadata()

```typescript
async getSkillMetadata(skillName: string): Promise<SkillMetadata & { source: string }>
```

Retrieves skill metadata without loading the full content (lightweight operation).

**Parameters:**

- `skillName` (string): The name of the skill

**Returns:**

- Promise<SkillMetadata & { source: string }>: Metadata with source directory

**Throws:**

- Error if skill is not found
- Error if SKILL.md cannot be parsed

**Example:**

```typescript
const metadata = await loader.getSkillMetadata("code-reviewer");
console.log(metadata.name); // 'Code Reviewer'
console.log(metadata.description); // 'Expert code review assistant'
console.log(metadata.source); // '/home/user/.claude/skills'
// Note: metadata.content is NOT included (saves memory)
```

##### getSkillsPaths()

```typescript
getSkillsPaths(): string[]
```

Returns the array of directories being monitored for skills.

**Returns:**

- string[]: Array of skill directory paths

**Example:**

```typescript
const paths = loader.getSkillsPaths();
console.log(paths);
// Output: ['/home/user/.claude/skills', '/home/user/project/skills']
```

---

## Interfaces

### Skill

Complete skill definition including metadata and content.

```typescript
interface Skill {
  name: string; // Display name from YAML frontmatter
  description: string; // Description from YAML frontmatter
  content: string; // Full markdown content after frontmatter
  path: string; // Absolute path to skill directory
  source: string; // Source directory (which skills path)
}
```

**Properties:**

- **name**: The skill's display name as specified in SKILL.md frontmatter
- **description**: A brief description of the skill's purpose
- **content**: The complete skill prompt/instructions (markdown after frontmatter)
- **path**: Absolute filesystem path to the skill's directory
- **source**: The parent skills directory this skill was loaded from

**Example:**

```typescript
const skill: Skill = {
  name: "Code Reviewer",
  description: "Expert code review assistant",
  content: "# Instructions\n\nYou are an expert code reviewer...",
  path: "/home/user/.claude/skills/code-reviewer",
  source: "/home/user/.claude/skills",
};
```

---

### SkillMetadata

Metadata extracted from SKILL.md YAML frontmatter.

```typescript
interface SkillMetadata {
  name: string; // Skill display name
  description: string; // Brief description
}
```

**Properties:**

- **name**: Required. The skill's display name
- **description**: Required. A brief description of what the skill does

**YAML Example:**

```yaml
---
name: Code Reviewer
description: Expert code review assistant with focus on best practices
---
```

**TypeScript Example:**

```typescript
const metadata: SkillMetadata = {
  name: "Code Reviewer",
  description: "Expert code review assistant with focus on best practices",
};
```

---

## Utility Functions

### getAllSkillsDirectories()

```typescript
export function getAllSkillsDirectories(): string[];
```

Determines all directories to scan for skills based on standard locations and environment variables.

**Returns:**

- string[]: Array of directory paths in priority order

**Behavior:**

- Checks for `~/.claude/skills` (user-level Claude skills)
- Checks for `{cwd}/.claude/skills` (project-level Claude skills)
- Checks for `{cwd}/skills` (default project skills)
- Includes `SKILLS_DIR` environment variable if set (highest priority for duplicates)
- Only includes directories that exist
- Returns at least one path (default: `{cwd}/skills`)

**Priority Order for Duplicate Skills:**

1. `SKILLS_DIR` environment variable (highest priority)
2. `{cwd}/skills`
3. `{cwd}/.claude/skills`
4. `~/.claude/skills`

**Example:**

```typescript
import { getAllSkillsDirectories } from "local-skills-mcp";

const dirs = getAllSkillsDirectories();
console.log(dirs);
// Output: [
//   '/home/user/.claude/skills',
//   '/home/user/project/.claude/skills',
//   '/home/user/project/skills'
// ]
```

**Environment Variable Example:**

```bash
# Override with custom directory
SKILLS_DIR=/custom/skills/path node dist/index.js
```

```typescript
// With SKILLS_DIR set, it will be added to the list
const dirs = getAllSkillsDirectories();
// Output: [
//   '/home/user/.claude/skills',
//   '/home/user/project/.claude/skills',
//   '/home/user/project/skills',
//   '/custom/skills/path'  // Added from env var
// ]
```

---

## MCP Protocol Integration

### MCP Tools

The server exposes the following MCP tools:

#### get_skill

Retrieves a skill's content and metadata.

**Input Schema:**

```typescript
{
  skill_name: string; // Required: name of the skill to retrieve
}
```

**Response Format:**

```typescript
{
  content: [
    {
      type: "text",
      text: string, // Formatted skill output with metadata and content
    },
  ];
}
```

**Response Structure:**

```markdown
# Skill: {name}

**Description:** {description}
**Source:** {source}

---

{content}
```

**Example Request:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "get_skill",
    "arguments": {
      "skill_name": "code-reviewer"
    }
  }
}
```

**Example Response:**

```markdown
# Skill: Code Reviewer

**Description:** Expert code review assistant
**Source:** /home/user/.claude/skills

---

# Instructions

You are an expert code reviewer...
```

---

## Error Handling

### Common Errors

#### Skill Not Found

```typescript
Error: Skill "unknown-skill" not found. Run list_skills to see available skills.
```

**Cause:** Requested skill name doesn't exist in any monitored directory

**Solution:** Call `discoverSkills()` to get available skills

#### Invalid SKILL.md Format

```typescript
Error: SKILL.md must start with YAML frontmatter (---)
```

**Cause:** SKILL.md file doesn't begin with `---` delimiter

**Solution:** Ensure SKILL.md follows the correct format:

```markdown
---
name: Skill Name
description: Skill description
---

Skill content here...
```

#### Missing Required Fields

```typescript
Error: SKILL.md frontmatter must include "name" field
```

**Cause:** YAML frontmatter is missing required `name` or `description`

**Solution:** Add both required fields to frontmatter:

```yaml
---
name: My Skill
description: What this skill does
---
```

---

## Best Practices

### Skill Organization

1. **Directory Structure:**

   ```
   skills/
   ├── code-reviewer/
   │   └── SKILL.md
   ├── test-generator/
   │   └── SKILL.md
   └── refactoring-expert/
       └── SKILL.md
   ```

2. **SKILL.md Format:**

   ```markdown
   ---
   name: Clear Descriptive Name
   description: Brief one-line description of what the skill does
   ---

   # Detailed instructions here
   ```

3. **Naming Conventions:**
   - Use kebab-case for directory names: `code-reviewer`, `test-generator`
   - Use Title Case for skill names in frontmatter: "Code Reviewer"
   - Keep descriptions concise (< 200 characters)

### Performance Optimization

1. **Lazy Loading:** Skills are only fully loaded when requested
2. **Caching:** Loaded skills are cached to avoid repeated file I/O
3. **Registry:** Skill discovery builds a lightweight registry for fast lookups

### Error Recovery

The system is designed to be resilient:

- Non-existent directories are silently skipped
- Malformed skills don't prevent other skills from loading
- Directory scan errors are logged but don't crash the server

---

## TypeScript Usage

### Installing Types

```bash
npm install local-skills-mcp
```

Types are included in the package - no separate @types package needed.

### Import Examples

```typescript
// Import main server
import { LocalSkillsServer } from "local-skills-mcp";

// Import utilities
import { getAllSkillsDirectories } from "local-skills-mcp";

// Import types
import type { Skill, SkillMetadata } from "local-skills-mcp";

// Import loader (for custom usage)
import { SkillLoader } from "local-skills-mcp";
```

### Custom Integration Example

```typescript
import { SkillLoader } from "local-skills-mcp";
import type { Skill } from "local-skills-mcp";

// Create custom loader
const loader = new SkillLoader(["/custom/path"]);

// Discover available skills
const skills = await loader.discoverSkills();
console.log("Available skills:", skills);

// Load a specific skill
const skill: Skill = await loader.loadSkill("my-skill");

// Use the skill content
console.log(skill.name);
console.log(skill.content);
```

---

## Version Information

This documentation is for local-skills-mcp v0.1.0.

For the latest version and updates, see the [GitHub repository](https://github.com/kdpa-llc/local-skills-mcp).
