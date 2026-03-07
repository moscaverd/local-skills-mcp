#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";
import { SkillLoader } from "./skill-loader.js";
import { validateSkillFile } from "./skill-validator.js";
import { evaluateSkill } from "./eval-runner.js";

// Get version from package.json (single source of truth)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, "..");
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json"), "utf-8")
);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
const VERSION = packageJson.version;

/**
 * Get all skills directories to aggregate from.
 *
 * Scans for skill directories in the following order (lowest to highest priority):
 * 1. `<package-root>/skills` - Package built-in skills (self-documenting, always available)
 * 2. `~/.claude/skills` - Global Claude skills
 * 3. `{cwd}/.claude/skills` - Project-level Claude skills
 * 4. `{cwd}/skills` - Default project skills directory
 * 5. `$SKILLS_DIR` - Custom directory from environment variable
 *
 * For duplicate skill names, later directories take precedence. This allows
 * users to override built-in skills with their own versions.
 *
 * @returns Array of directory paths that exist on the filesystem
 *
 * @example
 * ```typescript
 * const dirs = getAllSkillsDirectories();
 * console.log(dirs);
 * // ['/usr/lib/node_modules/local-skills-mcp/skills', '/home/user/.claude/skills', '/home/user/project/skills']
 * ```
 *
 * @example
 * ```typescript
 * // With SKILLS_DIR environment variable
 * process.env.SKILLS_DIR = '/custom/skills';
 * const dirs = getAllSkillsDirectories();
 * // Returns: [...standard paths..., '/custom/skills']
 * ```
 */
export function getAllSkillsDirectories(): string[] {
  const directories: string[] = [];

  // Always include package built-in skills first (lowest priority, always available)
  // This provides self-documenting capabilities out-of-the-box
  const packageRoot = path.join(__dirname, "..");
  const packageSkills = path.join(packageRoot, "skills");
  if (fs.existsSync(packageSkills)) {
    directories.push(packageSkills);
  }

  // Include standard Claude locations if they exist
  const homeClaudeSkills = path.join(os.homedir(), ".claude", "skills");
  if (fs.existsSync(homeClaudeSkills)) {
    directories.push(homeClaudeSkills);
  }

  const projectClaudeSkills = path.join(process.cwd(), ".claude", "skills");
  if (fs.existsSync(projectClaudeSkills)) {
    directories.push(projectClaudeSkills);
  }

  const defaultSkills = path.join(process.cwd(), "skills");
  if (fs.existsSync(defaultSkills)) {
    directories.push(defaultSkills);
  }

  // If SKILLS_DIR is set, add it (it takes precedence for duplicates)
  if (process.env.SKILLS_DIR) {
    directories.push(process.env.SKILLS_DIR);
  }

  return directories;
}

const SKILLS_DIRS = getAllSkillsDirectories();

/**
 * Main MCP server class for serving skills to AI clients.
 *
 * LocalSkillsServer handles MCP protocol communication, manages skill discovery
 * and loading through SkillLoader, and formats responses for clients.
 *
 * @example
 * ```typescript
 * const server = new LocalSkillsServer();
 * await server.run();
 * // Server is now running and listening on stdio
 * ```
 */
export class LocalSkillsServer {
  private server: Server;
  private skillLoader: SkillLoader;

