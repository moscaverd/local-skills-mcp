import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "child_process";

export interface EvaluateSkillInput {
  skill_name: string;
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

interface PrerequisiteCheck {
  ok: boolean;
  pythonCommand?: string;
  runLoopPath: string;
  missing: string[];
}

export function checkEvaluatePrerequisites(
  repoRoot: string
): PrerequisiteCheck {
  const missing: string[] = [];

  const pythonCommand = ["python3", "python"].find((cmd) => {
    const result = spawnSync(cmd, ["--version"], { stdio: "ignore" });
    return result.status === 0;
  });

  if (!pythonCommand) {
    missing.push("Python (python3 or python)");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    missing.push("ANTHROPIC_API_KEY environment variable");
  }

  const runLoopPath = path.join(
    repoRoot,
    "vendor",
    "anthropic-skills",
    "run_loop.py"
  );
  if (!fs.existsSync(runLoopPath)) {
    missing.push(`Anthropic run_loop.py script at ${runLoopPath}`);
  }

  if (pythonCommand) {
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
    runLoopPath,
    missing,
  };
}

function parseJsonFromOutput(output: string): EvaluateSkillResult {
  const lines = output
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
  const args = [prerequisites.runLoopPath, "--skill-name", input.skill_name];

  if (input.eval_set_path) {
    args.push("--eval-set-path", input.eval_set_path);
  }
  if (typeof input.max_iterations === "number") {
    args.push("--max-iterations", String(input.max_iterations));
  }
  if (input.model) {
    args.push("--model", input.model);
  }

  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(pythonCommand, args, {
      cwd: repoRoot,
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

    child.on("error", (error) => {
      reject(new Error(`Failed to start run_loop.py: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `run_loop.py exited with code ${code}. ${stderr.trim() || "No stderr output."}`
          )
        );
        return;
      }
      resolve(stdout);
    });
  });

  return parseJsonFromOutput(output);
}
