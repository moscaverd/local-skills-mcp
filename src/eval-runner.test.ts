import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";

vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
  },
}));

vi.mock("child_process", () => ({
  spawnSync: vi.fn(),
  spawn: vi.fn(),
}));

import fs from "fs";
import { spawnSync, spawn } from "child_process";
import { checkEvaluatePrerequisites, evaluateSkill } from "./eval-runner.js";

describe("eval-runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("reports missing dependencies", () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    delete process.env.ANTHROPIC_API_KEY;

    const result = checkEvaluatePrerequisites("/repo");
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("Python (python3 or python)");
    expect(result.missing).toContain("Claude CLI (claude)");
    expect(result.missing.join(" ")).toContain("ANTHROPIC_API_KEY");
    expect(result.missing.join(" ")).toContain("run_loop.py");
  });

  it("detects the current Anthropic skill-creator run_loop layout", () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) =>
      String(target).endsWith(
        "vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
      )
    );

    const result = checkEvaluatePrerequisites("/repo");

    expect(result.ok).toBe(true);
    expect(result.runLoopInvocation).toBe("module");
    expect(result.runLoopPath).toBe(
      "/repo/vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
    );
    expect(result.runLoopCwd).toBe(
      "/repo/vendor/anthropic-skills/skills/skill-creator"
    );
  });

  it("runs scripts.run_loop and parses multiline JSON output", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = String(target);
      return (
        value.endsWith(
          "vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
        ) ||
        value.endsWith("/skills/skill-a/SKILL.md") ||
        value === "/repo/evals/skill-a.json"
      );
    });

    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const proc = new EventEmitter() as any;
    proc.stdout = stdout;
    proc.stderr = stderr;

    vi.mocked(spawn).mockReturnValue(proc);

    const promise = evaluateSkill(
      {
        skill_name: "skill-a",
        skill_path: "/repo/skills/skill-a",
        eval_set_path: "/repo/evals/skill-a.json",
        max_iterations: 2,
      },
      "/repo"
    );

    stdout.emit(
      "data",
      `{
  "best_description": "best",
  "scores": {
    "baseline": 0.5
  },
  "iteration_history": []
}\n`
    );
    proc.emit("close", 0);

    await expect(promise).resolves.toEqual({
      best_description: "best",
      scores: { baseline: 0.5 },
      iteration_history: [],
    });

    expect(spawn).toHaveBeenCalledWith(
      "python3",
      [
        "-m",
        "scripts.run_loop",
        "--skill-path",
        "/repo/skills/skill-a",
        "--eval-set",
        "/repo/evals/skill-a.json",
        "--model",
        "sonnet",
        "--report",
        "none",
        "--max-iterations",
        "2",
      ],
      {
        cwd: "/repo/vendor/anthropic-skills/skills/skill-creator",
        env: process.env,
      }
    );
  });

  it("requires an eval set when no default eval file exists", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = String(target);
      return (
        value.endsWith(
          "vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
        ) || value.endsWith("/skills/skill-a/SKILL.md")
      );
    });

    await expect(
      evaluateSkill(
        {
          skill_name: "skill-a",
          skill_path: "/repo/skills/skill-a",
        },
        "/repo"
      )
    ).rejects.toThrow("Provide eval_set_path");
  });
});
