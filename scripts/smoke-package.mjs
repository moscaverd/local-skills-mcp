import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// Run with the Node version being tested against an installed npm tarball.
const packageRoot = path.resolve(
  process.argv[2] || "node_modules/local-skills-mcp"
);
const require = createRequire(path.join(packageRoot, "package.json"));
const { Client } = await import(
  pathToFileURL(require.resolve("@modelcontextprotocol/sdk/client/index.js"))
);
const { StdioClientTransport } = await import(
  pathToFileURL(require.resolve("@modelcontextprotocol/sdk/client/stdio.js"))
);
const fixture = await fs.mkdtemp(
  path.join(os.tmpdir(), "skills-package-smoke-")
);
const skills = path.join(fixture, "skills");
const makeSkill = async (name, content) => {
  const dir = path.join(skills, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: Use this fixture to verify packed runtime behavior.\n---\n${content}`
  );
};
await makeSkill("cold-fixture", "Cold package fixture content");
const preload = path.join(fixture, "isolate-home.cjs");
await fs.writeFile(
  preload,
  'require("node:os").homedir = () => process.cwd(); require("node:module").syncBuiltinESMExports();'
);
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["--require", preload, path.join(packageRoot, "dist/index.js")],
  cwd: fixture,
  env: {
    SKILLS_DIR: skills,
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
  },
  stderr: "pipe",
});
const client = new Client(
  { name: "packed-runtime-smoke", version: "1.0.0" },
  { capabilities: {} }
);
const timeout = setTimeout(() => {
  console.error("Packed runtime smoke timed out");
  process.exitCode = 1;
  void client.close();
}, 30000);
try {
  await client.connect(transport);
  const cold = await client.callTool({
    name: "get_skill",
    arguments: { skill_name: "cold-fixture" },
  });
  assert.match(cold.content[0].text, /Cold package fixture content/);
  await makeSkill("new-fixture", "Discovered after cold request");
  const added = await client.callTool({
    name: "get_skill",
    arguments: { skill_name: "new-fixture" },
  });
  assert.match(added.content[0].text, /Discovered after cold request/);
  const list = await client.listTools();
  assert.deepEqual(list.tools.map((t) => t.name).sort(), [
    "evaluate_skill",
    "get_skill",
    "validate_skill",
  ]);
  const get = list.tools.find((t) => t.name === "get_skill");
  assert.match(get.description, /cold-fixture: Use this fixture/);
  const builtinEntries = await fs.readdir(path.join(packageRoot, "skills"), {
    withFileTypes: true,
  });
  const builtin = builtinEntries.find((e) => e.isDirectory());
  assert.ok(builtin, "npm tarball must contain built-in skills");
  const builtinResult = await client.callTool({
    name: "get_skill",
    arguments: { skill_name: builtin.name },
  });
  assert.ok(
    !builtinResult.content[0].text.startsWith("Error:"),
    "built-in skill must load"
  );
  const validated = await client.callTool({
    name: "validate_skill",
    arguments: { skill_name: "cold-fixture" },
  });
  assert.equal(JSON.parse(validated.content[0].text).valid, true);
  for (const name of ["get_skill", "validate_skill", "evaluate_skill"]) {
    const invalid = await client.callTool({
      name,
      arguments: { skill_name: "../outside" },
    });
    assert.match(invalid.content[0].text, /Invalid skill_name/);
  }
  console.log(
    JSON.stringify({
      node: process.version,
      packageVersion: require("./package.json").version,
      coldLoad: true,
      newlyAdded: true,
      metadata: true,
      builtinLoad: true,
      validation: true,
      traversalRejected: true,
    })
  );
} finally {
  clearTimeout(timeout);
  await client.close();
  await fs.rm(fixture, { recursive: true, force: true });
}
