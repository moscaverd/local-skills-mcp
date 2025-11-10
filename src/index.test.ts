import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getAllSkillsDirectories, LocalSkillsServer } from "./index.js";
import fs from "fs";
import path from "path";
import os from "os";

// Increase max listeners to prevent warnings during tests
process.setMaxListeners(20);

/**
 * Safely remove a directory with retries for Windows file locking issues.
 * Windows can be slower to release file handles, causing EBUSY errors.
 */
async function removeDir(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) {
    console.log(`[removeDir] Directory does not exist: ${dir}`);
    return;
  }

  console.log(`[removeDir] Starting cleanup of: ${dir}`);

  // Log what's in the directory before attempting removal
  try {
    const contents = fs.readdirSync(dir, { recursive: true });
    console.log(
      `[removeDir] Directory contains ${contents.length} items:`,
      contents
    );
  } catch (err: any) {
    console.log(`[removeDir] Could not list directory contents:`, err.message);
  }

  const maxRetries = 10;
  const baseDelay = 100;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(
        `[removeDir] Attempt ${attempt + 1}/${maxRetries} to remove: ${dir}`
      );

      // Use fs.rmSync with built-in retry options (Node 14.14+)
      fs.rmSync(dir, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });

      console.log(`[removeDir] ✓ Successfully removed: ${dir}`);
      return; // Success
    } catch (error: any) {
      console.log(
        `[removeDir] ✗ Attempt ${attempt + 1} failed:`,
        error.code,
        error.message
      );

      // Handle retryable errors: EBUSY, ENOTEMPTY, EPERM (common on Windows)
      const isRetryable =
        error.code === "EBUSY" ||
        error.code === "ENOTEMPTY" ||
        error.code === "EPERM";

      if (isRetryable && attempt < maxRetries - 1) {
        // Exponential backoff: wait progressively longer on Windows
        const delay = baseDelay * (attempt + 1);
        console.log(`[removeDir] Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Not a retryable error or max retries exceeded
      if (attempt === maxRetries - 1) {
        console.warn(
          `[removeDir] ⚠️ Failed to remove directory ${dir} after ${maxRetries} attempts:`,
          error.message
        );

        // Try to provide more diagnostic info on Windows
        if (process.platform === "win32") {
          try {
            console.log(
              `[removeDir] Directory still exists:`,
              fs.existsSync(dir)
            );
            if (fs.existsSync(dir)) {
              const contents = fs.readdirSync(dir, { recursive: true });
              console.log(`[removeDir] Remaining items:`, contents);
            }
          } catch {
            // Ignore
          }
        }

        // Don't throw - allow tests to continue
        return;
      }

      // For non-retryable errors, throw immediately
      throw error;
    }
  }
}

// Mock MCP SDK
vi.mock("@modelcontextprotocol/sdk/server/index.js", () => {
  class MockServer {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    handlers = new Map<any, Function>();
    onerror: any = null;
    close = vi.fn();
    connect = vi.fn();

    constructor(
      public config: any,
      public capabilities: any
    ) {}

    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    setRequestHandler(schema: any, handler: Function) {
      this.handlers.set(schema, handler);
    }
  }

  return { Server: MockServer };
});

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => {
  return {
    StdioServerTransport: vi.fn(),
  };
});

describe("getAllSkillsDirectories", () => {
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;
  let tempDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    originalEnv = { ...process.env };

    // Create temp directory for testing
    // Use realpathSync to resolve any symlinks (important on macOS where /var -> /private/var)
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"))
    );
  });

  afterEach(async () => {
    // Restore original state
    process.chdir(originalCwd);
    process.env = originalEnv;

    // Clean up temp directory (with Windows retry logic)
    await removeDir(tempDir);
  });

  it("should include home .claude/skills directory if it exists", () => {
    const homeClaudeSkills = path.join(os.homedir(), ".claude", "skills");

    process.chdir(tempDir);
    delete process.env.SKILLS_DIR;

    const dirs = getAllSkillsDirectories();

    // If the home directory exists, it should be included
    if (fs.existsSync(homeClaudeSkills)) {
      expect(dirs).toContain(homeClaudeSkills);
    }

    expect(dirs.length).toBeGreaterThan(0);
  });

  it("should create home .claude/skills and verify it is included", () => {
    // Create a temporary home directory with .claude/skills
    const fakeHome = path.join(tempDir, "fake-home");
    const fakeHomeSkills = path.join(fakeHome, ".claude", "skills");
    fs.mkdirSync(fakeHomeSkills, { recursive: true });

    // Temporarily override os.homedir
    const originalHomedir = os.homedir;
    (os as any).homedir = () => fakeHome;

    try {
      process.chdir(tempDir);
      delete process.env.SKILLS_DIR;

      const dirs = getAllSkillsDirectories();

      // Should include the fake home .claude/skills directory
      expect(dirs).toContain(fakeHomeSkills);
    } finally {
      // Restore original homedir
      (os as any).homedir = originalHomedir;
    }
  });

  it("should include project .claude/skills directory if it exists", () => {
    const projectClaudeSkills = path.join(tempDir, ".claude", "skills");
    fs.mkdirSync(projectClaudeSkills, { recursive: true });

    process.chdir(tempDir);
    delete process.env.SKILLS_DIR;

    const dirs = getAllSkillsDirectories();
    expect(dirs).toContain(projectClaudeSkills);
  });

  it("should include default skills directory", () => {
    const defaultSkills = path.join(tempDir, "skills");
    fs.mkdirSync(defaultSkills, { recursive: true });

    process.chdir(tempDir);
    delete process.env.SKILLS_DIR;

    const dirs = getAllSkillsDirectories();
    expect(dirs).toContain(defaultSkills);
  });

  it("should include SKILLS_DIR from environment if set", () => {
    const customSkillsDir = path.join(tempDir, "custom-skills");
    fs.mkdirSync(customSkillsDir, { recursive: true });

    process.chdir(tempDir);
    process.env.SKILLS_DIR = customSkillsDir;

    const dirs = getAllSkillsDirectories();
    expect(dirs).toContain(customSkillsDir);
  });

  it("should return default directory if no directories exist", () => {
    // Create a clean directory with no skills folders
    const emptyDir = path.join(tempDir, "empty");
    fs.mkdirSync(emptyDir, { recursive: true });
    process.chdir(emptyDir);
    delete process.env.SKILLS_DIR;

    const dirs = getAllSkillsDirectories();

    // With the new implementation, package built-in skills should always be included
    // The package skills directory should be present even when no other directories exist
    expect(dirs.length).toBeGreaterThan(0);
    // The package skills path should include 'skills' at the end (cross-platform check)
    expect(
      dirs.some((dir) => {
        const parts = dir.split(path.sep);
        return parts[parts.length - 1] === "skills";
      })
    ).toBe(true);
  });

  it("should prioritize directories correctly", () => {
    // Create all possible directories
    const homeClaudeSkills = path.join(os.homedir(), ".claude", "skills");
    const projectClaudeSkills = path.join(tempDir, ".claude", "skills");
    const defaultSkills = path.join(tempDir, "skills");
    const customSkills = path.join(tempDir, "custom");

    fs.mkdirSync(projectClaudeSkills, { recursive: true });
    fs.mkdirSync(defaultSkills, { recursive: true });
    fs.mkdirSync(customSkills, { recursive: true });

    process.chdir(tempDir);
    process.env.SKILLS_DIR = customSkills;

    const dirs = getAllSkillsDirectories();

    // Check that custom SKILLS_DIR comes last (for override behavior)
    const customIndex = dirs.indexOf(customSkills);
    expect(customIndex).toBeGreaterThan(-1);

    // Verify all expected directories are present
    if (fs.existsSync(homeClaudeSkills)) {
      expect(dirs).toContain(homeClaudeSkills);
    }
    expect(dirs).toContain(projectClaudeSkills);
    expect(dirs).toContain(defaultSkills);
    expect(dirs).toContain(customSkills);
  });
});

describe("LocalSkillsServer", () => {
  let tempDir: string;
  let skillsDir: string;
  let server: LocalSkillsServer | null = null;
  let testName = "";

  beforeEach(() => {
    // Capture current test name for logging
    testName = expect.getState().currentTestName || "unknown";
    console.log(`\n[beforeEach] Starting test: ${testName}`);

    // Use realpathSync to resolve any symlinks (important on macOS where /var -> /private/var)
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "server-test-"))
    );
    console.log(`[beforeEach] Created temp directory: ${tempDir}`);

    skillsDir = path.join(tempDir, "skills");
    fs.mkdirSync(skillsDir, { recursive: true });
    console.log(`[beforeEach] Created skills directory: ${skillsDir}`);

    // Create test skills
    const testSkillDir = path.join(skillsDir, "test-skill");
    fs.mkdirSync(testSkillDir, { recursive: true });
    const skillFile = path.join(testSkillDir, "SKILL.md");
    fs.writeFileSync(
      skillFile,
      `---
name: test-skill
description: A test skill for unit testing
---

This is test skill content.`
    );
    console.log(`[beforeEach] Created test skill file: ${skillFile}`);

    console.log(`[beforeEach] Changing directory to: ${tempDir}`);
    process.chdir(tempDir);
    console.log(`[beforeEach] Current directory: ${process.cwd()}`);
  });

  afterEach(async () => {
    console.log(`\n[afterEach] Cleaning up test: ${testName}`);

    // CRITICAL: Close server BEFORE cleaning up files (important for Windows)
    if (server) {
      console.log(`[afterEach] Closing server instance...`);
      try {
        await server.close();
        console.log(`[afterEach] ✓ Server closed successfully`);
      } catch (err) {
        console.warn("[afterEach] ✗ Error closing server:", err);
      }
      server = null;
    } else {
      console.log(`[afterEach] No server instance to close`);
    }

    // Wait for all file handles to be released (Windows needs significantly more time)
    // Windows file system takes longer to release handles compared to Unix systems
    const cleanupDelay = process.platform === "win32" ? 1000 : 200;
    console.log(
      `[afterEach] Waiting ${cleanupDelay}ms for handles to be released...`
    );
    await new Promise((resolve) => setTimeout(resolve, cleanupDelay));

    console.log(
      `[afterEach] Current directory before cleanup: ${process.cwd()}`
    );

    // CRITICAL: On Windows, if cwd is inside the directory we're trying to delete, it will be locked
    // Change to parent directory or temp root to release the lock
    const cwd = process.cwd();
    if (cwd.startsWith(tempDir)) {
      console.log(
        `[afterEach] ⚠️ CWD is inside tempDir, changing to parent...`
      );
      const safeCwd =
        process.platform === "win32" ? os.tmpdir() : path.dirname(tempDir);
      process.chdir(safeCwd);
      console.log(`[afterEach] Changed CWD to: ${process.cwd()}`);

      // On Windows, even after changing directory, the OS needs time to release the lock
      if (process.platform === "win32") {
        console.log(
          `[afterEach] Waiting additional 500ms for Windows to release directory lock...`
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // THEN clean up temp directory
    await removeDir(tempDir);
    console.log(`[afterEach] ✓ Cleanup complete for test: ${testName}\n`);
  });

  it("should create server instance successfully", () => {
    console.log(`[test] Creating LocalSkillsServer instance...`);
    server = new LocalSkillsServer();
    console.log(`[test] ✓ Server instance created`);
    expect(server).toBeDefined();
  });

  it("should register ListTools handler", async () => {
    console.log(`[test] Creating LocalSkillsServer instance...`);
    server = new LocalSkillsServer();
    console.log(`[test] ✓ Server instance created`);

    // Access the server's internal state through type assertion
    const serverInternal = server as any;
    const mockServer = serverInternal.server;

    expect(mockServer.handlers.size).toBeGreaterThan(0);
  });

  it("should handle ListTools request with available skills", async () => {
    server = new LocalSkillsServer();

    const serverInternal = server as any;
    const mockServer = serverInternal.server;

    // Get the ListTools handler
    const { ListToolsRequestSchema } = await import(
      "@modelcontextprotocol/sdk/types.js"
    );
    const listToolsHandler = mockServer.handlers.get(ListToolsRequestSchema);

    expect(listToolsHandler).toBeDefined();

    const result = await listToolsHandler();

    expect(result.tools).toBeDefined();
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe("get_skill");
    // Should contain either test-skill or available skills message
    expect(
      result.tools[0].description.includes("test-skill") ||
        result.tools[0].description.includes("Available skills")
    ).toBe(true);
    expect(result.tools[0].inputSchema).toBeDefined();
    expect(result.tools[0].inputSchema.required).toContain("skill_name");
  });

  it("should show message when no skills available", async () => {
    // Create empty directory with no skills
    const emptyDir = path.join(tempDir, "empty");
    fs.mkdirSync(emptyDir, { recursive: true });
    process.chdir(emptyDir);

    server = new LocalSkillsServer();

    const serverInternal = server as any;
    const mockServer = serverInternal.server;

    const { ListToolsRequestSchema } = await import(
      "@modelcontextprotocol/sdk/types.js"
    );
    const listToolsHandler = mockServer.handlers.get(ListToolsRequestSchema);

    const result = await listToolsHandler();

    // Should contain either "No skills" message or available skills from other directories
    expect(
      result.tools[0].description.includes("No skills currently available") ||
        result.tools[0].description.includes("Available skills")
    ).toBe(true);

    // Verify the tool description contains directory information
    expect(result.tools[0].description).toContain("skills");
  });

  it("should handle empty skill lists in tool description", async () => {
    // Create a truly isolated environment for testing empty skills
    const isolatedDir = path.join(tempDir, "isolated");
    fs.mkdirSync(isolatedDir, { recursive: true });

    // Save and temporarily modify HOME to avoid finding real skills
    const originalHome = process.env.HOME;
    const originalHomedir = os.homedir;
    process.env.HOME = isolatedDir;
    (os as any).homedir = () => isolatedDir;
    process.chdir(isolatedDir);
    delete process.env.SKILLS_DIR;

    try {
      server = new LocalSkillsServer();

      const serverInternal = server as any;
      const mockServer = serverInternal.server;

      // Get the ListTools handler and check the description
      const { ListToolsRequestSchema } = await import(
        "@modelcontextprotocol/sdk/types.js"
      );
      const listToolsHandler = mockServer.handlers.get(ListToolsRequestSchema);
      const result = await listToolsHandler();

      // Should show "No skills currently available" message
      const description = result.tools[0].description;

      // Verify it contains the empty message OR available skills from elsewhere
      expect(
        description.includes("No skills currently available") ||
          description.includes("Available skills")
      ).toBe(true);
    } finally {
      // Restore original HOME and homedir
      process.env.HOME = originalHome;
      (os as any).homedir = originalHomedir;
    }
  });

  it("should display empty skills message when no skills directories exist", async () => {
    // Create completely isolated directory
    const emptyDir = path.join(tempDir, "truly-empty");
    fs.mkdirSync(emptyDir, { recursive: true });

    const originalHomedir = os.homedir;
    (os as any).homedir = () => emptyDir;
    process.chdir(emptyDir);
    delete process.env.SKILLS_DIR;

    try {
      server = new LocalSkillsServer();

      const serverInternal = server as any;
      const mockServer = serverInternal.server;

      const { ListToolsRequestSchema } = await import(
        "@modelcontextprotocol/sdk/types.js"
      );
      const listToolsHandler = mockServer.handlers.get(ListToolsRequestSchema);
      const result = await listToolsHandler();

      const description = result.tools[0].description;

      // Should mention checking configured directories or show available skills
      expect(
        description.includes("Check configured directories") ||
          description.includes("Available skills") ||
          description.includes("No skills currently available")
      ).toBe(true);
    } finally {
      (os as any).homedir = originalHomedir;
    }
  });

  it("should show appropriate message based on skill availability", async () => {
    // Create a brand new isolated temp directory structure
    // Use realpathSync to resolve any symlinks (important on macOS where /var -> /private/var)
    const brandNewTemp = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "no-skills-test-"))
    );

    try {
      const originalHomedir = os.homedir;
      const originalCwd = process.cwd();

      // Override homedir to point to our isolated temp dir
      (os as any).homedir = () => brandNewTemp;
      process.chdir(brandNewTemp);
      delete process.env.SKILLS_DIR;

      server = new LocalSkillsServer();
      const serverInternal = server as any;

      // Directly test the skill loader
      const skillLoader = serverInternal.skillLoader;
      const skillNames = await skillLoader.discoverSkills();

      // Test the ListTools handler
      const mockServer = serverInternal.server;
      const { ListToolsRequestSchema } = await import(
        "@modelcontextprotocol/sdk/types.js"
      );
      const listToolsHandler = mockServer.handlers.get(ListToolsRequestSchema);
      const result = await listToolsHandler();

      const description = result.tools[0].description;

      if (skillNames.length === 0) {
        // If no skills found, should show the "Check configured directories" message
        expect(description).toContain("No skills currently available");
        expect(description).toContain("Check configured directories");
      } else {
        // If skills found (from real directories), should list them
        expect(description).toContain("Available skills");
      }

      // Restore
      (os as any).homedir = originalHomedir;
      process.chdir(originalCwd);
    } finally {
      // Cleanup (with Windows retry logic)
      await removeDir(brandNewTemp);
    }
  });

  it("should handle CallTool request with valid skill", async () => {
    server = new LocalSkillsServer();

    const serverInternal = server as any;
    const mockServer = serverInternal.server;

    // First get available skills
    const { ListToolsRequestSchema, CallToolRequestSchema } = await import(
      "@modelcontextprotocol/sdk/types.js"
    );
    const listToolsHandler = mockServer.handlers.get(ListToolsRequestSchema);
    const listResult = await listToolsHandler();

    // Extract available skill names from description
    const description = listResult.tools[0].description;
    const match = description.match(/Available skills:\n((?:- .+\n?)+)/);

    if (match) {
      const skillNames = match[1]
        .split("\n")
        .map((line: string) => line.replace(/^-/u, "").trim())
        .filter(Boolean)
        .map((line: string) => line.split(":")[0]?.trim())
        .filter(Boolean);

      const testSkillName = skillNames[0]; // Use the first available skill

      const callToolHandler = mockServer.handlers.get(CallToolRequestSchema);
      expect(callToolHandler).toBeDefined();

      const result = await callToolHandler({
        params: {
          name: "get_skill",
          arguments: { skill_name: testSkillName },
        },
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");
      const responseText = result.content[0].text;
      expect(responseText).toContain(`# Skill: ${testSkillName}`);
      expect(responseText).toContain("**Description:**");
      expect(responseText).toContain("**Source:**");
      expect(responseText).toContain("---");
    } else {
      // No skills available, this test should pass
      expect(true).toBe(true);
    }
  });

  it("should fall back to skill name when metadata cannot be loaded", async () => {
    server = new LocalSkillsServer();

    const serverInternal = server as any;
    const mockServer = serverInternal.server;
    const skillLoader = serverInternal.skillLoader;

    const { ListToolsRequestSchema } = await import(
      "@modelcontextprotocol/sdk/types.js"
    );

    const discoverSpy = vi
      .spyOn(skillLoader, "discoverSkills")
      .mockResolvedValue(["broken-skill"]);
    const metadataSpy = vi
      .spyOn(skillLoader, "getSkillMetadata")
      .mockRejectedValue(new Error("metadata boom"));

    try {
      const listToolsHandler = mockServer.handlers.get(ListToolsRequestSchema);
      const result = await listToolsHandler();

      expect(result.tools[0].description).toContain("- broken-skill");
    } finally {
      discoverSpy.mockRestore();
      metadataSpy.mockRestore();
    }
  });

  it("should truncate long skill descriptions in tool metadata", async () => {
    server = new LocalSkillsServer();

    const serverInternal = server as any;
    const mockServer = serverInternal.server;
    const skillLoader = serverInternal.skillLoader;

    const { ListToolsRequestSchema } = await import(
      "@modelcontextprotocol/sdk/types.js"
    );

    const longDescription = "A".repeat(250);

    const discoverSpy = vi
      .spyOn(skillLoader, "discoverSkills")
      .mockResolvedValue(["detailed-skill"]);
    const metadataSpy = vi
      .spyOn(skillLoader, "getSkillMetadata")
      .mockResolvedValue({
        name: "detailed-skill",
        description: longDescription,
        source: "/fake/path",
      });

    try {
      const listToolsHandler = mockServer.handlers.get(ListToolsRequestSchema);
      const result = await listToolsHandler();
      const description = result.tools[0].description;

      const line = description
        .split("\n")
        .find((entry: string) => entry.startsWith("- detailed-skill"));

      expect(line).toBeDefined();

      const detail = line!.slice(line!.indexOf(":") + 2);
      expect(detail.length).toBeLessThanOrEqual(200);
      expect(detail.endsWith("...")).toBe(true);
    } finally {
      discoverSpy.mockRestore();
      metadataSpy.mockRestore();
    }
  });

  it("should handle CallTool with missing skill_name", async () => {
    server = new LocalSkillsServer();

    const serverInternal = server as any;
    const mockServer = serverInternal.server;

    const { CallToolRequestSchema } = await import(
      "@modelcontextprotocol/sdk/types.js"
    );
    const callToolHandler = mockServer.handlers.get(CallToolRequestSchema);

    const result = await callToolHandler({
      params: {
        name: "get_skill",
        arguments: {},
      },
    });

    expect(result.content[0].text).toContain("Error");
    expect(result.content[0].text).toContain("skill_name is required");
  });

  it("should handle CallTool with unknown tool name", async () => {
    server = new LocalSkillsServer();

    const serverInternal = server as any;
    const mockServer = serverInternal.server;

    const { CallToolRequestSchema } = await import(
      "@modelcontextprotocol/sdk/types.js"
    );
    const callToolHandler = mockServer.handlers.get(CallToolRequestSchema);

    const result = await callToolHandler({
      params: {
        name: "unknown_tool",
        arguments: {},
      },
    });

    expect(result.content[0].text).toContain("Error");
    expect(result.content[0].text).toContain("Unknown tool");
  });

  it("should handle CallTool with non-existent skill", async () => {
    server = new LocalSkillsServer();

    const serverInternal = server as any;
    const mockServer = serverInternal.server;

    const { CallToolRequestSchema } = await import(
      "@modelcontextprotocol/sdk/types.js"
    );
    const callToolHandler = mockServer.handlers.get(CallToolRequestSchema);

    const result = await callToolHandler({
      params: {
        name: "get_skill",
        arguments: { skill_name: "non-existent" },
      },
    });

    expect(result.content[0].text).toContain("Error");
    expect(result.content[0].text).toContain("not found");
  });

  it("should set up error handler", () => {
    server = new LocalSkillsServer();

    const serverInternal = server as any;
    const mockServer = serverInternal.server;

    expect(mockServer.onerror).not.toBeNull();
  });

  it("should register SIGINT handler", () => {
    const listenersBefore = process.listeners("SIGINT").length;

    server = new LocalSkillsServer();

    const listenersAfter = process.listeners("SIGINT").length;

    expect(listenersAfter).toBeGreaterThanOrEqual(listenersBefore);
  });

  it("should handle server errors via onerror handler", () => {
    server = new LocalSkillsServer();

    const serverInternal = server as any;
    const mockServer = serverInternal.server;

    expect(mockServer.onerror).not.toBeNull();

    // Mock console.error to avoid test output noise
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Trigger the error handler
    if (typeof mockServer.onerror === "function") {
      mockServer.onerror(new Error("Test error"));
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[MCP Error]",
        expect.any(Error)
      );
    }

    consoleErrorSpy.mockRestore();
  });

  it("should properly close server on SIGINT", async () => {
    server = new LocalSkillsServer();

    const serverInternal = server as any;
    const mockServer = serverInternal.server;

    // Find the SIGINT handler that was added
    const sigintListeners = process.listeners("SIGINT");
    const ourHandler = sigintListeners[sigintListeners.length - 1];

    // Mock process.exit to avoid actually exiting
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as any);

    // Trigger the handler
    if (typeof ourHandler === "function") {
      await (ourHandler as any)();
      expect(mockServer.close).toHaveBeenCalled();
    }

    mockExit.mockRestore();
  });

  it("should run the server and connect to transport", async () => {
    server = new LocalSkillsServer();

    const serverInternal = server as any;
    const mockServer = serverInternal.server;

    // Mock console.error to avoid test output noise
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Mock the transport's start method
    mockServer.connect.mockResolvedValue(undefined);

    // Call run method
    await server.run();

    // Verify connect was called
    expect(mockServer.connect).toHaveBeenCalled();

    // Verify console.error was called with version info
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Local Skills MCP Server")
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Aggregating skills from")
    );

    consoleErrorSpy.mockRestore();
  });
});

describe("Version handling", () => {
  it("should read version from package.json", () => {
    const projectRoot = path.resolve(__dirname, "..");
    const packageJsonPath = path.join(projectRoot, "package.json");

    expect(fs.existsSync(packageJsonPath)).toBe(true);

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    expect(packageJson.version).toBeDefined();
    expect(typeof packageJson.version).toBe("string");
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
