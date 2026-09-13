# Quick Start Guide

Get up and running with Local Skills MCP in 5 minutes!

## Prerequisites

- Node.js 20+ installed
- Claude Code or another MCP-compatible client

## Installation

### Step 1: Clone or Download

```bash
cd ~/projects
git clone <repository-url> local-skills-mcp
cd local-skills-mcp
```

### Step 2: Install Dependencies

```bash
npm install
```

This will automatically build the project (via the `prepare` script).

### Step 3: Configure Claude Code

Add the MCP server to your Claude Code configuration file:

**Location:** `~/.config/claude-code/mcp.json` (Linux/Mac) or `%APPDATA%/claude-code/mcp.json` (Windows)

**Option A: Auto-detect skills directory (Recommended)**

```json
{
  "mcpServers": {
    "local-skills": {
      "command": "node",
      "args": ["/full/path/to/local-skills-mcp/dist/index.js"]
    }
  }
}
```

The server will automatically find skills in this priority order:

1. `~/.claude/skills/` (if exists)
2. `./.claude/skills/` (if exists)
3. `./skills` (fallback)

**Option B: Explicit skills directory**

```json
{
  "mcpServers": {
    "local-skills": {
      "command": "node",
      "args": ["/full/path/to/local-skills-mcp/dist/index.js"],
      "env": {
        "SKILLS_DIR": "/full/path/to/local-skills-mcp/skills"
      }
    }
  }
}
```

Use this if you want to explicitly specify where skills are stored.

**Important:** Replace `/full/path/to/local-skills-mcp` with the actual absolute path to where you cloned the repository.

### Step 4: Restart Claude Code

Close and reopen Claude Code to load the MCP server.

### Step 5: Test It!

Open Claude Code and try these commands:

```
List all available skills
```

Claude will use the `list_skills` MCP tool and show you all available skills.

```
Use the code-reviewer skill to review this code: [paste code here]
```

Claude will use the `invoke_skill` tool to load and apply the code-reviewer skill.

## Verify Installation

To verify the MCP server is working:

1. **Check MCP Status** in Claude Code
   - Look for "local-skills" in the MCP servers list
   - Status should show as "connected"

2. **List Skills**
   Ask Claude: "What skills are available?"

   You should see:
   - code-reviewer
   - test-generator
   - documentation-writer
   - debugging-assistant

3. **Invoke a Skill**
   Ask Claude: "Use the code-reviewer skill to review this function: [paste code]"

## Create Your First Custom Skill

### 1. Create the directory

```bash
mkdir skills/my-first-skill
```

### 2. Create SKILL.md

```bash
cat > skills/my-first-skill/SKILL.md << 'EOF'
---
name: my-first-skill
description: My first custom skill that greets users warmly
---

You are a friendly assistant.

Your task is to greet the user warmly and offer assistance.

Be friendly, professional, and concise.
EOF
```

### 3. Test it

In Claude Code, ask: "Use my-first-skill"

## SKILL.md Format

Every skill is a single `SKILL.md` file with this structure:

```markdown
---
name: skill-name
description: What the skill does and when to use it
---

Skill instructions in Markdown...

You are an expert at [domain].

Your task is to [specific task].

Guidelines:

1. First guideline
2. Second guideline
```

**Required:**

- YAML frontmatter between `---` markers
- `name` field (lowercase, hyphens allowed)
- `description` field
- Markdown content after the frontmatter

## Troubleshooting

### MCP Server Not Found

**Symptom:** Claude says it doesn't have access to local-skills tools

**Solution:**

1. Check the path in `mcp.json` is correct and absolute
2. Verify `dist/index.js` exists: `ls dist/index.js`
3. Rebuild if needed: `npm run build`
4. Restart Claude Code completely

### No Skills Found

**Symptom:** `list_skills` returns "No skills found"

**Solution:**

1. Check `SKILLS_DIR` path is correct
2. Verify skills directory exists: `ls skills/`
3. Check example skills are present: `ls skills/code-reviewer/SKILL.md`

### Build Errors

**Symptom:** `npm install` or `npm run build` fails

**Solution:**

1. Check Node.js version: `node --version` (should be 20+)
2. Remove node_modules: `rm -rf node_modules`
3. Clear npm cache: `npm cache clean --force`
4. Reinstall: `npm install`

### YAML Parsing Errors

**Symptom:** Skill fails to load with YAML error

**Solution:**

1. Ensure SKILL.md starts with `---\n`
2. Ensure frontmatter ends with `\n---\n`
3. Check YAML syntax (no tabs, proper format)
4. Verify both `name` and `description` fields exist

## Common Use Cases

### Use Case 1: Code Review

```
Use the code-reviewer skill to review this React component:
[paste component code]
```

### Use Case 2: Generate Tests

```
Use the test-generator skill to create tests for this function:
[paste function code]
```

### Use Case 3: Write Documentation

```
Use documentation-writer to document this API endpoint:
[paste endpoint code]
```

### Use Case 4: Debug Issues

```
Use debugging-assistant to help me debug this error:
[paste error and relevant code]
```

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Explore the [skills/](skills/) directory for examples
- Create your own custom skills
- Share your skills with others!

## Tips for Success

1. **Be Specific:** When invoking skills, clearly state which skill to use
2. **Use Descriptive Names:** Make skill names clear and purposeful
3. **Write Clear Descriptions:** Help Claude understand when to suggest each skill
4. **Test Thoroughly:** Try skills with various inputs before relying on them
5. **Organize Skills:** Group related skills in a logical directory structure

## Development Mode

If you're actively developing skills:

```bash
# Watch mode - automatically rebuilds on changes
npm run watch
```

Keep this running in a terminal while you edit TypeScript files.

## Getting Help

- **Issues:** Report bugs and request features on GitHub
- **Questions:** Check the README.md documentation
- **Examples:** Look at the example skills for inspiration

## Success!

You're now ready to use Local Skills MCP! Start by listing available skills and experimenting with the examples.

Happy skill building! 🚀
