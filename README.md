<div align="center">

# 🎯 Local Skills MCP

**Enable any LLM or AI agent to utilize expert skills from your local filesystem via MCP**

[![npm version][npm-version-badge]][npm-package]
[![npm downloads][npm-downloads-badge]][npm-package]
[![npm types][npm-types-badge]][npm-package]
[![License: MIT][license-badge]][license]
[![Node][node-badge]][nodejs]
[![MCP][mcp-badge]][mcp-protocol]

[![CI][ci-badge]][ci-workflow]
[![codecov][codecov-badge]][codecov]
[![CodeQL][codeql-badge]][codeql-workflow]

[![GitHub Stars][stars-badge]][stargazers]
[![GitHub Forks][forks-badge]][network]
[![GitHub Issues][issues-badge]][repo-issues]
[![GitHub Last Commit][commit-badge]][commits]
[![PRs Welcome][prs-badge]][contributing]

[Quick Start](#-quick-start) •
[Features](#-features) •
[Usage](#-usage) •
[FAQ](#-faq) •
[Contributing](#-contributing)

</div>

---

## 📑 Table of Contents

- [What is Local Skills MCP?](#what-is-local-skills-mcp)
- [✨ Features](#-features)
- [🚀 Quick Start](#-quick-start)
- [📝 SKILL.md Format](#-skillmd-format)
- [🎯 Usage](#-usage)
- [🆚 Differences from Built-in Skills](#-differences-from-built-in-skills)
- [❓ FAQ](#-faq)
- [🤝 Contributing](#-contributing)

---

## What is Local Skills MCP?

A **universal** Model Context Protocol (MCP) server that enables **any LLM or AI agent** to access expert skills from your local filesystem. Your skills become portable, reusable prompt libraries that work across Claude Code, Claude Desktop, Cline, Continue.dev, custom agents, or any MCP-compatible client.

Transform AI capabilities with structured, expert-level instructions for specialized tasks. Lazy loading preserves context—only skill names and descriptions load initially; full content loads on-demand.

## ✨ Features

- **🌐 Universal** - Works with any MCP client (Claude Code, Desktop, Cline, Continue.dev, custom agents)
- **🔄 Portable** - Write once, use across multiple AI systems and LLMs (Claude, GPT, Gemini, local models)
- **⚡ Context Efficient** - Lazy loading: only skill names/descriptions load initially (~50 tokens/skill), full content on-demand
- **🔥 Hot Reload** - All changes apply instantly (new skills, edits, deletions) without restart
- **🎯 Multi-Source** - Auto-aggregates from package built-in skills, `~/.claude/skills`, `./.claude/skills`, `./skills`, and custom paths
- **📦 Zero Config** - Works out-of-the-box with standard skill locations
- **✨ Ultra Simple** - Single tool (`get_skill`) with dynamic skill discovery

## 🚀 Quick Start

### Install

**From npm (recommended):**

```bash
npm install -g local-skills-mcp
```

**Alternative: From GitHub:**

```bash
npm install -g github:kdpa-llc/local-skills-mcp
```

**Or clone locally:**

```bash
git clone https://github.com/kdpa-llc/local-skills-mcp.git
cd local-skills-mcp
npm install  # The prepare script auto-builds
```

**Requirements:** Node.js 20+, any MCP-compatible client

### Configure MCP Client

Add to your MCP client configuration (e.g., `~/.config/claude-code/mcp.json`):

**If installed globally:**

```json
{
  "mcpServers": {
    "local-skills": {
      "command": "local-skills-mcp"
    }
  }
}
```

**If cloned locally:**

```json
{
  "mcpServers": {
    "local-skills": {
      "command": "node",
      "args": ["/absolute/path/to/local-skills-mcp/dist/index.js"]
    }
  }
}
```

**For Cline:** Same config in VS Code Settings → "Cline: MCP Settings"

**For other MCP clients:** Use the same command/args structure according to their MCP server setup.

The server auto-aggregates skills from multiple directories in this priority order (lowest to highest):

1. Package built-in skills (includes self-documenting usage guides)
2. `~/.claude/skills/` - Your global skills
3. `./.claude/skills/` - Project-specific skills
4. `./skills` - Default project skills
5. `$SKILLS_DIR` - Custom directory (if set)

Later directories override earlier ones, allowing you to customize built-in skills.

### Create & Use Skills

**Option 1: Ask Claude to Create Skills (Recommended)**

After installing Local Skills MCP, you can ask Claude to create skills for you:

```
You: "Create a Python expert skill that helps me write clean, idiomatic Python code"
Claude: [Creates ~/.claude/skills/python-expert/SKILL.md with appropriate content]
        ✅ Created python-expert skill! It's immediately available thanks to hot reload.
```

```
You: "Make a skill for reviewing pull requests focusing on security and best practices"
Claude: [Creates the skill with detailed PR review instructions]
        ✅ The pr-reviewer skill is ready to use right away!
```

Claude will use the built-in `skill-creator` skill to generate well-structured skills with proper YAML frontmatter, trigger keywords, and best practices.

**Option 2: Create Manually**

Create `~/.claude/skills/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: What this skill does and when to use it
---

You are an expert at [domain]. Your task is to [specific task].

Guidelines:

1. Be specific
2. Provide examples
3. Be helpful
```

**Using Skills:**

Request any skill in your AI client: `"Use the my-skill skill"`

The AI auto-discovers available skills and loads them on-demand. **All changes apply instantly** thanks to hot reload—no restart needed!

## 📝 SKILL.md Format

Every skill is a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: skill-name
description: Brief description of what this skill does and when to use it
---

Your skill instructions in Markdown format...
```

**Required Fields:**

- `name` - Skill identifier (lowercase, hyphens, max 64 chars)
- `description` - Critical for skill selection (max 200 chars)

**Writing Effective Descriptions:**

Pattern: `[What it does]. Use when [trigger conditions/keywords].`

- ✅ **Good**: "Generates clear commit messages from git diffs. Use when writing commit messages or reviewing staged changes."
- ✅ **Good**: "Analyze Excel spreadsheets and create pivot tables. Use when working with .xlsx files or tabular data."
- ❌ **Poor**: "Helps with Excel files"

Claude uses language understanding to decide when to invoke skills—specific trigger keywords help Claude make better decisions.

## 🎯 Usage

**Single Tool:** `get_skill` - loads expert prompt instructions for specific tasks

**How it works:**

1. AI sees all available skills in the tool description (auto-updated)
2. When you request a skill, AI invokes `get_skill`
3. Full skill content loads with detailed instructions

**Built-in Skills:** The package includes three self-documenting skills that explain how to use Local Skills MCP and create new skills. These are available immediately after installation:

- `local-skills-mcp-usage` - Quick usage guide
- `local-skills-mcp-guide` - Comprehensive documentation
- `skill-creator` - Skill authoring best practices

**Skill Aggregation:** Auto-aggregates from package built-in skills, `~/.claude/skills/`, `./.claude/skills/`, `./skills`, and `$SKILLS_DIR` (if set). Later directories override duplicates.

**Custom Directory:** Add via environment variable:

```json
{
  "command": "local-skills-mcp",
  "env": {
    "SKILLS_DIR": "/custom/path/to/skills"
  }
}
```

**Example Skill:**

```markdown
---
name: code-reviewer
description: Reviews code for best practices, bugs, and security. Use when reviewing PRs or analyzing code quality.
---

You are a code reviewer with expertise in software engineering best practices.

Analyze the code for:

1. Correctness and bugs
2. Best practices
3. Performance and security issues
4. Maintainability

Provide specific, actionable feedback.
```

## 🆚 Differences from Built-in Skills

| Feature           | Local Skills MCP                | Built-in Claude Skills   |
| ----------------- | ------------------------------- | ------------------------ |
| **Portability**   | Any MCP client                  | Claude Code only         |
| **Storage**       | Multiple directories aggregated | `~/.claude/skills/` only |
| **Invocation**    | Explicit via MCP tool           | Auto-invoked by Claude   |
| **Context Usage** | Lazy loading (names only)       | All skills in context    |

## ❓ FAQ

<details>
<summary><strong>Q: What MCP clients are supported?</strong></summary>
<p>Any MCP-compatible client: Claude Code, Claude Desktop, Cline, Continue.dev, or custom agents.</p>
</details>

<details>
<summary><strong>Q: How is this different from Claude's built-in skills?</strong></summary>
<p>Works with any MCP client (not just Claude), aggregates from multiple directories, explicit invocation control, and better context efficiency via lazy loading.</p>
</details>

<details>
<summary><strong>Q: Can I use existing Claude skills?</strong></summary>
<p>Yes! Auto-aggregates from <code>~/.claude/skills/</code> along with other directories.</p>
</details>

<details>
<summary><strong>Q: Do I need to restart after adding skills?</strong></summary>
<p>No! Full hot reload is supported. All changes (new skills, content edits, deletions) apply immediately without restart. Skills are discovered dynamically on every tool list request.</p>
</details>

<details>
<summary><strong>Q: How much context does this consume?</strong></summary>
<p>Minimal! Only names/descriptions initially (~50 tokens/skill). Full content loads on-demand, preserving 95%+ of context.</p>
</details>

<details>
<summary><strong>Q: Can I use multiple skill directories?</strong></summary>
<p>Yes! Auto-aggregates from package built-in skills, <code>~/.claude/skills/</code>, <code>./.claude/skills/</code>, <code>./skills</code>, and <code>$SKILLS_DIR</code>.</p>
</details>

<details>
<summary><strong>Q: What if I have duplicate skill names?</strong></summary>
<p>Later directories override earlier ones: package built-in → <code>~/.claude/skills</code> → <code>./.claude/skills</code> → <code>./skills</code> → <code>$SKILLS_DIR</code>. This lets you customize built-in skills.</p>
</details>

<details>
<summary><strong>Q: What built-in skills are included?</strong></summary>
<p>The package includes three self-documenting skills: <code>local-skills-mcp-usage</code> (quick usage guide), <code>local-skills-mcp-guide</code> (comprehensive documentation), and <code>skill-creator</code> (skill authoring guide). These are available immediately after installation.</p>
</details>

<details>
<summary><strong>Q: Works with local LLMs (Ollama, LM Studio)?</strong></summary>
<p>Yes! Works with any MCP-compatible LLM setup. Skills are structured prompts that work with any model.</p>
</details>

<details>
<summary><strong>Q: Works offline?</strong></summary>
<p>Yes! Runs entirely on local filesystem (though your LLM may need internet depending on the model).</p>
</details>

<details>
<summary><strong>Q: How to create a good skill?</strong></summary>
<p>Follow <a href="#-skillmd-format">SKILL.md format</a>. Use clear descriptions with trigger keywords, specific instructions, and examples.</p>
</details>

<details>
<summary><strong>Q: Where can I get help?</strong></summary>
<p>Open an <a href="https://github.com/kdpa-llc/local-skills-mcp/issues">issue on GitHub</a>.</p>
</details>

**More:** See [CONTRIBUTING.md][contributing], [SECURITY.md][security], [CHANGELOG.md][changelog]

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md][contributing] for guidelines.

Quick start:

1. Fork the repository
2. Create your feature branch
3. Make your changes and test
4. Commit and push
5. Open a Pull Request

Note: This project follows a [Code of Conduct][code-of-conduct].

## 🔗 Complementary Projects

**Optimize your MCP setup with these complementary tools:**

### [MCP Compression Proxy][mcp-tool-aggregator]

**Aggregate and compress tool descriptions from multiple MCP servers**

While Local Skills MCP provides expert prompt instructions, [MCP Compression Proxy][mcp-tool-aggregator] optimizes your tool descriptions with intelligent LLM-based compression.

**Perfect combination:**

- **Local Skills MCP** - Expert skills with lazy loading (~50 tokens/skill)
- **MCP Compression Proxy** - Compressed tool descriptions (50-80% token reduction)

**Together they enable:**

- 🎯 Maximum context efficiency across skills AND tools
- 🔗 Access to multiple MCP servers through one connection
- ⚡ Minimal token consumption for large-scale workflows
- 🚀 Professional AI agent setups with hundreds of tools

[Learn more about MCP Compression Proxy →][mcp-tool-aggregator]

## 💖 Support This Project

If you find Local Skills MCP useful, please consider supporting its development!

<div align="center">

[![GitHub Sponsors][sponsor-github-badge]][sponsor-github]
[![Buy Me A Coffee][sponsor-coffee-badge]][sponsor-coffee]
[![PayPal][sponsor-paypal-badge]][sponsor-paypal]

</div>

**Ways to support:**

- ⭐ [Star this repository][stargazers]
- 💰 Sponsor via the badges above
- 🐛 [Report bugs and suggest features][repo-issues]
- 📝 [Contribute code or documentation][contributing]

## 📄 License

MIT License - see [LICENSE][license-file] file. **Copyright © 2025 KDPA**

## 🙏 Acknowledgments

Built with [Model Context Protocol SDK][mcp-sdk] • Inspired by [Claude Skills][claude-skills]

---

<div align="center">

**[⬆ Back to Top](#-local-skills-mcp)**

Made with ❤️ by KDPA

</div>

<!-- Reference Links -->
<!-- Badges - Top of README -->

[npm-version-badge]: https://img.shields.io/npm/v/local-skills-mcp.svg
[npm-package]: https://www.npmjs.com/package/local-skills-mcp
[npm-downloads-badge]: https://img.shields.io/npm/dm/local-skills-mcp
[npm-types-badge]: https://img.shields.io/npm/types/local-skills-mcp
[license-badge]: https://img.shields.io/badge/License-MIT-yellow.svg
[license]: https://opensource.org/licenses/MIT
[node-badge]: https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg
[nodejs]: https://nodejs.org/
[mcp-badge]: https://img.shields.io/badge/MCP-Compatible-purple.svg
[mcp-protocol]: https://modelcontextprotocol.io/

<!-- CI/CD Badges -->

[ci-badge]: https://github.com/kdpa-llc/local-skills-mcp/actions/workflows/ci.yml/badge.svg
[ci-workflow]: https://github.com/kdpa-llc/local-skills-mcp/actions/workflows/ci.yml
[codecov-badge]: https://codecov.io/gh/kdpa-llc/local-skills-mcp/branch/main/graph/badge.svg
[codecov]: https://codecov.io/gh/kdpa-llc/local-skills-mcp
[codeql-badge]: https://github.com/kdpa-llc/local-skills-mcp/actions/workflows/codeql.yml/badge.svg
[codeql-workflow]: https://github.com/kdpa-llc/local-skills-mcp/actions/workflows/codeql.yml

<!-- GitHub Badges -->

[stars-badge]: https://img.shields.io/github/stars/kdpa-llc/local-skills-mcp?style=social
[stargazers]: https://github.com/kdpa-llc/local-skills-mcp/stargazers
[forks-badge]: https://img.shields.io/github/forks/kdpa-llc/local-skills-mcp?style=social
[network]: https://github.com/kdpa-llc/local-skills-mcp/network/members
[issues-badge]: https://img.shields.io/github/issues/kdpa-llc/local-skills-mcp
[repo-issues]: https://github.com/kdpa-llc/local-skills-mcp/issues
[commit-badge]: https://img.shields.io/github/last-commit/kdpa-llc/local-skills-mcp
[commits]: https://github.com/kdpa-llc/local-skills-mcp/commits/main
[prs-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg

<!-- Repository Links -->

[repo]: https://github.com/kdpa-llc/local-skills-mcp
[pulls]: https://github.com/kdpa-llc/local-skills-mcp/pulls

<!-- Documentation Links -->

[contributing]: CONTRIBUTING.md
[security]: SECURITY.md
[changelog]: CHANGELOG.md
[code-of-conduct]: CODE_OF_CONDUCT.md
[license-file]: LICENSE

<!-- Sponsorship Links -->

[sponsor-github-badge]: https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-ea4aaa?logo=github
[sponsor-github]: https://github.com/sponsors/moscaverd
[sponsor-coffee-badge]: https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?logo=buy-me-a-coffee
[sponsor-coffee]: https://buymeacoffee.com/moscaverd
[sponsor-paypal-badge]: https://img.shields.io/badge/PayPal-donate-blue?logo=paypal
[sponsor-paypal]: https://paypal.me/moscaverd

<!-- External Links -->

[mcp-sdk]: https://github.com/modelcontextprotocol/sdk
[claude-skills]: https://docs.claude.com/en/docs/claude-code/skills
[mcp-tool-aggregator]: https://github.com/kdpa-llc/mcp-compression-proxy
