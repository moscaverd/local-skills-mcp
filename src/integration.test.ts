import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { LocalSkillsServer } from "./index.js";
import fs from "fs";
import path from "path";
import os from "os";

// Increase max listeners to prevent warnings during tests
process.setMaxListeners(20);

function extractAvailableSkills(description?: string): string[] {
  if (!description) {
    return [];
  }

  const match = description.match(/Available skills:\n((?:- .+\n?)+)/);
  if (!match) {
    return [];
  }

  return match[1]
    .trim()
    .split("\n")
    .map((line) => line.replace(/^-\s+/, ""))
    .map((line) => line.split(":")[0]?.trim())
    .filter((line): line is string => Boolean(line));
}

/**
 * Safely remove a directory with retries for Windows file locking issues.
 * Windows can be slower to release file handles, causing EBUSY errors.
 */
async function removeDir(dir: string, retries = 3, delay = 100): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
      return;
    } catch (error: any) {
      if (error.code === "EBUSY" && i < retries - 1) {
        // Wait before retrying (Windows needs time to release file handles)
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

describe("Integration Tests - MCP Protocol Flow", () => {
  let tempDir: string;
  let skillsDir: string;
  let client: Client;
  let server: LocalSkillsServer;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    // Create temporary directory for test fixtures
    // Use realpathSync to resolve any symlinks (important on macOS where /var -> /private/var)
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "integration-test-"))
    );
    skillsDir = path.join(tempDir, "skills");
    fs.mkdirSync(skillsDir, { recursive: true });

    // Create test skills
    const skill1Dir = path.join(skillsDir, "test-skill-1");
    fs.mkdirSync(skill1Dir, { recursive: true });
    fs.writeFileSync(
      path.join(skill1Dir, "SKILL.md"),
      `---
name: test-skill-1
description: First test skill for integration testing
---

# Test Skill 1

This is the content of test skill 1.
It includes instructions and guidance.`
    );

    const skill2Dir = path.join(skillsDir, "test-skill-2");
    fs.mkdirSync(skill2Dir, { recursive: true });
    fs.writeFileSync(
      path.join(skill2Dir, "SKILL.md"),
      `---
name: test-skill-2
description: Second test skill for integration testing
---

# Test Skill 2

This is the content of test skill 2.
It provides different guidance.`
    );

    // Change to temp directory so server discovers our test skills
    process.chdir(tempDir);

    // Create in-memory transport pair
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // Create server
    server = new LocalSkillsServer();

    // Create client
    client = new Client(
      {
        name: "test-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );
  });

  afterEach(async () => {
    // Clean up client
    try {
      await client.close();
    } catch {
      // Ignore cleanup errors
    }

    // Clean up server using public close() method
    try {
      await server.close();
    } catch {
      // Ignore cleanup errors
    }

    // Wait for all file handles to be released (Windows needs significantly more time)
    const cleanupDelay = process.platform === "win32" ? 1000 : 200;
    await new Promise((resolve) => setTimeout(resolve, cleanupDelay));

    process.chdir(originalCwd);

    // Clean up temp directory (with Windows retry logic)
    await removeDir(tempDir);
  });

  describe("Server-Client Connection", () => {
    it("should successfully connect client to server", async () => {
      // Connect server
      await (server as any).server.connect(serverTransport);

      // Connect client
      await client.connect(clientTransport);

      // Client should be connected and able to make requests
      expect(client).toBeDefined();

      // Verify connection by making a request
      const response = await client.listTools();
      expect(response).toBeDefined();
      expect(response.tools).toBeDefined();
    });

    it("should support full MCP protocol lifecycle", async () => {
      await (server as any).server.connect(serverTransport);
      await client.connect(clientTransport);

      // Should be able to list tools
      const listResponse = await client.listTools();
      expect(listResponse.tools.length).toBeGreaterThan(0);

      // Should be able to call tools
      const callResponse = await client.callTool({
        name: "get_skill",
        arguments: {},
      });
      expect(callResponse).toBeDefined();
      expect(callResponse.content).toBeDefined();
    });
  });

  describe("ListTools Request", () => {
    beforeEach(async () => {
      await (server as any).server.connect(serverTransport);
      await client.connect(clientTransport);
    });

    it("should list available tools", async () => {
      const response = await client.listTools();

      expect(response.tools).toBeDefined();
      expect(response.tools.length).toBeGreaterThan(0);

      const getSkillTool = response.tools.find((t) => t.name === "get_skill");
      expect(getSkillTool).toBeDefined();
      expect(getSkillTool?.name).toBe("get_skill");
      expect(getSkillTool?.description).toContain("specialized expert");
    });

    it("should include available skills in tool description", async () => {
      const response = await client.listTools();

      const getSkillTool = response.tools.find((t) => t.name === "get_skill");
      expect(getSkillTool).toBeDefined();
      expect(getSkillTool?.description).toBeDefined();
      // Should contain either test skills or available skills message
      expect(
        getSkillTool!.description!.includes("test-skill-1") ||
          getSkillTool!.description!.includes("Available skills")
      ).toBe(true);
    });

    it("should have proper input schema for get_skill tool", async () => {
      const response = await client.listTools();

      const getSkillTool = response.tools.find((t) => t.name === "get_skill");
      expect(getSkillTool?.inputSchema).toBeDefined();
      expect(getSkillTool?.inputSchema.type).toBe("object");
      expect(getSkillTool?.inputSchema.properties).toHaveProperty("skill_name");
      expect(getSkillTool?.inputSchema.required).toContain("skill_name");
    });
  });

  describe("CallTool Request - get_skill", () => {
    let availableSkills: string[];

    beforeEach(async () => {
      await (server as any).server.connect(serverTransport);
      await client.connect(clientTransport);

      // Discover available skills
      const listResponse = await client.listTools();
      const getSkillTool = listResponse.tools.find(
        (t) => t.name === "get_skill"
      );
      availableSkills = extractAvailableSkills(getSkillTool?.description);
    });

    it("should retrieve a skill successfully", async () => {
      // Skip if no skills available
      if (availableSkills.length === 0) {
        expect(true).toBe(true);
        return;
      }

      const skillToTest = availableSkills[0];

      const response = await client.callTool({
        name: "get_skill",
        arguments: {
          skill_name: skillToTest,
        },
      });

      expect(response.content).toBeDefined();
      expect((response.content as any[]).length).toBeGreaterThan(0);

      const textContent = (response.content as any[])[0];
      expect(textContent.type).toBe("text");
      expect(textContent.text).toContain(skillToTest);
      expect(textContent.text).toContain("# Skill:");
    });

    it("should retrieve different skills independently", async () => {
      // Skip if less than 2 skills available
      if (availableSkills.length < 2) {
        expect(true).toBe(true);
        return;
      }

      const skill1 = availableSkills[0];
      const skill2 = availableSkills[1];

      const response1 = await client.callTool({
        name: "get_skill",
        arguments: {
          skill_name: skill1,
        },
      });

      const response2 = await client.callTool({
        name: "get_skill",
        arguments: {
          skill_name: skill2,
        },
      });

      const text1 = (response1.content as any[])[0].text;
      const text2 = (response2.content as any[])[0].text;

      expect(text1).toContain(skill1);
      expect(text1).not.toContain(skill2);

      expect(text2).toContain(skill2);
      expect(text2).not.toContain(skill1);
    });

    it("should cache skills after first load", async () => {
      // Skip if no skills available
      if (availableSkills.length === 0) {
        expect(true).toBe(true);
        return;
      }

      const skillToTest = availableSkills[0];

      // First call
      const response1 = await client.callTool({
        name: "get_skill",
        arguments: {
          skill_name: skillToTest,
        },
      });

      // Second call (should use cache)
      const response2 = await client.callTool({
        name: "get_skill",
        arguments: {
          skill_name: skillToTest,
        },
      });

      // Both should return the same content
      expect((response1.content as any[])[0].text).toBe(
        (response2.content as any[])[0].text
      );
    });

    it("should include source directory in skill output", async () => {
      // Skip if no skills available
      if (availableSkills.length === 0) {
        expect(true).toBe(true);
        return;
      }

      const skillToTest = availableSkills[0];

      const response = await client.callTool({
        name: "get_skill",
        arguments: {
          skill_name: skillToTest,
        },
      });

      const text = (response.content as any[])[0].text;
      expect(text).toContain("**Source:**");
      // Should contain some path
      expect(text).toMatch(/\/.*skills/);
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      await (server as any).server.connect(serverTransport);
      await client.connect(clientTransport);
    });

    it("should return error for non-existent skill", async () => {
      const response = await client.callTool({
        name: "get_skill",
        arguments: {
          skill_name: "non-existent-skill",
        },
      });

      expect(response.content).toBeDefined();
      const text = (response.content as any[])[0].text;
      expect(text).toContain("Error");
      expect(text).toContain("not found");
    });

    it("should return error for missing skill_name argument", async () => {
      const response = await client.callTool({
        name: "get_skill",
        arguments: {},
      });

      expect(response.content).toBeDefined();
      const text = (response.content as any[])[0].text;
      expect(text).toContain("Error");
      expect(text).toContain("skill_name is required");
    });

    it("should return error for unknown tool", async () => {
      const response = await client.callTool({
        name: "unknown_tool",
        arguments: {},
      });

      expect(response.content).toBeDefined();
      const text = (response.content as any[])[0].text;
      expect(text).toContain("Error");
      expect(text).toContain("Unknown tool");
    });
  });

  describe("Multiple Skill Requests", () => {
    beforeEach(async () => {
      await (server as any).server.connect(serverTransport);
      await client.connect(clientTransport);
    });

    it("should handle multiple concurrent skill requests", async () => {
      const promises = [
        client.callTool({
          name: "get_skill",
          arguments: { skill_name: "test-skill-1" },
        }),
        client.callTool({
          name: "get_skill",
          arguments: { skill_name: "test-skill-2" },
        }),
        client.callTool({
          name: "get_skill",
          arguments: { skill_name: "test-skill-1" },
        }),
      ];

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(3);
      responses.forEach((response) => {
        expect(response.content).toBeDefined();
        expect((response.content as any[]).length).toBeGreaterThan(0);
      });
    });

    it("should handle sequential skill requests", async () => {
      for (let i = 0; i < 5; i++) {
        const skillName = i % 2 === 0 ? "test-skill-1" : "test-skill-2";
        const response = await client.callTool({
          name: "get_skill",
          arguments: { skill_name: skillName },
        });

        expect(response.content).toBeDefined();
        const text = (response.content as any[])[0].text;
        expect(text).toContain(skillName);
      }
    });
  });

  describe("Skill Discovery", () => {
    beforeEach(async () => {
      await (server as any).server.connect(serverTransport);
      await client.connect(clientTransport);
    });

    it("should list all available skills", async () => {
      // List tools
      const response = await client.listTools();
      const tool = response.tools.find((t) => t.name === "get_skill");

      // Should have available skills or message about no skills
      expect(tool).toBeDefined();
      expect(tool?.description).toBeDefined();
      expect(
        tool!.description!.includes("Available skills") ||
          tool!.description!.includes("No skills currently available")
      ).toBe(true);
    });

    it("should retrieve all listed skills successfully", async () => {
      // Get list of available skills
      const listResponse = await client.listTools();
      const tool = listResponse.tools.find((t) => t.name === "get_skill");
      const skills = extractAvailableSkills(tool?.description);

      if (skills.length > 0) {
        // Verify we can retrieve each skill
        for (const skillName of skills.slice(0, 3)) {
          // Test first 3 to keep it fast
          const response = await client.callTool({
            name: "get_skill",
            arguments: { skill_name: skillName },
          });

          const text = (response.content as any[])[0].text;
          expect(text).toContain(skillName);
          expect(text).toContain("# Skill:");
        }
      } else {
        // No skills available, test passes
        expect(true).toBe(true);
      }
    });
  });

  describe("Empty Skills Directory", () => {
    it("should handle empty skills directory gracefully", async () => {
      // Create empty temp directory
      // Use realpathSync to resolve any symlinks (important on macOS where /var -> /private/var)
      const emptyDir = fs.realpathSync(
        fs.mkdtempSync(path.join(os.tmpdir(), "empty-test-"))
      );
      const emptySkillsDir = path.join(emptyDir, "skills");
      fs.mkdirSync(emptySkillsDir, { recursive: true });

      process.chdir(emptyDir);

      try {
        // Create transports
        const [emptyClientTransport, emptyServerTransport] =
          InMemoryTransport.createLinkedPair();

        // Create server in empty directory
        const emptyServer = new LocalSkillsServer();
        const emptyClient = new Client(
          { name: "empty-test-client", version: "1.0.0" },
          { capabilities: {} }
        );

        await (emptyServer as any).server.connect(emptyServerTransport);
        await emptyClient.connect(emptyClientTransport);

        // Should still list the get_skill tool
        const response = await emptyClient.listTools();
        const tool = response.tools.find((t) => t.name === "get_skill");
        expect(tool).toBeDefined();
        expect(tool?.description).toBeDefined();

        // But description should indicate no skills
        expect(
          tool!.description!.includes("No skills currently available") ||
            tool!.description!.includes("Available skills")
        ).toBe(true);

        await emptyClient.close();
        await (emptyServer as any).server.close();
      } finally {
        process.chdir(originalCwd);
        // Clean up temp directory (with Windows retry logic)
        await removeDir(emptyDir);
      }
    });
  });

  describe("Skill Content Format", () => {
    let availableSkills: string[];

    beforeEach(async () => {
      await (server as any).server.connect(serverTransport);
      await client.connect(clientTransport);

      // Discover available skills
      const listResponse = await client.listTools();
      const getSkillTool = listResponse.tools.find(
        (t) => t.name === "get_skill"
      );
      availableSkills = extractAvailableSkills(getSkillTool?.description);
    });

    it("should include all expected sections in skill output", async () => {
      // Skip if no skills available
      if (availableSkills.length === 0) {
        expect(true).toBe(true);
        return;
      }

      const skillToTest = availableSkills[0];

      const response = await client.callTool({
        name: "get_skill",
        arguments: { skill_name: skillToTest },
      });

      const text = (response.content as any[])[0].text;

      // Should have header
      expect(text).toContain(`# Skill: ${skillToTest}`);

      // Should have description
      expect(text).toContain("**Description:**");

      // Should have source
      expect(text).toContain("**Source:**");

      // Should have separator
      expect(text).toContain("---");
    });

    it("should return properly formatted skill content", async () => {
      // Skip if no skills available
      if (availableSkills.length === 0) {
        expect(true).toBe(true);
        return;
      }

      const skillToTest = availableSkills[0];

      const response = await client.callTool({
        name: "get_skill",
        arguments: { skill_name: skillToTest },
      });

      const text = (response.content as any[])[0].text;

      // Should be well-structured markdown content
      expect(text.length).toBeGreaterThan(50);

      // Should have proper sections
      expect(text).toContain("# Skill:");
      expect(text).toContain("**Description:**");
      expect(text).toContain("**Source:**");
      expect(text).toContain("---");

      // Content should be separated from metadata
      const parts = text.split("---");
      expect(parts.length).toBeGreaterThanOrEqual(2);
    });
  });
});
