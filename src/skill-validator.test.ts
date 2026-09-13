import { describe, it, expect } from "vitest";
import { validateSkillContent, validateSkillFile } from "./skill-validator.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

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

  it("rejects description longer than 1024 characters", () => {
    const longDesc = "A".repeat(1025);
    const result = validateSkillContent(`---
name: long-desc
description: ${longDesc}
---

Content here.`);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Skill description must be 1024 characters or fewer"
    );
  });

  it("rejects description containing angle brackets", () => {
    const result = validateSkillContent(`---
name: angle-test
description: This has <html> tags which are not allowed. Use when testing validation.
---

Content here.`);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Skill description cannot contain angle brackets (< or >)"
    );
  });

  it("rejects reserved skill names", () => {
    const result = validateSkillContent(`---
name: get_skill
description: Trying to use a reserved name. Use when testing validation.
---

Content here.`);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Skill name "get_skill" is reserved');
  });

  it("rejects skill name longer than 64 characters", () => {
    const longName = "a-" + "b".repeat(63);
    const result = validateSkillContent(`---
name: ${longName}
description: A skill with a very long name. Use when testing validation of long names.
---

Content here.`);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Skill name must be 64 characters or fewer"
    );
  });

  it("rejects frontmatter without closing delimiter", () => {
    const result = validateSkillContent(`---
name: broken
description: Missing end delimiter`);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "SKILL.md frontmatter must end with --- delimiter"
    );
  });

  it("rejects non-object frontmatter", () => {
    const result = validateSkillContent(`---
- just a list
---

Content.`);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "SKILL.md frontmatter must be a YAML object"
    );
  });

  it("rejects missing name and description", () => {
    const result = validateSkillContent(`---
other: value
---

Content.`);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'SKILL.md frontmatter must include non-empty "name" field'
    );
    expect(result.errors).toContain(
      'SKILL.md frontmatter must include non-empty "description" field'
    );
  });
});

describe("validateSkillFile", () => {
  it("validates a real skill file", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-test-"));
    const skillPath = path.join(tmpDir, "SKILL.md");

    await fs.writeFile(
      skillPath,
      `---
name: test-skill
description: A test skill for validation testing. Use when running unit tests.
---

# Instructions

Do the thing.`
    );

    try {
      const result = await validateSkillFile(skillPath);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns error for non-existent file", async () => {
    const result = await validateSkillFile("/nonexistent/SKILL.md");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("SKILL.md not found");
  });

  it("returns error for unreadable file", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-test-"));
    const skillPath = path.join(tmpDir, "SKILL.md");

    // Create a directory with the same name as the file to cause a read error
    await fs.mkdir(skillPath);

    try {
      const result = await validateSkillFile(skillPath);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Failed to read SKILL.md");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
