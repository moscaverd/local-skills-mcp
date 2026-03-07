import fs from "fs";
import path from "path";
import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
} from "child_process";

const NEW_RUN_LOOP_CWD = path.join(
  "vendor",
  "anthropic-skills",
  "skills",
  "skill-creator"
);
const NEW_RUN_LOOP_PATH = path.join(NEW_RUN_LOOP_CWD, "scripts", "run_loop.py");
const LEGACY_RUN_LOOP_PATH = path.join(
  "vendor",
  "anthropic-skills",
  "run_loop.py"
);

export interface EvaluateSkillInput {
  skill_name: string;
  skill_path?: string;
  eval_set_path?: string;
  max_iterations?: number;
  model?: string;
}

export interface EvaluateSkillResult {
  best_description?: string;
  scores?: Record<string, number>;
  iteration_history?: unknown[];
  [key: string]: unknown;
}

type RunLoopInvocation = "module" | "script";

interface PrerequisiteCheck {
  ok: boolean;
  pythonCommand?: string;
  runLoopPath: string;
  runLoopCwd: string;
  runLoopInvocation: RunLoopInvocation;
  missing: string[];
}

function findRunLoop(repoRoot: string): {
  runLoopPath: string;
  runLoopCwd: string;
  runLoopInvocation: RunLoopInvocation;
} | null {
  const newPath = path.join(repoRoot, NEW_RUN_LOOP_PATH);
  if (fs.existsSync(newPath)) {
    return {
      runLoopPath: newPath,
      runLoopCwd: path.join(repoRoot, NEW_RUN_LOOP_CWD),
      runLoopInvocation: "module",
    };
  }

  const legacyPath = path.join(repoRoot, LEGACY_RUN_LOOP_PATH);
  if (fs.existsSync(legacyPath)) {
    return {
      runLoopPath: legacyPath,
      runLoopCwd: repoRoot,
      runLoopInvocation: "script",
    };
  }

  return null;
}

export function checkEvaluatePrerequisites(
  repoRoot: string
): PrerequisiteCheck {
  const missing: string[] = [];
  const runLoop = findRunLoop(repoRoot);

  const pythonCommand = ["python3", "python"].find((cmd) => {
    const result = spawnSync(cmd, ["--version"], { stdio: "ignore" });
    return result.status === 0;
  });

  if (!pythonCommand) {
    missing.push("Python (python3 or python)");
  }

  const claudeCommand = spawnSync("claude", ["--version"], {
    stdio: "ignore",
  });
  if (claudeCommand.status !== 0) {
    missing.push("Claude CLI (claude)");
  }

  if (!runLoop) {
    missing.push(
      `Anthropic run_loop.py script at ${path.join(repoRoot, NEW_RUN_LOOP_PATH)} or ${path.join(repoRoot, LEGACY_RUN_LOOP_PATH)}`
    );
  }

  // Legacy layout used Python SDK/API-key auth.
  if (
    runLoop?.runLoopInvocation === "script" &&
    !process.env.ANTHROPIC_API_KEY
  ) {
    missing.push("ANTHROPIC_API_KEY environment variable");
  }

  if (pythonCommand && runLoop?.runLoopInvocation === "script") {
    const anthropicCheck = spawnSync(
      pythonCommand,
      ["-c", "import anthropic"],
      {
        stdio: "ignore",
      }
    );

    if (anthropicCheck.status !== 0) {
      missing.push(
        'Python package "anthropic" (install with: pip install anthropic)'
      );
    }
  }

  return {
    ok: missing.length === 0,
    pythonCommand,
    runLoopPath: runLoop?.runLoopPath ?? path.join(repoRoot, NEW_RUN_LOOP_PATH),
    runLoopCwd: runLoop?.runLoopCwd ?? path.join(repoRoot, NEW_RUN_LOOP_CWD),
    runLoopInvocation: runLoop?.runLoopInvocation ?? "module",
    missing,
  };
}

function parseJsonFromOutput(output: string): EvaluateSkillResult {
  const trimmed = output.trim();
  if (trimmed.length === 0) {
    throw new Error("Evaluation completed but produced no JSON output.");
  }

  try {
    return JSON.parse(trimmed) as EvaluateSkillResult;
  } catch {
    // Continue to fallback parsing below
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const possibleJson = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(possibleJson) as EvaluateSkillResult;
    } catch {
      // Continue to line-based fallback below
    }
  }

  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();

  for (const line of lines) {
    try {
      return JSON.parse(line) as EvaluateSkillResult;
    } catch {
      continue;
    }
  }

  throw new Error(
    "Evaluation completed but no JSON results were found in output."
  );
}

