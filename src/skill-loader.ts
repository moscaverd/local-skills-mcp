import fs from "fs/promises";
import path from "path";
import YAML from "yaml";
import { Skill, SkillMetadata } from "./types.js";

/**
 * Manages skill discovery and loading across multiple directories.
 *
 * SkillLoader is responsible for:
 * - Discovering skills in configured directories
 * - Loading and parsing SKILL.md files with YAML frontmatter
 * - Managing the skill registry for fast lookups
 *
 * Skills are loaded fresh from disk on each request to support hot reload.
 *
 * @example
 * ```typescript
 * const loader = new SkillLoader([
 *   '/home/user/.claude/skills',
 *   '/home/user/project/skills'
 * ]);
 * const skills = await loader.discoverSkills();
 * const skill = await loader.loadSkill('code-reviewer');
 * ```
 */
export class SkillLoader {
  private skillsPaths: string[];
  private skillRegistry = new Map<string, { path: string; source: string }>();

  /**
   * Creates a new SkillLoader instance.
   *
   * @param skillsPaths - Array of directory paths to search for skills
   *
   * @example
   * ```typescript
   * const loader = new SkillLoader([
   *   '/home/user/.claude/skills',
   *   '/home/user/project/skills'
   * ]);
   * ```
   */
  constructor(skillsPaths: string[]) {
    this.skillsPaths = skillsPaths;
  }

  /**
   * Parse SKILL.md file with YAML frontmatter
   */
  private parseSkillFile(content: string): {
    metadata: SkillMetadata;
    content: string;
  } {
    // Check if file starts with frontmatter delimiter
    if (!content.startsWith("---\n")) {
      throw new Error("SKILL.md must start with YAML frontmatter (---)");
    }

    // Find the closing delimiter
    const endDelimiterIndex = content.indexOf("\n---\n", 4);
    if (endDelimiterIndex === -1) {
      throw new Error("SKILL.md frontmatter must end with --- delimiter");
    }

    // Extract and parse YAML frontmatter
    const frontmatterText = content.substring(4, endDelimiterIndex);
    const metadata = YAML.parse(frontmatterText) as SkillMetadata;

    // Validate required fields
    if (!metadata.name) {
      throw new Error('SKILL.md frontmatter must include "name" field');
    }
    if (!metadata.description) {
      throw new Error('SKILL.md frontmatter must include "description" field');
    }

    // Extract content after frontmatter
    const skillContent = content.substring(endDelimiterIndex + 5).trim();

    return { metadata, content: skillContent };
  }

  /**
   * Discover all available skills aggregated from all directories.
   *
   * Scans all configured directories for subdirectories containing SKILL.md files.
   * Later directories override earlier ones for duplicate skill names.
   * The internal skill registry is rebuilt on each call.
   *
   * @returns Promise resolving to a sorted array of skill names
   *
   * @example
   * ```typescript
   * const skillNames = await loader.discoverSkills();
   * console.log(skillNames);
   * // Output: ['code-reviewer', 'test-generator', 'refactoring-expert']
   * ```
   */
  async discoverSkills(): Promise<string[]> {
    this.skillRegistry.clear();
    const allSkills = new Map<string, { path: string; source: string }>();

    // Iterate through all skill directories
    for (const skillsPath of this.skillsPaths) {
      try {
        const entries = await fs.readdir(skillsPath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const skillPath = path.join(skillsPath, entry.name);
            const skillFilePath = path.join(skillPath, "SKILL.md");

            try {
              await fs.access(skillFilePath);
              // Later directories override earlier ones for duplicate names
              allSkills.set(entry.name, {
                path: skillPath,
                source: skillsPath,
              });
            } catch {
              // Skip directories without SKILL.md
              continue;
            }
          }
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          console.error(`Error reading directory ${skillsPath}:`, error);
        }
        // Continue with other directories even if one fails
        continue;
      }
    }

    // Update registry
    this.skillRegistry = allSkills;

