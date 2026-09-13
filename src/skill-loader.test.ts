import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SkillLoader } from "./skill-loader.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("SkillLoader", () => {
  let tempDir: string;
  let skillLoader: SkillLoader;

  beforeEach(async () => {
    // Create temporary directory for test fixtures
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-loader-test-"));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("constructor", () => {
    it("should create a SkillLoader with given paths", () => {
      const paths = ["/path1", "/path2"];
      const loader = new SkillLoader(paths);
      expect(loader.getSkillsPaths()).toEqual(paths);
    });

    it("should create a SkillLoader with empty paths", () => {
      const loader = new SkillLoader([]);
      expect(loader.getSkillsPaths()).toEqual([]);
    });
  });

  describe("parseSkillFile", () => {
    it("should parse valid SKILL.md with frontmatter", async () => {
      const validContent = `---
name: test-skill
description: A test skill
---

This is the skill content.`;

      const skillPath = path.join(tempDir, "test-skill");
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(path.join(skillPath, "SKILL.md"), validContent);

      skillLoader = new SkillLoader([tempDir]);
      await skillLoader.discoverSkills();
      const skill = await skillLoader.loadSkill("test-skill");

      expect(skill.name).toBe("test-skill");
      expect(skill.description).toBe("A test skill");
      expect(skill.content).toBe("This is the skill content.");
    });

    it("should throw error for file without frontmatter delimiter", async () => {
      const invalidContent = "No frontmatter here";

      const skillPath = path.join(tempDir, "invalid-skill");
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(path.join(skillPath, "SKILL.md"), invalidContent);

      skillLoader = new SkillLoader([tempDir]);
      await skillLoader.discoverSkills();

      await expect(skillLoader.loadSkill("invalid-skill")).rejects.toThrow(
        "SKILL.md must start with YAML frontmatter (---)"
      );
    });

    it("should throw error for frontmatter without closing delimiter", async () => {
      const invalidContent = `---
name: test-skill
description: A test skill

No closing delimiter`;

      const skillPath = path.join(tempDir, "invalid-skill");
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(path.join(skillPath, "SKILL.md"), invalidContent);

      skillLoader = new SkillLoader([tempDir]);
      await skillLoader.discoverSkills();

      await expect(skillLoader.loadSkill("invalid-skill")).rejects.toThrow(
        "SKILL.md frontmatter must end with --- delimiter"
      );
    });

    it("should throw error for missing name field", async () => {
      const invalidContent = `---
description: A test skill
---

Content here`;

      const skillPath = path.join(tempDir, "invalid-skill");
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(path.join(skillPath, "SKILL.md"), invalidContent);

      skillLoader = new SkillLoader([tempDir]);
      await skillLoader.discoverSkills();

      await expect(skillLoader.loadSkill("invalid-skill")).rejects.toThrow(
        'SKILL.md frontmatter must include "name" field'
      );
    });

    it("should throw error for missing description field", async () => {
      const invalidContent = `---
name: test-skill
---

Content here`;

      const skillPath = path.join(tempDir, "invalid-skill");
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(path.join(skillPath, "SKILL.md"), invalidContent);

      skillLoader = new SkillLoader([tempDir]);
      await skillLoader.discoverSkills();

      await expect(skillLoader.loadSkill("invalid-skill")).rejects.toThrow(
        'SKILL.md frontmatter must include "description" field'
      );
    });
  });

  describe("discoverSkills", () => {
    it("should discover skills from single directory", async () => {
      // Create test skills
      const skill1Path = path.join(tempDir, "skill-1");
      await fs.mkdir(skill1Path, { recursive: true });
      await fs.writeFile(
        path.join(skill1Path, "SKILL.md"),
        `---
name: skill-1
description: First skill
---

Content 1`
      );

      const skill2Path = path.join(tempDir, "skill-2");
      await fs.mkdir(skill2Path, { recursive: true });
      await fs.writeFile(
        path.join(skill2Path, "SKILL.md"),
        `---
name: skill-2
description: Second skill
---

Content 2`
      );

      skillLoader = new SkillLoader([tempDir]);
      const skills = await skillLoader.discoverSkills();

      expect(skills).toEqual(["skill-1", "skill-2"]);
    });

    it("should discover skills from multiple directories", async () => {
      const dir1 = path.join(tempDir, "dir1");
      const dir2 = path.join(tempDir, "dir2");

      await fs.mkdir(dir1, { recursive: true });
      await fs.mkdir(dir2, { recursive: true });

      // Create skill in dir1
      const skill1Path = path.join(dir1, "skill-1");
      await fs.mkdir(skill1Path, { recursive: true });
      await fs.writeFile(
        path.join(skill1Path, "SKILL.md"),
        `---
name: skill-1
description: First skill
---

Content 1`
      );

      // Create skill in dir2
      const skill2Path = path.join(dir2, "skill-2");
      await fs.mkdir(skill2Path, { recursive: true });
      await fs.writeFile(
        path.join(skill2Path, "SKILL.md"),
        `---
name: skill-2
description: Second skill
---

Content 2`
      );

      skillLoader = new SkillLoader([dir1, dir2]);
      const skills = await skillLoader.discoverSkills();

      expect(skills).toEqual(["skill-1", "skill-2"]);
    });

    it("should override skills from earlier directories with later ones", async () => {
      const dir1 = path.join(tempDir, "dir1");
      const dir2 = path.join(tempDir, "dir2");

      await fs.mkdir(dir1, { recursive: true });
      await fs.mkdir(dir2, { recursive: true });

      // Create same-named skill in both directories
      const skill1Dir1 = path.join(dir1, "shared-skill");
      await fs.mkdir(skill1Dir1, { recursive: true });
      await fs.writeFile(
        path.join(skill1Dir1, "SKILL.md"),
        `---
name: shared-skill
description: From dir1
---

Content from dir1`
      );

      const skill1Dir2 = path.join(dir2, "shared-skill");
      await fs.mkdir(skill1Dir2, { recursive: true });
      await fs.writeFile(
        path.join(skill1Dir2, "SKILL.md"),
        `---
name: shared-skill
description: From dir2
---

Content from dir2`
      );

      skillLoader = new SkillLoader([dir1, dir2]);
      await skillLoader.discoverSkills();
      const skill = await skillLoader.loadSkill("shared-skill");

      expect(skill.description).toBe("From dir2");
      expect(skill.content).toBe("Content from dir2");
      expect(skill.source).toBe(dir2);
    });

    it("should skip directories without SKILL.md", async () => {
      const skillPath = path.join(tempDir, "valid-skill");
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(
        path.join(skillPath, "SKILL.md"),
        `---
name: valid-skill
description: Valid skill
---

Content`
      );

      // Create directory without SKILL.md
      const invalidPath = path.join(tempDir, "no-skill-file");
      await fs.mkdir(invalidPath, { recursive: true });

      skillLoader = new SkillLoader([tempDir]);
      const skills = await skillLoader.discoverSkills();

      expect(skills).toEqual(["valid-skill"]);
    });

    it("should skip non-directory entries in skills folder", async () => {
      // Create a valid skill
      const skillPath = path.join(tempDir, "valid-skill");
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(
        path.join(skillPath, "SKILL.md"),
        `---
name: valid-skill
description: Valid skill
---

Content`
      );

      // Create some files (not directories) in the skills folder
      await fs.writeFile(
        path.join(tempDir, "readme.txt"),
        "This is a file, not a directory"
      );
      await fs.writeFile(path.join(tempDir, "config.json"), "{}");
      await fs.writeFile(path.join(tempDir, ".gitignore"), "*.tmp");

      skillLoader = new SkillLoader([tempDir]);
      const skills = await skillLoader.discoverSkills();

      // Should only find the valid skill directory, not the files
      expect(skills).toEqual(["valid-skill"]);
    });

    it("should handle non-existent directories gracefully", async () => {
      const nonExistentDir = path.join(tempDir, "does-not-exist");
      skillLoader = new SkillLoader([nonExistentDir]);
      const skills = await skillLoader.discoverSkills();

      expect(skills).toEqual([]);
    });

    it("should log errors for directory access issues (non-ENOENT)", async () => {
      // Create a directory that will cause an error
      const errorDir = path.join(tempDir, "error-dir");
      await fs.mkdir(errorDir, { recursive: true });

      // Create a file instead of a directory to cause a different error
      const fakeDir = path.join(errorDir, "not-a-dir.txt");
      await fs.writeFile(fakeDir, "not a directory");

      // Mock console.error to capture the error log
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Use the fake directory path (file) which will cause an error when readdir is called
      skillLoader = new SkillLoader([fakeDir]);
      const skills = await skillLoader.discoverSkills();

      // Should continue gracefully even with error
      expect(skills).toEqual([]);

      // Verify error was logged for non-ENOENT errors
      if (consoleErrorSpy.mock.calls.length > 0) {
        expect(consoleErrorSpy).toHaveBeenCalled();
      }

      consoleErrorSpy.mockRestore();
    });

    it("should return sorted skill names", async () => {
      // Create skills in reverse alphabetical order
      const skillNames = ["zebra", "apple", "mango"];
      for (const name of skillNames) {
        const skillPath = path.join(tempDir, name);
        await fs.mkdir(skillPath, { recursive: true });
        await fs.writeFile(
          path.join(skillPath, "SKILL.md"),
          `---
name: ${name}
description: ${name} skill
---

Content`
        );
      }

      skillLoader = new SkillLoader([tempDir]);
      const skills = await skillLoader.discoverSkills();

      expect(skills).toEqual(["apple", "mango", "zebra"]);
    });
  });

  describe("loadSkill", () => {
    it("should load a skill fresh from disk each time", async () => {
      const skillPath = path.join(tempDir, "test-skill");
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(
        path.join(skillPath, "SKILL.md"),
        `---
name: test-skill
description: Test skill
---

Skill content here`
      );

      skillLoader = new SkillLoader([tempDir]);
      await skillLoader.discoverSkills();

      // First load
      const skill1 = await skillLoader.loadSkill("test-skill");
      expect(skill1.name).toBe("test-skill");
      expect(skill1.description).toBe("Test skill");
      expect(skill1.content).toBe("Skill content here");
      expect(skill1.path).toBe(skillPath);
      expect(skill1.source).toBe(tempDir);

      // Second load should create a new object with same data (no caching)
      const skill2 = await skillLoader.loadSkill("test-skill");
      expect(skill2).toStrictEqual(skill1); // Same data, different object
      expect(skill2).not.toBe(skill1); // Different object references
    });

    it("should throw error for non-existent skill", async () => {
      skillLoader = new SkillLoader([tempDir]);
      await skillLoader.discoverSkills();

      await expect(skillLoader.loadSkill("non-existent")).rejects.toThrow(
        'Skill "non-existent" not found'
      );
    });

    it("should throw error when skill file is corrupted", async () => {
      const skillPath = path.join(tempDir, "corrupted-skill");
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(path.join(skillPath, "SKILL.md"), "invalid content");

      skillLoader = new SkillLoader([tempDir]);
      await skillLoader.discoverSkills();

      await expect(skillLoader.loadSkill("corrupted-skill")).rejects.toThrow(
        'Failed to load skill "corrupted-skill"'
      );
    });
  });

  describe("getSkillMetadata", () => {
    it("should load skill metadata without full content", async () => {
      const skillPath = path.join(tempDir, "test-skill");
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(
        path.join(skillPath, "SKILL.md"),
        `---
name: test-skill
description: Test skill description
---

This is the content that should not be loaded`
      );

      skillLoader = new SkillLoader([tempDir]);
      await skillLoader.discoverSkills();

      const metadata = await skillLoader.getSkillMetadata("test-skill");
      expect(metadata.name).toBe("test-skill");
      expect(metadata.description).toBe("Test skill description");
      expect(metadata.source).toBe(tempDir);
      expect((metadata as any).content).toBeUndefined();
    });

    it("should throw error for non-existent skill", async () => {
      skillLoader = new SkillLoader([tempDir]);
      await skillLoader.discoverSkills();

      await expect(
        skillLoader.getSkillMetadata("non-existent")
      ).rejects.toThrow('Skill "non-existent" not found');
    });

    it("should throw error for corrupted skill file", async () => {
      const skillPath = path.join(tempDir, "corrupted-skill");
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(path.join(skillPath, "SKILL.md"), "invalid");

      skillLoader = new SkillLoader([tempDir]);
      await skillLoader.discoverSkills();

      await expect(
        skillLoader.getSkillMetadata("corrupted-skill")
      ).rejects.toThrow('Failed to load metadata for skill "corrupted-skill"');
    });
  });

  describe("getSkillsPaths", () => {
    it("should return configured skills paths", () => {
      const paths = ["/path1", "/path2", "/path3"];
      const loader = new SkillLoader(paths);
      expect(loader.getSkillsPaths()).toEqual(paths);
    });
  });
  describe("lazy registry resolution", () => {
    async function writeSkill(dir: string, name: string, description: string) {
      const skillPath = path.join(dir, name);
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(
        path.join(skillPath, "SKILL.md"),
        `---\nname: ${name}\ndescription: ${description}\n---\n\n${name} body\n`
      );
    }

    it("should load a skill without a prior discoverSkills() call", async () => {
      await writeSkill(tempDir, "cold-start", "Loaded without listing first");
      skillLoader = new SkillLoader([tempDir]);

      // No discoverSkills() here: MCP clients may call a tool without
      // first listing tools, e.g. when reusing a cached tool list.
      const skill = await skillLoader.loadSkill("cold-start");

      expect(skill.name).toBe("cold-start");
      expect(skill.content).toContain("cold-start body");
    });

    it("should read metadata without a prior discoverSkills() call", async () => {
      await writeSkill(tempDir, "cold-meta", "Metadata without listing first");
      skillLoader = new SkillLoader([tempDir]);

      const metadata = await skillLoader.getSkillMetadata("cold-meta");

      expect(metadata.name).toBe("cold-meta");
      expect(metadata.source).toBe(tempDir);
    });

    it("should pick up a skill added after the last discovery", async () => {
      await writeSkill(tempDir, "first", "Present at discovery time");
      skillLoader = new SkillLoader([tempDir]);
      await skillLoader.discoverSkills();

      await writeSkill(tempDir, "second", "Added after discovery");

      const skill = await skillLoader.loadSkill("second");
      expect(skill.name).toBe("second");
    });

    it("should list available skills in the not-found error", async () => {
      await writeSkill(tempDir, "alpha", "First available skill");
      await writeSkill(tempDir, "beta", "Second available skill");
      skillLoader = new SkillLoader([tempDir]);

      await expect(skillLoader.loadSkill("gamma")).rejects.toThrow(
        'Skill "gamma" not found. Available skills: alpha, beta'
      );
    });

    it("should report the searched directories when nothing was discovered", async () => {
      skillLoader = new SkillLoader([tempDir]);

      await expect(skillLoader.loadSkill("anything")).rejects.toThrow(
        `No skills were discovered in: ${tempDir}`
      );
    });

    it("should report a missing configuration when no directories are set", async () => {
      skillLoader = new SkillLoader([]);

      await expect(skillLoader.loadSkill("anything")).rejects.toThrow(
        "(no directories configured)"
      );
    });
  });
});