function resolveSkillPath(input: EvaluateSkillInput, repoRoot: string): string {
  const requested = input.skill_path ?? path.join("skills", input.skill_name);
  const resolved = path.isAbsolute(requested)
    ? requested
    : path.resolve(repoRoot, requested);

  const skillDir = resolved.endsWith("SKILL.md")
    ? path.dirname(resolved)
    : resolved;
  const skillFilePath = path.join(skillDir, "SKILL.md");

  if (!fs.existsSync(skillFilePath)) {
    throw new Error(
      `Cannot run evaluate_skill. Skill path does not contain SKILL.md: ${skillDir}`
    );
  }

  return skillDir;
}

function resolveEvalSetPath(
  input: EvaluateSkillInput,
  repoRoot: string,
  skillDir: string
): string {
  if (input.eval_set_path) {
    const explicitPath = path.isAbsolute(input.eval_set_path)
      ? input.eval_set_path
      : path.resolve(repoRoot, input.eval_set_path);

    if (!fs.existsSync(explicitPath)) {
      throw new Error(
        `Cannot run evaluate_skill. eval_set_path does not exist: ${explicitPath}`
      );
    }

    return explicitPath;
  }

  const candidatePaths = [
    path.join(skillDir, "eval-set.json"),
    path.join(skillDir, "eval_set.json"),
    path.join(skillDir, "evals.json"),
    path.join(skillDir, "evals", "eval-set.json"),
    path.join(skillDir, "evals", "eval_set.json"),
    path.join(repoRoot, "evals", `${input.skill_name}.json`),
  ];

  const found = candidatePaths.find((candidate) => fs.existsSync(candidate));
  if (found) {
    return found;
  }

  throw new Error(
    `Cannot run evaluate_skill. No eval set found. Provide eval_set_path. Checked: ${candidatePaths.join(", ")}`
  );
}

export async function evaluateSkill(
  input: EvaluateSkillInput,
  repoRoot: string
): Promise<EvaluateSkillResult> {
  const prerequisites = checkEvaluatePrerequisites(repoRoot);
  if (!prerequisites.ok || !prerequisites.pythonCommand) {
    throw new Error(
      `Cannot run evaluate_skill. Missing requirements: ${prerequisites.missing.join(", ")}`
    );
  }
  const pythonCommand = prerequisites.pythonCommand;

  const skillDir = resolveSkillPath(input, repoRoot);
  const evalSetPath = resolveEvalSetPath(input, repoRoot, skillDir);
  const model = input.model ?? process.env.EVALUATE_SKILL_MODEL ?? "sonnet";

  let args: string[];
  if (prerequisites.runLoopInvocation === "module") {
    args = [
      "-m",
      "scripts.run_loop",
      "--skill-path",
      skillDir,
      "--eval-set",
      evalSetPath,
      "--model",
      model,
      "--report",
      "none",
    ];

    if (typeof input.max_iterations === "number") {
      args.push("--max-iterations", String(input.max_iterations));
    }
  } else {
    // Backward compatibility for older run_loop.py layout.
    args = [prerequisites.runLoopPath, "--skill-name", input.skill_name];

    if (input.eval_set_path) {
      args.push("--eval-set-path", input.eval_set_path);
    }
    if (typeof input.max_iterations === "number") {
      args.push("--max-iterations", String(input.max_iterations));
    }
    if (input.model) {
      args.push("--model", input.model);
    }
  }

  const output = await new Promise<string>((resolve, reject) => {
    const child: ChildProcessWithoutNullStreams = spawn(pythonCommand, args, {
      cwd: prerequisites.runLoopCwd,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: unknown) => {
      stdout += String(data);
    });

    child.stderr.on("data", (data: unknown) => {
      stderr += String(data);
    });

    child.on("error", (error: Error) => {
      reject(new Error(`Failed to start run_loop.py: ${error.message}`));
    });

    child.on("close", (code: number | null) => {
      if (code !== 0) {
        const details = stderr.trim() || stdout.trim() || "No output.";
        reject(new Error(`run_loop.py exited with code ${code}. ${details}`));
        return;
      }
      resolve(stdout);
    });
  });

  return parseJsonFromOutput(output);
}
