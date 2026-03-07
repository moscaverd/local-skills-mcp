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
    apply: false,
    model: "sonnet",
    numWorkers: 1,
    runsPerQuery: 3,
    timeoutSeconds: 90,
    holdout: 0.4,
    triggerThreshold: 0.5,
    maxIterations: 3,
    calibrationRepeats: 3,
    candidateRepeats: 3,
    evalLimit: 0,
    skills: [...DEFAULT_SKILLS],
    outputPath: "",
  };

  const args = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--apply") {
      args.apply = true;
      continue;
    }
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
      case "--timeout":
        args.timeoutSeconds = Number.parseInt(next, 10);
        break;
      case "--holdout":
        args.holdout = Number.parseFloat(next);
        break;
      case "--trigger-threshold":
        args.triggerThreshold = Number.parseFloat(next);
        break;
      case "--max-iterations":
        args.maxIterations = Number.parseInt(next, 10);
        break;
      case "--calibration-repeats":
        args.calibrationRepeats = Number.parseInt(next, 10);
        break;
      case "--candidate-repeats":
        args.candidateRepeats = Number.parseInt(next, 10);
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
      case "--output":
        args.outputPath = next;
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
  if (args.timeoutSeconds < 1) {
    throw new Error("--timeout must be >= 1");
  }
  if (args.maxIterations < 1) {
    throw new Error("--max-iterations must be >= 1");
  }
  if (args.calibrationRepeats < 1) {
    throw new Error("--calibration-repeats must be >= 1");
  }
  if (args.candidateRepeats < 1) {
    throw new Error("--candidate-repeats must be >= 1");
  }
  if (args.holdout < 0 || args.holdout > 1) {
    throw new Error("--holdout must be between 0 and 1");
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
  return {
    frontmatter,
    body: markdown.slice(match[0].length),
  };
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

function updateSkillDescriptionFile(skillFilePath, newDescription) {
  const existing = fs.readFileSync(skillFilePath, "utf8");
  const { frontmatter, body } = parseFrontmatter(existing);
  frontmatter.description = newDescription;
  const serializedFrontmatter = YAML.stringify(frontmatter).trimEnd();
  const normalizedBody = body.replace(/^\n*/, "");
  const updated = `---\n${serializedFrontmatter}\n---\n\n${normalizedBody}`;
  fs.writeFileSync(skillFilePath, updated, "utf8");
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function parseJsonFromOutput(output, context) {
  const trimmed = output.trim();
  if (!trimmed) {
    throw new Error(`${context}: command produced no stdout`);
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through
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

function runPythonModule({
  cwd,
  moduleName,
  args,
  context,
}) {
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
    falsePositives,
    falseNegatives,
    score: total > 0 ? passed / total : 0,
  };
}

function getDescriptionFromSkillFile(skillFilePath) {
  const content = fs.readFileSync(skillFilePath, "utf8");
  const { frontmatter } = parseFrontmatter(content);
  if (typeof frontmatter.description !== "string") {
    throw new Error(`Missing string description in ${skillFilePath}`);
  }
  return frontmatter.description;
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

  const startedAt = new Date().toISOString();
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const evalDir = path.join(repoRoot, "evals");
  fs.mkdirSync(evalDir, { recursive: true });

  const skillReports = [];

  for (const skillName of args.skills) {
    const skillFilePath = path.join(repoRoot, "skills", skillName, "SKILL.md");
    const evalSetPath = path.join(repoRoot, "evals", `${skillName}.json`);

    if (!fs.existsSync(skillFilePath)) {
      throw new Error(`Skill file not found: ${skillFilePath}`);
    }
    if (!fs.existsSync(evalSetPath)) {
      throw new Error(`Eval set not found: ${evalSetPath}`);
    }

    const fullEvalSet = JSON.parse(fs.readFileSync(evalSetPath, "utf8"));
    const scopedEvalSet = selectBalancedEvalSubset(fullEvalSet, args.evalLimit);
    const scopedEvalPath = path.join(
      os.tmpdir(),
      `optimize-skills-${skillName}-${runId}.json`
    );
    fs.writeFileSync(scopedEvalPath, JSON.stringify(scopedEvalSet, null, 2));

    const baselineDescription = getDescriptionFromSkillFile(skillFilePath);

    const baselineRuns = [];
    for (let i = 0; i < args.calibrationRepeats; i++) {
      const { stdout } = await runPythonModule({
        cwd: runToolCwd,
        moduleName: "scripts.run_eval",
        args: [
          "--eval-set",
          scopedEvalPath,
          "--skill-path",
          path.join(repoRoot, "skills", skillName),
          "--description",
          baselineDescription,
          "--num-workers",
          String(args.numWorkers),
          "--runs-per-query",
          String(args.runsPerQuery),
          "--timeout",
          String(args.timeoutSeconds),
          "--trigger-threshold",
          String(args.triggerThreshold),
          "--model",
          args.model,
        ],
        context: `baseline run_eval (${skillName})`,
      });
      baselineRuns.push(parseJsonFromOutput(stdout, `baseline run_eval ${skillName}`));
    }

    const { stdout: optimizeStdout } = await runPythonModule({
      cwd: runToolCwd,
      moduleName: "scripts.run_loop",
      args: [
        "--eval-set",
        scopedEvalPath,
        "--skill-path",
        path.join(repoRoot, "skills", skillName),
        "--description",
        baselineDescription,
        "--num-workers",
        String(args.numWorkers),
        "--runs-per-query",
        String(args.runsPerQuery),
        "--timeout",
        String(args.timeoutSeconds),
        "--max-iterations",
        String(args.maxIterations),
        "--trigger-threshold",
        String(args.triggerThreshold),
        "--holdout",
        String(args.holdout),
        "--model",
        args.model,
        "--report",
        "none",
      ],
      context: `run_loop optimization (${skillName})`,
    });

    const loopResult = parseJsonFromOutput(
      optimizeStdout,
      `run_loop optimization ${skillName}`
    );
    const candidateDescription =
      typeof loopResult.best_description === "string"
        ? loopResult.best_description
        : baselineDescription;

    const candidateRuns = [];
    for (let i = 0; i < args.candidateRepeats; i++) {
      const { stdout } = await runPythonModule({
        cwd: runToolCwd,
        moduleName: "scripts.run_eval",
        args: [
          "--eval-set",
          scopedEvalPath,
          "--skill-path",
          path.join(repoRoot, "skills", skillName),
          "--description",
          candidateDescription,
          "--num-workers",
          String(args.numWorkers),
          "--runs-per-query",
          String(args.runsPerQuery),
          "--timeout",
          String(args.timeoutSeconds),
          "--trigger-threshold",
          String(args.triggerThreshold),
          "--model",
          args.model,
        ],
        context: `candidate run_eval (${skillName})`,
      });
      candidateRuns.push(
        parseJsonFromOutput(stdout, `candidate run_eval ${skillName}`)
      );
    }

    const baselineSummary = baselineRuns.map(summarizeEvalResult);
    const candidateSummary = candidateRuns.map(summarizeEvalResult);

    const baselineMedianPassed = median(
      baselineSummary.map((entry) => entry.passed)
    );
    const candidateMedianPassed = median(
      candidateSummary.map((entry) => entry.passed)
    );
    const baselineMedianFalsePositives = median(
      baselineSummary.map((entry) => entry.falsePositives)
    );
    const candidateMedianFalsePositives = median(
      candidateSummary.map((entry) => entry.falsePositives)
    );

    let winner = "baseline";
    if (candidateMedianPassed > baselineMedianPassed) {
      winner = "candidate";
    } else if (
      candidateMedianPassed === baselineMedianPassed &&
      candidateMedianFalsePositives < baselineMedianFalsePositives
    ) {
      winner = "candidate";
    }

    const updated = args.apply && winner === "candidate";
    if (updated && candidateDescription !== baselineDescription) {
      updateSkillDescriptionFile(skillFilePath, candidateDescription);
    }

    const report = {
      skill: skillName,
      baseline_description: baselineDescription,
      candidate_description: candidateDescription,
      baseline: {
        runs: baselineSummary,
        median_passed: baselineMedianPassed,
        median_false_positives: baselineMedianFalsePositives,
      },
      candidate: {
        runs: candidateSummary,
        median_passed: candidateMedianPassed,
        median_false_positives: candidateMedianFalsePositives,
      },
      loop_result: {
        best_score: loopResult.best_score,
        best_train_score: loopResult.best_train_score,
        best_test_score: loopResult.best_test_score,
        iterations_run: loopResult.iterations_run,
        exit_reason: loopResult.exit_reason,
      },
      winner,
      applied: updated && candidateDescription !== baselineDescription,
      applied_noop: updated && candidateDescription === baselineDescription,
      eval_set_size: scopedEvalSet.length,
    };

    skillReports.push(report);

    console.log(
      `[${skillName}] baseline=${baselineMedianPassed} candidate=${candidateMedianPassed} winner=${winner} applied=${report.applied}`
    );
  }

  const output = {
    startedAt,
    endedAt: new Date().toISOString(),
    settings: {
      apply: args.apply,
      model: args.model,
      num_workers: args.numWorkers,
      runs_per_query: args.runsPerQuery,
      timeout_seconds: args.timeoutSeconds,
      holdout: args.holdout,
      trigger_threshold: args.triggerThreshold,
      max_iterations: args.maxIterations,
      calibration_repeats: args.calibrationRepeats,
      candidate_repeats: args.candidateRepeats,
      eval_limit: args.evalLimit,
      skills: args.skills,
    },
    skills: skillReports,
  };

  const outputPath =
    args.outputPath ||
    path.join(evalDir, `final-skill-benchmark-${runId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Saved benchmark artifact: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
