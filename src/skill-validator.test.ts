import { describe, it, expect } from "vitest";
import { validateSkillContent } from "./skill-validator.js";

describe("validateSkillContent", () => {
  it("validates a well-formed skill", () => {
    const result = validateSkillContent(`---
name: code-reviewer
description: Reviews code for quality and security issues. Use when reviewing pull requests or auditing implementation details.
---

# Instructions

Do a thorough review.`);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("reports expected errors", () => {
    const result = validateSkillContent(`---
name: INVALID_NAME
description: <bad>
extra: nope
---
`);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Unexpected frontmatter key: extra");
    expect(result.errors).toContain(
      "Skill name must be kebab-case (lowercase letters, numbers, hyphens)"
    );
    expect(result.errors).toContain(
      "Skill description cannot contain angle brackets (< or >)"
    );
  });

  it("reports warnings for short or incomplete docs", () => {
    const result = validateSkillContent(`---
name: short-desc
description: Very short description only.
---
`);

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain(
      "Description is short (< 50 chars). Add more detail to improve skill routing."
    );
    expect(result.warnings).toContain(
      'Description should include a "Use when ..." trigger phrase.'
    );
    expect(result.warnings).toContain("No content found after frontmatter.");
  });

  it("fails when SKILL.md does not contain valid frontmatter", () => {
    const result = validateSkillContent("# not frontmatter");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "SKILL.md must start with YAML frontmatter (---)"
    );
  });
});
