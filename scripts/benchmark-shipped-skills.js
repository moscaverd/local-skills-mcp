#!/usr/bin/env node

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import YAML from "yaml";

const DEFAULT_SKILLS = [
  "local-skills-mcp-guide",
  "local-skills-mcp-usage",
  "skill-creator",
];

function parseArgs(argv) {
  const defaults = {
    model: "sonnet",
    numWorkers: 1,
    runsPerQuery: 3,
    repeats: 1,
    timeoutSeconds: 45,
    triggerThreshold: 0.5,
    evalLimit: 0,
    skills: [...DEFAULT_SKILLS],
    descriptionOverridesPath: "",
    outputPath: "",
    label: "",
    localSkillsMcpPath: "",
  };

  const args = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for argument: ${token}`);
    }

    switch (token) {
      case "--model":
        args.model = next;
        break;
      case "--num-workers":
        args.numWorkers = Number.parseInt(next, 10);
        break;
      case "--runs-per-query":
        args.runsPerQuery = Number.parseInt(next, 10);
        break;
      case "--repeats":
        args.repeats = Number.parseInt(next, 10);
        break;
      case "--timeout":
        args.timeoutSeconds = Number.parseInt(next, 10);
        break;
      case "--trigger-threshold":
        args.triggerThreshold = Number.parseFloat(next);
        break;
      case "--eval-limit":
        args.evalLimit = Number.parseInt(next, 10);
        break;
      case "--skills":
        args.skills = next
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
        break;
      case "--description-overrides":
        args.descriptionOverridesPath = next;
        break;
      case "--output":
        args.outputPath = next;
        break;
      case "--label":
        args.label = next;
        break;
      case "--local-skills-mcp-path":
        args.localSkillsMcpPath = next;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
    i++;
  }

  if (args.numWorkers < 1) {
    throw new Error("--num-workers must be >= 1");
  }
  if (args.runsPerQuery < 1) {
    throw new Error("--runs-per-query must be >= 1");
  }
  if (args.repeats < 1) {
    throw new Error("--repeats must be >= 1");
  }
  if (args.timeoutSeconds < 1) {
    throw new Error("--timeout must be >= 1");
  }
  if (args.triggerThreshold < 0 || args.triggerThreshold > 1) {
    throw new Error("--trigger-threshold must be between 0 and 1");
  }
  if (args.evalLimit < 0) {
    throw new Error("--eval-limit must be >= 0");
  }
  if (args.skills.length === 0) {
    throw new Error("No skills provided");
  }

  return args;
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    throw new Error("SKILL.md must start with YAML frontmatter");
  }
  const frontmatter = YAML.parse(match[1]);
  if (!frontmatter || typeof frontmatter !== "object") {
    throw new Error("Failed to parse SKILL.md frontmatter");
  }
  return frontmatter;
}

function getDescriptionFromSkillFile(skillFilePath) {
  const content = fs.readFileSync(skillFilePath, "utf8");
  const frontmatter = parseFrontmatter(content);
  if (typeof frontmatter.description !== "string") {
    throw new Error(`Missing string description in ${skillFilePath}`);
  }
  return frontmatter.description;
}

function selectBalancedEvalSubset(evalSet, limit) {
  if (limit <= 0 || evalSet.length <= limit) {
    return evalSet;
  }

  const positives = evalSet.filter((entry) => entry.should_trigger === true);
  const negatives = evalSet.filter((entry) => entry.should_trigger === false);

  let targetPos = Math.min(Math.ceil(limit / 2), positives.length);
  let targetNeg = Math.min(Math.floor(limit / 2), negatives.length);

  let selected = [...positives.slice(0, targetPos), ...negatives.slice(0, targetNeg)];
  if (selected.length < limit) {
    const remainingPos = positives.slice(targetPos);
    const remainingNeg = negatives.slice(targetNeg);
    const fillPool = [...remainingPos, ...remainingNeg];
    selected = selected.concat(fillPool.slice(0, limit - selected.length));
  }

  return selected;
}

function parseJsonFromOutput(output, context) {
  const trimmed = output.trim();
  if (!trimmed) {
    throw new Error(`${context}: command produced no stdout`);
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to fallback parsing.
  }

  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();

  for (const line of lines) {
    try {
      return JSON.parse(line);
    } catch {
      continue;
    }
  }

  throw new Error(`${context}: failed to parse JSON output`);
}

function runPythonModule({ cwd, moduleName, args, context }) {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", ["-m", moduleName, ...args], {
      cwd,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += String(data);
    });

    child.stderr.on("data", (data) => {
      stderr += String(data);
    });

    child.on("error", (error) => {
      reject(new Error(`${context}: failed to spawn process (${error.message})`));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const detail = stderr.trim() || stdout.trim() || "No output.";
        reject(new Error(`${context}: exited with code ${code}. ${detail}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function summarizeEvalResult(evalResult) {
  const results = Array.isArray(evalResult.results) ? evalResult.results : [];
  const passed = Number(evalResult.summary?.passed ?? 0);
  const total = Number(evalResult.summary?.total ?? results.length);
  const falsePositives = results.filter(
    (entry) => entry.should_trigger === false && entry.pass === false
  ).length;
  const falseNegatives = results.filter(
    (entry) => entry.should_trigger === true && entry.pass === false
  ).length;

  return {
    passed,
    total,
    failed: Math.max(total - passed, 0),
    falsePositives,
    falseNegatives,
    score: total > 0 ? passed / total : 0,
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const runToolCwd = path.join(
    repoRoot,
    "vendor",
    "anthropic-skills",
    "skills",
    "skill-creator"
  );
  const evalDir = path.join(repoRoot, "evals");
  fs.mkdirSync(evalDir, { recursive: true });

  // Resolve local-skills-mcp path only if explicitly provided via --local-skills-mcp-path.
  // By default, use command-file mode (creates .claude/commands/ files) which
  // works correctly in this project. Pass --local-skills-mcp-path to switch to
  // MCP mode for environments where command files are not auto-triggered.
  const localSkillsMcpPath = args.localSkillsMcpPath || "";

  const startedAt = new Date().toISOString();
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const skillReports = [];
  let descriptionOverrides = {};

  if (args.descriptionOverridesPath) {
    const resolvedOverridesPath = path.isAbsolute(args.descriptionOverridesPath)
      ? args.descriptionOverridesPath
      : path.resolve(repoRoot, args.descriptionOverridesPath);
    if (!fs.existsSync(resolvedOverridesPath)) {
      throw new Error(
        `Description overrides file not found: ${resolvedOverridesPath}`
      );
    }
    descriptionOverrides = JSON.parse(
      fs.readFileSync(resolvedOverridesPath, "utf8")
    );
  }

  // Run up to numWorkers skills in parallel (default 1 = sequential).
  // run_eval.py always uses --num-workers 1 (sequential queries) so only one
  // command file exists in .claude/commands/ at a time, preventing cross-skill
  // contamination.
  async function evalSkill(skillName) {
    const skillFilePath = path.join(repoRoot, "skills", skillName, "SKILL.md");
    const evalSetPath = path.join(repoRoot, "evals", `${skillName}.json`);

    if (!fs.existsSync(skillFilePath)) {
      throw new Error(`Skill file not found: ${skillFilePath}`);
    }
    if (!fs.existsSync(evalSetPath)) {
      throw new Error(`Eval set not found: ${evalSetPath}`);
    }

    const evalSet = JSON.parse(fs.readFileSync(evalSetPath, "utf8"));
    const scopedEvalSet = selectBalancedEvalSubset(evalSet, args.evalLimit);
    const scopedEvalPath = path.join(
      os.tmpdir(),
      `benchmark-shipped-${skillName}-${runId}.json`
    );
    fs.writeFileSync(scopedEvalPath, JSON.stringify(scopedEvalSet, null, 2));

    const overrideDescription = descriptionOverrides[skillName];
    const description =
      typeof overrideDescription === "string" && overrideDescription.length > 0
        ? overrideDescription
        : getDescriptionFromSkillFile(skillFilePath);
    const evalRuns = [];

    for (let i = 0; i < args.repeats; i++) {
      const { stdout } = await runPythonModule({
        cwd: runToolCwd,
        moduleName: "scripts.run_eval",
        args: [
          "--eval-set",
          scopedEvalPath,
          "--skill-path",
          path.join(repoRoot, "skills", skillName),
          "--description",
          description,
          // Always 1: parallel workers in the same commands dir cause
          // interference (each UUID file is visible to all Claude subprocesses
          // but each worker only watches for its own UUID).
          "--num-workers", "1",
          "--runs-per-query",
          String(args.runsPerQuery),
          "--timeout",
          String(args.timeoutSeconds),
          "--trigger-threshold",
          String(args.triggerThreshold),
          "--model",
          args.model,
          ...(localSkillsMcpPath
            ? ["--local-skills-mcp-path", localSkillsMcpPath]
            : []),
        ],
        context: `run_eval (${skillName}, repeat ${i + 1}/${args.repeats})`,
      });

      const evalResult = parseJsonFromOutput(
        stdout,
        `run_eval ${skillName} repeat ${i + 1}`
      );
      evalRuns.push(evalResult);
    }

    const runSummaries = evalRuns.map((run) => summarizeEvalResult(run));
    const summary = {
      median_passed: median(runSummaries.map((run) => run.passed)),
      median_total: median(runSummaries.map((run) => run.total)),
      median_failed: median(runSummaries.map((run) => run.failed)),
      median_false_positives: median(
        runSummaries.map((run) => run.falsePositives)
      ),
      median_false_negatives: median(
        runSummaries.map((run) => run.falseNegatives)
      ),
      median_score: median(runSummaries.map((run) => run.score)),
      runs: runSummaries,
    };

    console.log(
      `[${skillName}] median_passed=${summary.median_passed}/${summary.median_total} median_false_pos=${summary.median_false_positives} median_false_neg=${summary.median_false_negatives} median_score=${summary.median_score.toFixed(3)}`
    );

    return {
      skill: skillName,
      description,
      eval_set_size: scopedEvalSet.length,
      summary,
      raw_runs: evalRuns,
    };
  }

  // Run skills in batches of numWorkers in parallel.
  for (let i = 0; i < args.skills.length; i += args.numWorkers) {
    const batch = args.skills.slice(i, i + args.numWorkers);
    const batchResults = await Promise.all(batch.map(evalSkill));
    skillReports.push(...batchResults);
  }

  const output = {
    startedAt,
    endedAt: new Date().toISOString(),
    label: args.label || undefined,
    settings: {
      model: args.model,
      num_workers_skills: args.numWorkers,
      runs_per_query: args.runsPerQuery,
      repeats: args.repeats,
      timeout_seconds: args.timeoutSeconds,
      trigger_threshold: args.triggerThreshold,
      eval_limit: args.evalLimit,
      skills: args.skills,
      description_overrides_path: args.descriptionOverridesPath || undefined,
      local_skills_mcp_path: localSkillsMcpPath || undefined,
    },
    skills: skillReports,
  };

  const outputPath =
    args.outputPath ||
    path.join(evalDir, `shipped-skill-benchmark-${runId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Saved benchmark artifact: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