    // Return sorted skill names
    return Array.from(allSkills.keys()).sort();
  }

  /**
   * Load a specific skill by name, reading fresh from disk each time.
   *
   * Loads the SKILL.md file, parses YAML frontmatter, and validates metadata.
   * Skills are always read fresh to support hot reload of content changes.
   *
   * @param skillName - The name of the skill to load
   * @returns Promise resolving to the complete Skill object
   * @throws {Error} If skill is not found in registry or file cannot be loaded/parsed
   *
   * @example
   * ```typescript
   * const skill = await loader.loadSkill('code-reviewer');
   * console.log(skill.name);        // 'Code Reviewer'
   * console.log(skill.description); // 'Expert code review assistant'
   * console.log(skill.content);     // Full skill prompt content
   * console.log(skill.source);      // '/home/user/.claude/skills'
   * ```
   *
   * @example
   * ```typescript
   * // Error handling
   * try {
   *   const skill = await loader.loadSkill('non-existent');
   * } catch (error) {
   *   console.error(error.message);
   *   // "Skill "non-existent" not found. Run list_skills to see available skills."
   * }
   * ```
   */
  async loadSkill(skillName: string): Promise<Skill> {
    // Get skill location from registry
    let skillInfo = this.skillRegistry.get(skillName);

    // If skill is not found and registry is empty, try discovering skills first
    // This handles cases where loadSkill is called before list_skills
    if (!skillInfo && this.skillRegistry.size === 0) {
      await this.discoverSkills();
      skillInfo = this.skillRegistry.get(skillName);
    }

    if (!skillInfo) {
      throw new Error(
        `Skill "${skillName}" not found. Run list_skills to see available skills.`
      );
    }

    const skillFilePath = path.join(skillInfo.path, "SKILL.md");

    try {
      // Load and parse SKILL.md fresh from disk
      const fileContent = await fs.readFile(skillFilePath, "utf-8");
      const { metadata, content } = this.parseSkillFile(fileContent);

      const skill: Skill = {
        name: metadata.name,
        description: metadata.description,
        content,
        path: skillInfo.path,
        source: skillInfo.source,
      };

      return skill;
    } catch (error) {
      throw new Error(
        `Failed to load skill "${skillName}": ${(error as Error).message}`
      );
    }
  }

  /**
   * Get skill metadata without loading the full content.
   *
   * Lightweight operation that loads only the YAML frontmatter without
   * the full skill content. Useful for listing skills with descriptions.
   *
   * @param skillName - The name of the skill
   * @returns Promise resolving to metadata with source directory
   * @throws {Error} If skill is not found or metadata cannot be loaded
   *
   * @example
   * ```typescript
   * const metadata = await loader.getSkillMetadata('code-reviewer');
   * console.log(metadata.name);        // 'Code Reviewer'
   * console.log(metadata.description); // 'Expert code review assistant'
   * console.log(metadata.source);      // '/home/user/.claude/skills'
   * // Note: metadata does not include 'content' field
   * ```
   */
  async getSkillMetadata(
    skillName: string
  ): Promise<SkillMetadata & { source: string }> {
    const skillInfo = this.skillRegistry.get(skillName);
    if (!skillInfo) {
      throw new Error(`Skill "${skillName}" not found`);
    }

    const skillFilePath = path.join(skillInfo.path, "SKILL.md");

    try {
      const fileContent = await fs.readFile(skillFilePath, "utf-8");
      const { metadata } = this.parseSkillFile(fileContent);
      return {
        ...metadata,
        source: skillInfo.source,
      };
    } catch (error) {
      throw new Error(
        `Failed to load metadata for skill "${skillName}": ${(error as Error).message}`
      );
    }
  }

  /**
   * Get all skills directories being monitored.
   *
   * @returns Array of directory paths configured for this loader
   *
   * @example
   * ```typescript
   * const paths = loader.getSkillsPaths();
   * console.log(paths);
   * // Output: ['/home/user/.claude/skills', '/home/user/project/skills']
   * ```
   */
  getSkillsPaths(): string[] {
    return this.skillsPaths;
  }
}
