import fs from "fs/promises";
import YAML from "yaml";

const RESERVED_NAMES = new Set([
  "get_skill",
  "validate_skill",
  "evaluate_skill",
]);

export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface SkillFrontmatter {
  name?: unknown;
  description?: unknown;
  [key: string]: unknown;
}

function parseSkillContent(content: string): {
  frontmatter: SkillFrontmatter;
  body: string;
} {
  if (!content.startsWith("---\n")) {
    throw new Error("SKILL.md must start with YAML frontmatter (---)");
  }

  const endDelimiterIndex = content.indexOf("\n---\n", 4);
  if (endDelimiterIndex === -1) {
    throw new Error("SKILL.md frontmatter must end with --- delimiter");
  }

  const frontmatterText = content.substring(4, endDelimiterIndex);
  const parsed = YAML.parse(frontmatterText) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("SKILL.md frontmatter must be a YAML object");
  }

  return {
    frontmatter: parsed as SkillFrontmatter,
    body: content.substring(endDelimiterIndex + 5).trim(),
  };
}

export function validateSkillContent(content: string): SkillValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let parsed: { frontmatter: SkillFrontmatter; body: string };
  try {
    parsed = parseSkillContent(content);
  } catch (error) {
    return {
      valid: false,
      errors: [(error as Error).message],
      warnings,
    };
  }

  const allowedKeys = new Set(["name", "description"]);
  for (const key of Object.keys(parsed.frontmatter)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unexpected frontmatter key: ${key}`);
    }
  }

  const name = parsed.frontmatter.name;
  if (typeof name !== "string" || name.trim().length === 0) {
    errors.push('SKILL.md frontmatter must include non-empty "name" field');
  } else {
    if (name.length > 64) {
      errors.push("Skill name must be 64 characters or fewer");
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      errors.push(
        "Skill name must be kebab-case (lowercase letters, numbers, hyphens)"
      );
    }
    if (RESERVED_NAMES.has(name)) {
      errors.push(`Skill name "${name}" is reserved`);
    }
  }

  const description = parsed.frontmatter.description;
  if (typeof description !== "string" || description.trim().length === 0) {
    errors.push(
      'SKILL.md frontmatter must include non-empty "description" field'
    );
  } else {
    if (description.length > 1024) {
      errors.push("Skill description must be 1024 characters or fewer");
    }
    if (/[<>]/.test(description)) {
      errors.push("Skill description cannot contain angle brackets (< or >)");
    }

    if (description.length < 50) {
      warnings.push(
        "Description is short (< 50 chars). Add more detail to improve skill routing."
      );
    }

    if (!/\buse when\b/i.test(description)) {
      warnings.push(
        'Description should include a "Use when ..." trigger phrase.'
      );
    }
  }

  if (parsed.body.length === 0) {
    warnings.push("No content found after frontmatter.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function validateSkillFile(
  skillFilePath: string
): Promise<SkillValidationResult> {
  try {
    const content = await fs.readFile(skillFilePath, "utf8");
    return validateSkillContent(content);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return {
        valid: false,
        errors: [`SKILL.md not found: ${skillFilePath}`],
        warnings: [],
      };
    }

    return {
      valid: false,
      errors: [
        `Failed to read SKILL.md (${skillFilePath}): ${(error as Error).message}`,
      ],
      warnings: [],
    };
  }
}