  /**
   * Creates a new LocalSkillsServer instance.
   *
   * Initializes the MCP server with capabilities, creates a SkillLoader
   * for all configured directories, and sets up request handlers.
   */
  constructor() {
    this.server = new Server(
      {
        name: "local-skills-mcp",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        version: VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.skillLoader = new SkillLoader(SKILLS_DIRS);

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    // List available tools (dynamically generated to include current skill list)
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Discover skills to get current list
      const skillNames = await this.skillLoader.discoverSkills();

      // Build enhanced description for get_skill following Claude Skills best practices
      // Pattern: [What it does]. [Value proposition]. Use when [trigger conditions].
      let getSkillDescription =
        "Loads specialized expert prompt instructions that transform your capabilities for specific tasks. " +
        "Each skill provides comprehensive guidance, proven methodologies, and domain-specific best practices. " +
        "Use when you need focused expertise, systematic approaches, or professional standards for any task that would benefit from specialized knowledge. " +
        "Invoke with the skill name to receive detailed instructions that enhance your problem-solving approach with structured, expert-level guidance.";

      // Package built-in skills ensure there are always skills available
      if (skillNames.length > 0) {
        // Fetch metadata for each skill to get descriptions
        const skillsWithDescriptions: string[] = [];
        for (const skillName of skillNames) {
          try {
            const metadata = await this.skillLoader.getSkillMetadata(skillName);
            // Truncate description if too long (max 1024 chars)
            let description = metadata.description;
            if (description.length > 1024) {
              description = description.substring(0, 1021) + "...";
            }
            skillsWithDescriptions.push(`- ${skillName}: ${description}`);
          } catch {
            // If metadata fails to load, just show the skill name
            skillsWithDescriptions.push(`- ${skillName}`);
          }
        }
        getSkillDescription += `\n\nAvailable skills:\n${skillsWithDescriptions.join("\n")}`;
      }

      const tools: Tool[] = [
        {
          name: "get_skill",
          description: getSkillDescription,
          inputSchema: {
            type: "object",
            properties: {
              skill_name: {
                type: "string",
                description:
                  'The name of the skill to retrieve (e.g., "code-reviewer", "test-generator")',
              },
            },
            required: ["skill_name"],
          },
        },
        {
          name: "validate_skill",
          description:
            "Validates a SKILL.md file against name/description/frontmatter rules and returns errors + warnings.",
          inputSchema: {
            type: "object",
            properties: {
              skill_name: {
                type: "string",
                description: "The skill directory name to validate",
              },
            },
            required: ["skill_name"],
          },
        },
        {
          name: "evaluate_skill",
          description:
            "Runs Anthropic skill-creator eval loop for a skill (requires Python, Claude CLI auth, and an eval set JSON; legacy layouts may also require ANTHROPIC_API_KEY + anthropic package).",
          inputSchema: {
            type: "object",
            properties: {
              skill_name: {
                type: "string",
                description: "The skill directory name to evaluate",
              },
              eval_set_path: {
                type: "string",
                description:
                  "Optional path to eval set JSON. If omitted, common default locations are checked.",
              },
              max_iterations: {
                type: "number",
                description: "Optional max optimization iterations",
              },
              num_workers: {
                type: "number",
                description:
                  "Optional evaluator parallel workers (defaults to 1 for stable trigger measurements)",
              },
              runs_per_query: {
                type: "number",
                description:
                  "Optional repeats per query (defaults to 1; increase for variance analysis)",
              },
              timeout_seconds: {
                type: "number",
                description:
                  "Optional timeout per query in seconds (defaults to 120)",
              },
              model: {
                type: "string",
                description:
                  'Optional model passed to Claude CLI (defaults to "sonnet")',
              },
            },
            required: ["skill_name"],
          },
        },
      ];

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case "get_skill":
            return await this.handleGetSkill(request.params.arguments);
          case "validate_skill":
            return await this.handleValidateSkill(request.params.arguments);
          case "evaluate_skill":
            return await this.handleEvaluateSkill(request.params.arguments);

          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error: ${errorMessage}`,
            },
          ],
        };
      }
    });
  }

  private resolveSkillFilePath(skillName: string): string | null {
    for (let i = SKILLS_DIRS.length - 1; i >= 0; i--) {
      const candidate = path.join(SKILLS_DIRS[i], skillName, "SKILL.md");
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleValidateSkill(args: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const skillName = args?.skill_name;
    if (!skillName) {
      throw new Error("skill_name is required");
    }

    const skillFilePath = this.resolveSkillFilePath(skillName as string);
    if (!skillFilePath) {
      throw new Error(`Skill "${skillName}" not found.`);
    }

    const result = await validateSkillFile(skillFilePath);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleEvaluateSkill(args: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const skillName = args?.skill_name;
    if (!skillName) {
      throw new Error("skill_name is required");
    }

    const skillFilePath = this.resolveSkillFilePath(skillName as string);
    if (!skillFilePath) {
      throw new Error(`Skill "${skillName}" not found.`);
    }

    const result = await evaluateSkill(
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        skill_name: skillName,
        skill_path: path.dirname(skillFilePath),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        eval_set_path: args?.eval_set_path,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        max_iterations: args?.max_iterations,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        num_workers: args?.num_workers,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        runs_per_query: args?.runs_per_query,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        timeout_seconds: args?.timeout_seconds,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        model: args?.model,
      },
      REPO_ROOT
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleGetSkill(args: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const skillName = args?.skill_name;
    if (!skillName) {
      throw new Error("skill_name is required");
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const skill = await this.skillLoader.loadSkill(skillName);

    const output = [
      `# Skill: ${skill.name}`,
      ``,
      `**Description:** ${skill.description}`,
      `**Source:** ${skill.source}`,
      ``,
      `---`,
      ``,
      skill.content,
    ];

    return {
      content: [
        {
          type: "text",
          text: output.join("\n"),
        },
      ],
    };
  }

  /**
   * Starts the MCP server and connects it to stdio transport.
   *
   * This method initializes the stdio transport for MCP communication,
   * connects the server, and logs startup information including the
   * list of skill directories being monitored.
   *
   * @throws {Error} If the server fails to connect or start
   *
   * @example
   * ```typescript
   * const server = new LocalSkillsServer();
   * await server.run();
   * // Output to stderr:
   * // Local Skills MCP Server v0.1.0 running on stdio
   * // Aggregating skills from 3 directories:
   * //   - /home/user/.claude/skills
   * //   - /home/user/project/.claude/skills
   * //   - /home/user/project/skills
   * ```
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`Local Skills MCP Server v${VERSION} running on stdio`);
    console.error(
      `Aggregating skills from ${SKILLS_DIRS.length} director${SKILLS_DIRS.length === 1 ? "y" : "ies"}:`
    );
    SKILLS_DIRS.forEach((dir) => console.error(`  - ${dir}`));
  }

  /**
   * Closes the server and releases all resources.
   *
   * This method properly shuts down the MCP server and waits for all
   * file handles and resources to be released. This is particularly
   * important on Windows where file handles may take longer to release.
   *
   * @example
   * ```typescript
   * const server = new LocalSkillsServer();
   * await server.run();
   * // ... do work ...
   * await server.close();
   * ```
   */
  async close(): Promise<void> {
    await this.server.close();
    // Allow time for all handles to be released (important on Windows)
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// Start the server only if this module is being run directly
/* istanbul ignore if */
if (
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] && __filename === fs.realpathSync(process.argv[1]))
) {
  const server = new LocalSkillsServer();
  server.run().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
  });
}
