# Contributing to Local Skills MCP

Thank you for your interest in contributing to Local Skills MCP! We welcome contributions from the community.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue on GitHub with:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Your environment (Node version, OS, etc.)
- Any relevant logs or error messages

### Suggesting Features

We welcome feature suggestions! Please open an issue with:

- A clear description of the feature
- The problem it solves
- Any examples or use cases
- Optional: proposed implementation approach

### Pull Requests

1. **Fork the repository** and create your branch from `main`

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clear, concise commit messages
   - Follow the existing code style
   - Add tests if applicable
   - Update documentation as needed

3. **Test your changes**

   ```bash
   npm install
   npm run build
   ```

4. **Submit a pull request**
   - Provide a clear description of the changes
   - Reference any related issues
   - Ensure CI checks pass

## Development Setup

Use Node.js 22.14+ (22 LTS recommended) or 24.10+ for development and release tooling. The published server requires Node.js 20+ for its patched production dependency graph; CI tests its npm tarball separately on Node 20, 22, and 24 without development dependencies. This separates application compatibility from the stricter engines of Vitest and semantic-release.

Tests use temporary skill directories and isolate subprocess home lookups; they must not read or alter a contributor's real skill library. Evaluator tests mock external Python and Claude processes.

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/local-skills.git
cd local-skills

# Install dependencies
npm install

# Build the project
npm run build

# Watch mode for development
npm run watch
```

## Code Style

- Use TypeScript with strict type checking
- Follow existing patterns and conventions
- Keep functions focused and modular
- Add comments for complex logic
- Use meaningful variable and function names

## Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning and changelog generation.

### Commit Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Commit Types

- **feat**: A new feature (triggers minor version bump)
- **fix**: A bug fix (triggers patch version bump)
- **perf**: A performance improvement (triggers patch version bump)
- **docs**: Documentation changes (triggers patch version bump)
- **refactor**: Code refactoring without feature changes (triggers patch version bump)
- **build**: Changes to build system or dependencies (triggers patch version bump)
- **style**: Code style changes (formatting, no functional changes)
- **test**: Adding or updating tests
- **ci**: Changes to CI configuration
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit (triggers patch version bump)

### Breaking Changes

To trigger a major version bump, add `BREAKING CHANGE:` in the commit body or append `!` after the type:

```
feat!: redesign skill loading API

BREAKING CHANGE: The skill loading function now returns a Promise
```

### Examples

```bash
# Feature (minor version bump)
feat(loader): add support for YAML skill files

# Bug fix (patch version bump)
fix(server): handle missing skill directory gracefully

# Documentation (patch version bump)
docs(readme): update installation instructions

# Breaking change (major version bump)
feat!: change MCP protocol version to 2.0

BREAKING CHANGE: Requires MCP SDK v2.0 or higher
```

### Guidelines

- Use imperative mood ("Add feature" not "Added feature")
- Reference issues in the footer: `Resolves #123` or `Closes #456`
- Keep subject line under 72 characters
- Separate subject from body with a blank line
- Use body to explain what and why, not how

## Project Structure

```
local-skills-mcp/
├── src/
│   ├── index.ts          # MCP server and handlers
│   ├── skill-loader.ts   # Skill loading logic
│   └── types.ts          # TypeScript type definitions
├── skills/               # Example skills
└── dist/                 # Compiled output
```

## Testing

This project has a comprehensive test suite with unit, integration, and end-to-end tests.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:ui

# Run tests once (CI mode)
npm run test:run

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only
```

### Writing Tests

- Add unit tests for new functions and modules
- Add integration tests for feature interactions
- Add end-to-end tests for complete user workflows
- Aim for high code coverage (95%+ target)
- Use descriptive test names that explain the scenario

### Manual Testing

For manual verification:

1. Build the project: `npm run build`
2. Configure MCP client to use your local build
3. Test skill discovery and loading
4. Verify error handling

## Documentation

When adding features or changing functionality:

- Update README.md
- Update QUICK_START.md if needed
- Add/update code comments
- Consider adding examples

## Community

- Be respectful and inclusive
- Follow our [Code of Conduct](CODE_OF_CONDUCT.md)
- Help others in discussions and issues
- Share your skills and use cases!

## Questions?

Feel free to open an issue for questions or join the discussion in existing issues.

Thank you for contributing! 🎉
