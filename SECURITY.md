# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take the security of Local Skills MCP seriously. If you discover a security vulnerability, please follow these steps:

### How to Report

**Please do NOT open a public issue.**

Instead:

1. **Email**: Report vulnerabilities via GitHub's private vulnerability reporting feature, or
2. **GitHub Issues**: Create a new issue marked with the "security" label and we'll address it privately

### What to Include

When reporting a vulnerability, please include:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if you have one)
- Your contact information

### Response Timeline

- **Acknowledgment**: We aim to acknowledge receipt within 48 hours
- **Initial Assessment**: We'll provide an initial assessment within 5 business days
- **Updates**: We'll keep you informed of our progress
- **Resolution**: We aim to release a fix as soon as possible, depending on complexity

### Disclosure Policy

- Please give us reasonable time to fix the issue before public disclosure
- We'll credit you in the security advisory (unless you prefer to remain anonymous)
- We'll coordinate with you on the disclosure timeline

## Security Best Practices

When using Local Skills MCP:

### For Users

1. **Keep Updated**: Always use the latest version
2. **Review Skills**: Carefully review any skills before using them
3. **Trust Sources**: Only use skills from trusted sources
4. **Environment Variables**: Protect any sensitive environment variables
5. **File Permissions**: Ensure skill directories have appropriate permissions

### For Skill Authors

1. **No Secrets**: Never include API keys, passwords, or secrets in skills
2. **Input Validation**: Validate any user inputs in skill instructions
3. **Clear Documentation**: Document any security considerations
4. **Dependencies**: Keep skill dependencies minimal and reviewed

## Known Security Considerations

### Skill Content

- Skills are loaded and executed as prompt instructions
- Skills can contain any text content - review before use
- Skills from untrusted sources could contain malicious instructions

### File System Access

- The MCP server reads from configured directories
- Ensure directories have appropriate permissions
- Skills are loaded as-is from the file system

### Environment

- The server runs with the permissions of the user who starts it
- Environment variables are accessible to the server
- Use appropriate security practices for your environment

## Security Updates

Security updates will be:

- Released as patch versions (e.g., 0.1.1)
- Documented in CHANGELOG.md
- Announced in the release notes
- Tagged with [SECURITY] in commit messages

## Contact

For security concerns, please use GitHub's security features or create a private issue.

Thank you for helping keep Local Skills MCP secure!
