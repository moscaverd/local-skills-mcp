# Branch Protection Rules

This document outlines the branch protection settings for the `local-skills-mcp` repository and provides guidance on emergency procedures.

## Main Branch Protection

The `main` branch is the production-ready branch and has strict protection rules to ensure code quality and stability.

### Required Settings

#### Pull Request Requirements

- **Require a pull request before merging**: Enabled
  - **Required approvals**: 1
  - **Dismiss stale reviews**: Enabled (when new commits are pushed)
  - **Require review from Code Owners**: Enabled
  - **Restrict who can dismiss pull request reviews**: Only maintainers

#### Status Checks

The following status checks must pass before merging:

- `test` - Full test suite execution
- `lint` - Code linting (ESLint)
- `typecheck` - TypeScript type checking
- `build` - Successful build verification

**Additional Requirements**:

- Require branches to be up to date before merging
- Require status checks to pass

#### Push Restrictions

- **Restrict pushes that create matching branches**: Enabled
- **Allowed to push**: `kdpa-llc/maintainers` team only
- **Force pushes**: Disabled for everyone
- **Branch deletions**: Disabled for everyone

#### Additional Protections

- **Require linear history**: Enabled (to maintain clean git history)
- **Require signed commits**: Recommended but not enforced initially
- **Include administrators**: Enabled (administrators must follow the same rules)
  - Exception: Administrators can bypass in true emergencies (see below)

### Security Configuration

#### Dependency Scanning

- **Dependabot alerts**: Enabled
- **Dependabot security updates**: Enabled
- **Dependency review**: Required for pull requests

#### Secret Scanning

- **Secret scanning**: Enabled
- **Push protection**: Enabled (prevents accidental secret commits)

#### Code Scanning

- **CodeQL analysis**: Enabled
- Run on: Pull requests, pushes to main, and weekly schedule
- Languages: TypeScript/JavaScript

## Rationale

### Why These Protections?

1. **Pull Request Requirements**: Ensures all code changes are reviewed by at least one other developer, reducing bugs and improving code quality through peer review.

2. **Required Status Checks**: Automated testing, linting, and type checking catch issues early before they reach the main branch.

3. **Code Owner Review**: Subject matter experts review changes to critical parts of the codebase they own.

4. **Up-to-date Branches**: Prevents integration issues by ensuring PRs are merged with the latest main branch changes.

5. **No Force Pushes**: Protects against accidental history rewriting which could cause issues for all contributors.

6. **Linear History**: Makes it easier to track changes, revert commits, and understand project evolution.

7. **Security Scanning**: Proactively identifies vulnerabilities in dependencies and prevents accidental secret leaks.

## Emergency Procedures

### When to Bypass Protection

Branch protection should only be bypassed in true emergencies:

- Critical security vulnerability requiring immediate hotfix
- Production-breaking bug that needs urgent resolution
- Infrastructure issue preventing normal PR workflow

### How to Handle Emergencies

1. **Assess the Situation**: Confirm it's truly an emergency that justifies bypassing normal procedures.

2. **Notify Team**: Before bypassing, notify the team via:
   - Repository discussions
   - Team communication channels
   - Tag relevant maintainers

3. **Administrator Bypass**:
   - Only repository administrators can bypass protections
   - Use `git push --force-with-lease` sparingly and only if absolutely necessary
   - Never use `git push --force` (without lease)

4. **Post-Emergency Actions**:
   - Create an issue documenting what happened
   - If bypass was used, create a follow-up PR for proper review
   - Conduct post-mortem to prevent similar emergencies
   - Update documentation or processes as needed

5. **Emergency Hotfix Process**:
   ```bash
   # Create hotfix branch from main
   git checkout main
   git pull origin main
   git checkout -b hotfix/critical-issue-description

   # Make minimal necessary changes
   # ... make changes ...

   # Test locally
   npm test
   npm run lint
   npm run build

   # Push and create PR (even in emergency, try to follow process)
   git push -u origin hotfix/critical-issue-description
   gh pr create --title "HOTFIX: Description" --body "Emergency fix for [issue]"

   # If absolutely necessary and workflow is broken, administrator can merge directly
   # But this should be extremely rare
   ```

## Tag Protection

Version tags are also protected:

- **Protected tag pattern**: `v*` (all version tags)
- **Allowed to create**: `kdpa-llc/maintainers` team only
- **Prevent tag deletion**: Enabled

This ensures release versions are immutable and traceable.

## Team Roles and Access

### Maintainers Team (`kdpa-llc/maintainers`)

- Can approve and merge pull requests
- Can create protected branches
- Can create version tags
- Subject to all protection rules (except administrators in emergencies)

### Core Team (`kdpa-llc/core-team`)

- Code owners for source code
- Reviews required for src/ changes
- Cannot merge without maintainer approval

### Contributors

- Can create pull requests
- Can review code (non-binding)
- Cannot push directly to protected branches

## Testing Protection Rules

To verify branch protection is working correctly:

1. **Test Direct Push** (should fail):

   ```bash
   git checkout main
   git commit --allow-empty -m "Test commit"
   git push origin main
   # Expected: Error - protected branch
   ```

2. **Test Force Push** (should fail):

   ```bash
   git push --force origin main
   # Expected: Error - force push not allowed
   ```

3. **Test PR Without Approval** (should be blocked):
   - Create PR
   - Attempt to merge without approval
   - Expected: Blocked by required reviews

4. **Test PR Without Status Checks** (should be blocked):
   - Create PR
   - Get approval before checks complete
   - Attempt to merge
   - Expected: Blocked by required status checks

5. **Test Tag Creation** (non-maintainer should fail):
   ```bash
   git tag v999.999.999
   git push origin v999.999.999
   # Expected: Success for maintainers, failure for others
   ```

## Maintenance

This document should be reviewed and updated:

- When protection rules change
- Quarterly as part of security review
- After any emergency bypass incident
- When team structure changes

Last Updated: 2025-11-05
Maintained by: kdpa-llc/maintainers
