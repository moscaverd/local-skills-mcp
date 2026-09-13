# Developer Guide

Welcome to the local-skills-mcp development guide! This document will help you get started with development, understand the codebase structure, and contribute effectively.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Debugging](#debugging)
- [Code Style](#code-style)
- [Common Tasks](#common-tasks)
- [Common Pitfalls](#common-pitfalls)
- [Resources](#resources)

---

## Prerequisites

### Required Software

- **Node.js**: >= 18.0.0 (LTS version recommended)
- **npm**: >= 9.0.0 (comes with Node.js)
- **Git**: Latest version
- **TypeScript**: Included in dev dependencies (5.6+)

### Recommended Tools

- **VS Code**: With recommended extensions (see [.vscode/extensions.json](#vs-code-setup))
- **Claude Code or Claude Desktop**: For testing the MCP server

### Check Your Setup

```bash
node --version   # Use 22.14+ or 24.10+ for development tooling
npm --version    # Should be >= 9.0.0
git --version    # Any recent version
```

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/kdpa-llc/local-skills-mcp.git
cd local-skills-mcp
```

### 2. Install Dependencies

```bash
npm install
```

This will:

- Install all dependencies
- Run the `prepare` script which builds the TypeScript code
- Create the `dist/` directory with compiled JavaScript

### 3. Build the Project

```bash
npm run build
```

Or use watch mode for auto-rebuild:

```bash
npm run watch
```

### 4. Run Tests

```bash
npm test         # Run tests in watch mode
npm run test:run # Run tests once
```

### 5. Try It Out

Create a test skill:

```bash
mkdir -p skills/test-skill
cat > skills/test-skill/SKILL.md << 'EOF'
---
name: Test Skill
description: A simple test skill for development
---

# Test Skill

This is a test skill for development purposes.
EOF
```

Run the server:

```bash
node dist/index.js
```

---

## Project Structure

```
local-skills-mcp/
├── src/                    # TypeScript source files
│   ├── index.ts           # Main server and entry point
│   ├── skill-loader.ts    # Skill discovery and loading logic
│   ├── types.ts           # TypeScript interfaces
│   ├── *.test.ts          # Test files
│   ├── integration.test.ts # Integration tests
│   └── e2e.test.ts        # End-to-end tests
├── dist/                   # Compiled JavaScript (git-ignored)
├── docs/                   # Documentation
│   ├── API.md             # API reference
│   ├── ARCHITECTURE.md    # Architecture documentation
│   └── DEVELOPER_GUIDE.md # This file
├── .github/               # GitHub configuration
│   ├── workflows/         # CI/CD workflows
│   ├── ISSUE_TEMPLATE/    # Issue templates
│   └── CODEOWNERS         # Code ownership
├── skills/                # Example skills (git-ignored)
├── package.json           # Node.js package configuration
├── tsconfig.json          # TypeScript configuration
├── typedoc.json           # TypeDoc configuration
└── README.md              # User-facing documentation
```

### Key Files

- **src/index.ts**: Main entry point, MCP server setup, request handlers
- **src/skill-loader.ts**: Core logic for skill discovery, loading, caching
- **src/types.ts**: TypeScript interfaces for Skill and SkillMetadata
- **package.json**: Dependencies, scripts, and package metadata
- **tsconfig.json**: TypeScript compiler options

---

## Development Workflow

### Watch Mode (Recommended)

For active development, use watch mode:

```bash
# Terminal 1: Auto-rebuild on changes
npm run watch

# Terminal 2: Run tests in watch mode
npm test

# Terminal 3: Run server for manual testing (optional)
node dist/index.js
```

### Build & Test Cycle

For single-run builds:

```bash
npm run build        # Compile TypeScript
npm run test:run     # Run all tests once
npm run lint         # Check code style (if configured)
```

### Pre-Commit Checklist

Before committing changes:

1. ✅ Build succeeds: `npm run build`
2. ✅ All tests pass: `npm run test:run`
3. ✅ Type checking passes (automatic with build)
4. ✅ Code follows style guide (see [Code Style](#code-style))
5. ✅ Added tests for new features
6. ✅ Updated documentation if needed

---

## Testing

### Test Structure

We use **Vitest** for all testing. Tests are organized by type:

- **Unit Tests**: Test individual functions/classes (`*.test.ts`)
- **Integration Tests**: Test component interactions (`integration.test.ts`)
- **E2E Tests**: Test full server flow (`e2e.test.ts`)

### Running Tests

```bash
# All tests in watch mode (auto-reruns on changes)
npm test

# Run all tests once
npm run test:run

# Run tests with coverage
npm run test:coverage

# Run specific test types
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # E2E tests only

# Run with UI (browser-based test runner)
npm run test:ui
```

### Writing Tests

**Example Unit Test:**

```typescript
import { describe, it, expect } from "vitest";
import { SkillLoader } from "./skill-loader.js";

describe("SkillLoader", () => {
  it("should discover skills in directory", async () => {
    const loader = new SkillLoader(["./test-skills"]);
    const skills = await loader.discoverSkills();

    expect(skills).toContain("test-skill");
  });
});
```

**Example Integration Test:**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { LocalSkillsServer } from "./index.js";

describe("LocalSkillsServer Integration", () => {
  let server: LocalSkillsServer;

  beforeEach(() => {
    server = new LocalSkillsServer();
  });

  it("should handle get_skill request", async () => {
    // Test server request handling
  });
});
```

### Coverage Goals

- **Overall**: 95%+ coverage
- **Statements**: 95%+
- **Branches**: 90%+
- **Functions**: 95%+
- **Lines**: 95%+

Check coverage:

```bash
npm run test:coverage
# Coverage report in coverage/index.html
```

---

## Debugging

### VS Code Setup

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "program": "${workspaceFolder}/dist/index.js",
      "preLaunchTask": "npm: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "sourceMaps": true,
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "test:run"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Debugging Techniques

#### 1. Console Logging

```typescript
// Add debug logs (stderr for MCP compatibility)
console.error("[DEBUG] Loading skill:", skillName);
console.error("[DEBUG] Cache size:", this.skillCache.size);
```

#### 2. VS Code Breakpoints

1. Set breakpoints in TypeScript source files
2. Press F5 or use "Debug Server" configuration
3. Step through code with F10 (step over) or F11 (step into)

#### 3. Testing with MCP Inspector

Use the MCP Inspector tool to test server communication:

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Run inspector
mcp-inspector node dist/index.js
```

#### 4. Check MCP Communication

When integrated with Claude, check stderr logs:

```bash
# Run with explicit stderr output
node dist/index.js 2> server.log

# In another terminal
tail -f server.log
```

### Common Debug Scenarios

**Skill not loading:**

1. Check if SKILL.md exists: `ls skills/skill-name/SKILL.md`
2. Verify YAML frontmatter format
3. Check server logs for parse errors

**MCP connection issues:**

1. Verify `dist/index.js` exists and is executable
2. Check MCP client configuration
3. Review stdio communication in logs

**Caching issues:**

1. Restart server to clear cache
2. Check `skillCache` contents with debug logs
3. Verify `discoverSkills()` is called before `loadSkill()`

---

## Code Style

### TypeScript Style Guidelines

#### 1. Naming Conventions

```typescript
// Classes: PascalCase
class SkillLoader { }
class LocalSkillsServer { }

// Interfaces: PascalCase
interface Skill { }
interface SkillMetadata { }

// Functions: camelCase
function getAllSkillsDirectories() { }
async function loadSkill() { }

// Variables: camelCase
const skillName = 'test';
let isValid = true;

// Constants: UPPER_SNAKE_CASE for config
const VERSION = '0.1.0';
const SKILLS_DIRS = getAllSkillsDirectories();

// Private members: prefix with underscore (optional)
private _cache = new Map();
```

#### 2. Type Annotations

Always use explicit types for public APIs:

```typescript
// ✅ Good: Explicit types
async function loadSkill(skillName: string): Promise<Skill> {
  // ...
}

// ❌ Bad: Missing types
async function loadSkill(skillName) {
  // ...
}
```

#### 3. Error Handling

Use descriptive error messages with context:

```typescript
// ✅ Good: Descriptive with context
throw new Error(
  `Skill "${skillName}" not found. Run list_skills to see available skills.`
);

// ❌ Bad: Generic message
throw new Error("Not found");
```

#### 4. Documentation

Use JSDoc for all public APIs:

````typescript
/**
 * Load a specific skill by name with lazy loading and caching.
 *
 * @param skillName - The name of the skill to load
 * @returns Promise resolving to the complete Skill object
 * @throws {Error} If skill is not found or cannot be loaded
 *
 * @example
 * ```typescript
 * const skill = await loader.loadSkill('code-reviewer');
 * ```
 */
async function loadSkill(skillName: string): Promise<Skill> {
  // ...
}
````

#### 5. Async/Await

Prefer async/await over promises:

```typescript
// ✅ Good: async/await
async function loadSkill(skillName: string): Promise<Skill> {
  const content = await fs.readFile(path, "utf-8");
  return parseSkill(content);
}

// ❌ Bad: Promise chains
function loadSkill(skillName: string): Promise<Skill> {
  return fs.readFile(path, "utf-8").then((content) => parseSkill(content));
}
```

### Code Organization

#### File Structure

```typescript
// 1. Imports (external first, then internal)
import fs from "fs/promises";
import path from "path";
import { Skill } from "./types.js";

// 2. Constants
const VERSION = "0.1.0";

// 3. Type definitions (if not in separate file)
interface Config {}

// 4. Functions (utility functions first)
function helperFunction() {}

// 5. Classes
export class MainClass {}

// 6. Main execution (if applicable)
if (import.meta.url === `file://${process.argv[1]}`) {
  // Entry point logic
}
```

### Linting (Future)

_Note: Linting configuration coming soon. Planned tools:_

- ESLint with TypeScript plugin
- Prettier for formatting
- Pre-commit hooks with Husky

---

## Common Tasks

### Adding a New Feature

1. **Create a feature branch**:

   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Write tests first** (TDD approach):

   ```typescript
   // src/my-feature.test.ts
   describe("MyFeature", () => {
     it("should do something", () => {
       // Test implementation
     });
   });
   ```

3. **Implement the feature**:

   ```typescript
   // src/my-feature.ts
   export function myFeature() {
     // Implementation
   }
   ```

4. **Add documentation**:
   - Update API.md if public API changed
   - Update README.md if user-facing
   - Add JSDoc comments

5. **Test thoroughly**:

   ```bash
   npm run test:run
   npm run test:coverage
   ```

6. **Commit and push**:
   ```bash
   git add .
   git commit -m "feat: add my new feature"
   git push origin feature/my-new-feature
   ```

### Debugging a Failing Test

1. **Run the specific test**:

   ```bash
   npm test -- skill-loader.test.ts
   ```

2. **Add debug output**:

   ```typescript
   it("should load skill", async () => {
     console.log("Test data:", testData);
     const result = await loadSkill("test");
     console.log("Result:", result);
     expect(result).toBeDefined();
   });
   ```

3. **Use VS Code debugger**:
   - Set breakpoint in test
   - Run "Debug Tests" configuration
   - Inspect variables

### Updating Dependencies

```bash
# Check for outdated dependencies
npm outdated

# Update specific package
npm install package-name@latest

# Update all (be careful!)
npm update

# Audit security
npm audit
npm audit fix
```

### Generating Documentation

```bash
# Generate TypeDoc documentation
npm run docs

# View generated docs
open docs/api/index.html  # macOS
xdg-open docs/api/index.html  # Linux
start docs/api/index.html  # Windows
```

---

## Common Pitfalls

### 1. Forgetting to Build

**Problem**: Changes in TypeScript not reflected in execution.

**Solution**: Always build after changes:

```bash
npm run build
# Or use watch mode
npm run watch
```

### 2. Import Path Extensions

**Problem**: TypeScript imports without .js extension fail at runtime.

**Correct**:

```typescript
import { Skill } from "./types.js"; // ✅ With .js
```

**Incorrect**:

```typescript
import { Skill } from "./types"; // ❌ No extension
```

### 3. Async Error Handling

**Problem**: Unhandled promise rejections.

**Solution**: Always use try/catch with async:

```typescript
async function loadSkill(name: string) {
  try {
    const content = await fs.readFile(path, "utf-8");
    return parseSkill(content);
  } catch (error) {
    throw new Error(`Failed to load skill: ${error.message}`);
  }
}
```

### 4. MCP stdio Conflicts

**Problem**: console.log() interferes with MCP protocol.

**Solution**: Use console.error() for logging:

```typescript
// ✅ Good: stderr
console.error("Debug info:", data);

// ❌ Bad: stdout (conflicts with MCP)
console.log("Debug info:", data);
```

### 5. Testing with Cached Skills

**Problem**: Cached data from previous test runs.

**Solution**: Clear cache in beforeEach:

```typescript
beforeEach(() => {
  loader = new SkillLoader([testDir]);
  // Cache is fresh for each test
});
```

### 6. Type Assertions

**Problem**: Unsafe type assertions hiding errors.

**Avoid**:

```typescript
const skill = data as Skill; // Unsafe
```

**Better**:

```typescript
if (!isValidSkill(data)) {
  throw new Error("Invalid skill format");
}
const skill: Skill = data;
```

---

## Resources

### Documentation

- **[README.md](../README.md)**: User guide and quick start
- **[API.md](./API.md)**: Complete API reference
- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: System architecture
- **[CONTRIBUTING.md](../CONTRIBUTING.md)**: Contribution guidelines

### External Resources

- **MCP Protocol**: https://modelcontextprotocol.io/
- **TypeScript**: https://www.typescriptlang.org/docs/
- **Vitest**: https://vitest.dev/
- **Node.js**: https://nodejs.org/docs/

### Tools

- **VS Code**: https://code.visualstudio.com/
- **TypeDoc**: https://typedoc.org/
- **MCP Inspector**: https://github.com/modelcontextprotocol/inspector

### Community

- **GitHub Issues**: https://github.com/kdpa-llc/local-skills-mcp/issues
- **Discussions**: https://github.com/kdpa-llc/local-skills-mcp/discussions
- **Pull Requests**: https://github.com/kdpa-llc/local-skills-mcp/pulls

---

## Tips for Success

1. **Use TypeScript strict mode**: Catch errors early
2. **Write tests first**: TDD helps design better APIs
3. **Keep commits small**: Easier to review and debug
4. **Ask questions**: Use GitHub Discussions or Issues
5. **Read existing code**: Learn from current patterns
6. **Document as you go**: Don't leave it for later
7. **Test with real MCP clients**: Catch integration issues early

---

## Next Steps

1. **Read the [Architecture](./ARCHITECTURE.md)** to understand the system design
2. **Browse the [API documentation](./API.md)** to learn the public interfaces
3. **Check [CONTRIBUTING.md](../CONTRIBUTING.md)** for contribution workflow
4. **Look at existing tests** for examples of testing patterns
5. **Try adding a small feature** to get familiar with the codebase

---

## Getting Help

- **Bug reports**: Open an [issue](https://github.com/kdpa-llc/local-skills-mcp/issues)
- **Feature requests**: Open an [issue](https://github.com/kdpa-llc/local-skills-mcp/issues)
- **Questions**: Start a [discussion](https://github.com/kdpa-llc/local-skills-mcp/discussions)
- **Security issues**: See [SECURITY.md](../SECURITY.md)

---

**Welcome to the team! Happy coding! 🚀**
