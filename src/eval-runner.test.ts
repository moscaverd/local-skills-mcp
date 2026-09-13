import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import path from "path";

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

/** Normalize path separators to forward slashes for cross-platform matching */
function norm(p: string): string {
  return p.replace(/\\/g, "/");
}

describe("eval-runner", () => {
  afterEach(() => vi.unstubAllEnvs());

  beforeEach(() => {
    // resetAllMocks, not restoreAllMocks: as of Vitest 4 the latter only
    // restores vi.spyOn spies, so unconsumed mockReturnValueOnce queues from
    // an earlier test leaked into the next one and shifted its expectations.
    vi.resetAllMocks();
    // Re-apply mocks after reset
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any);
    vi.mocked(spawn).mockReturnValue(new EventEmitter() as any);
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  });

  it("reports missing dependencies", () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);

    const result = checkEvaluatePrerequisites("/repo");
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("Python (python3 or python)");
    expect(result.missing).toContain("Claude CLI (claude)");
    expect(result.missing.join(" ")).toContain("run_loop.py");
  });

  it("detects the current Anthropic skill-creator run_loop layout", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);

    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) =>
      norm(String(target)).endsWith(
        "vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
      )
    );

    const result = checkEvaluatePrerequisites("/repo");

    expect(result.ok).toBe(true);
    expect(result.runLoopInvocation).toBe("module");
    expect(result.runLoopPath).toBe(
      path.join(
        "/repo",
        "vendor",
        "anthropic-skills",
        "skills",
        "skill-creator",
        "scripts",
        "run_loop.py"
      )
    );
    expect(result.runLoopCwd).toBe(
      path.join(
        "/repo",
        "vendor",
        "anthropic-skills",
        "skills",
        "skill-creator"
      )
    );
  });

  it("requires API-key style auth in legacy run_loop layout", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);

    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) =>
      norm(String(target)).endsWith("vendor/anthropic-skills/run_loop.py")
    );

    const result = checkEvaluatePrerequisites("/repo");
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("ANTHROPIC_API_KEY environment variable");
  });

  it("runs scripts.run_loop and parses multiline JSON output", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = norm(String(target));
      return (
        value.endsWith(
          "vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
        ) ||
        value.endsWith("/skills/skill-a/SKILL.md") ||
        value.endsWith("/repo/evals/skill-a.json")
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
        skill_path: path.join("/repo", "skills", "skill-a"),
        eval_set_path: path.join("/repo", "evals", "skill-a.json"),
        max_iterations: 2,
        holdout: 0.25,
        trigger_threshold: 0.7,
        description_override: "override description",
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
        path.join("/repo", "skills", "skill-a"),
        "--eval-set",
        path.join("/repo", "evals", "skill-a.json"),
        "--model",
        "sonnet",
        "--report",
        "none",
        "--trigger-threshold",
        "0.7",
        "--holdout",
        "0.25",
        "--num-workers",
        "1",
        "--runs-per-query",
        "1",
        "--timeout",
        "120",
        "--description",
        "override description",
        "--max-iterations",
        "2",
      ],
      {
        cwd: path.join(
          "/repo",
          "vendor",
          "anthropic-skills",
          "skills",
          "skill-creator"
        ),
        env: process.env,
      }
    );
  });

  it("rejects when child process emits error event", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = norm(String(target));
      return (
        value.endsWith(
          "vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
        ) ||
        value.endsWith("/skills/skill-a/SKILL.md") ||
        value.endsWith("/repo/evals/skill-a.json")
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
      },
      "/repo"
    );

    proc.emit("error", new Error("spawn ENOENT"));

    await expect(promise).rejects.toThrow("Failed to start run_loop.py");
  });

  it("rejects when child process exits with non-zero code", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = norm(String(target));
      return (
        value.endsWith(
          "vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
        ) ||
        value.endsWith("/skills/skill-a/SKILL.md") ||
        value.endsWith("/repo/evals/skill-a.json")
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
      },
      "/repo"
    );

    stderr.emit("data", "Something went wrong");
    proc.emit("close", 1);

    await expect(promise).rejects.toThrow("run_loop.py exited with code 1");
  });

  it("uses stdout when stderr is empty on non-zero exit", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = norm(String(target));
      return (
        value.endsWith(
          "vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
        ) ||
        value.endsWith("/skills/skill-a/SKILL.md") ||
        value.endsWith("/repo/evals/skill-a.json")
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
      },
      "/repo"
    );

    stdout.emit("data", "stdout error details");
    proc.emit("close", 2);

    await expect(promise).rejects.toThrow("stdout error details");
  });

  it("shows 'No output' when both stdout and stderr are empty on failure", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = norm(String(target));
      return (
        value.endsWith(
          "vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
        ) ||
        value.endsWith("/skills/skill-a/SKILL.md") ||
        value.endsWith("/repo/evals/skill-a.json")
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
      },
      "/repo"
    );

    proc.emit("close", 1);

    await expect(promise).rejects.toThrow("No output.");
  });

  it("requires an eval set when no default eval file exists", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = norm(String(target));
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

  it("rejects when prerequisites are not met", async () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await expect(
      evaluateSkill(
        { skill_name: "skill-a", eval_set_path: "/repo/evals/skill-a.json" },
        "/repo"
      )
    ).rejects.toThrow("Missing requirements");
  });

  it("rejects when skill SKILL.md does not exist", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = norm(String(target));
      return value.endsWith(
        "vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
      );
    });

    await expect(
      evaluateSkill(
        { skill_name: "missing-skill", eval_set_path: "/repo/evals/x.json" },
        "/repo"
      )
    ).rejects.toThrow("does not contain SKILL.md");
  });

  it("rejects when explicit eval_set_path does not exist", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = norm(String(target));
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
          eval_set_path: "/nonexistent/eval.json",
        },
        "/repo"
      )
    ).rejects.toThrow("eval_set_path does not exist");
  });

  it("parses JSON embedded in non-JSON output", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = norm(String(target));
      return (
        value.endsWith(
          "vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
        ) ||
        value.endsWith("/skills/skill-a/SKILL.md") ||
        value.endsWith("/repo/evals/skill-a.json")
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
      },
      "/repo"
    );

    stdout.emit(
      "data",
      'Some log output\n{"best_description": "desc"}\nMore log output\n'
    );
    proc.emit("close", 0);

    await expect(promise).resolves.toEqual({ best_description: "desc" });
  });

  it("parses JSON from last line when embedded parse fails", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = norm(String(target));
      return (
        value.endsWith(
          "vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
        ) ||
        value.endsWith("/skills/skill-a/SKILL.md") ||
        value.endsWith("/repo/evals/skill-a.json")
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
      },
      "/repo"
    );

    stdout.emit("data", 'log line 1\nlog line 2\n{"scores":{"a":1}}\n');
    proc.emit("close", 0);

    await expect(promise).resolves.toEqual({ scores: { a: 1 } });
  });

  it("rejects when output contains no valid JSON", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = norm(String(target));
      return (
        value.endsWith(
          "vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
        ) ||
        value.endsWith("/skills/skill-a/SKILL.md") ||
        value.endsWith("/repo/evals/skill-a.json")
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
      },
      "/repo"
    );

    stdout.emit("data", "not json at all\njust text\n");
    proc.emit("close", 0);

    await expect(promise).rejects.toThrow("no JSON results were found");
  });

  it("rejects when output is empty", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = norm(String(target));
      return (
        value.endsWith(
          "vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
        ) ||
        value.endsWith("/skills/skill-a/SKILL.md") ||
        value.endsWith("/repo/evals/skill-a.json")
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
      },
      "/repo"
    );

    proc.emit("close", 0);

    await expect(promise).rejects.toThrow("produced no JSON output");
  });

  it("uses legacy script invocation path", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any) // python3
      .mockReturnValueOnce({ status: 0 } as any) // claude
      .mockReturnValueOnce({ status: 0 } as any); // anthropic import

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = norm(String(target));
      return (
        value.endsWith("vendor/anthropic-skills/run_loop.py") ||
        value.endsWith("/skills/skill-a/SKILL.md") ||
        value.endsWith("/repo/evals/skill-a.json")
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
        max_iterations: 3,
        model: "opus",
      },
      "/repo"
    );

    stdout.emit("data", '{"best_description": "legacy"}\n');
    proc.emit("close", 0);

    await expect(promise).resolves.toEqual({ best_description: "legacy" });

    expect(spawn).toHaveBeenCalledWith(
      "python3",
      expect.arrayContaining([
        "--skill-name",
        "skill-a",
        "--max-iterations",
        "3",
        "--model",
        "opus",
      ]),
      expect.objectContaining({ cwd: "/repo" })
    );
  });

  it("uses default skill path when skill_path not provided", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = norm(String(target));
      return (
        value.endsWith(
          "vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
        ) ||
        value.endsWith("skills/my-skill/SKILL.md") ||
        value.endsWith("/repo/evals/my-skill.json")
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
        skill_name: "my-skill",
        eval_set_path: "/repo/evals/my-skill.json",
      },
      "/repo"
    );

    stdout.emit("data", '{"best_description": "found"}\n');
    proc.emit("close", 0);

    await expect(promise).resolves.toEqual({ best_description: "found" });
  });

  it("detects missing anthropic package in legacy layout", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any) // python3 --version
      .mockReturnValueOnce({ status: 0 } as any) // claude --version
      .mockReturnValueOnce({ status: 1 } as any); // python3 -c "import anthropic"

    vi.mocked(fs.existsSync).mockImplementation((target: any) =>
      norm(String(target)).endsWith("vendor/anthropic-skills/run_loop.py")
    );

    const result = checkEvaluatePrerequisites("/repo");
    expect(result.ok).toBe(false);
    expect(result.missing).toContain(
      'Python package "anthropic" (install with: pip install anthropic)'
    );
  });

  it("handles SKILL.md suffix in skill_path", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = norm(String(target));
      return (
        value.endsWith(
          "vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
        ) ||
        value.endsWith("/skills/skill-a/SKILL.md") ||
        value.endsWith("/repo/evals/skill-a.json")
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
        skill_path: "/repo/skills/skill-a/SKILL.md",
        eval_set_path: "/repo/evals/skill-a.json",
      },
      "/repo"
    );

    stdout.emit("data", '{"best_description": "from-skillmd"}\n');
    proc.emit("close", 0);

    await expect(promise).resolves.toEqual({
      best_description: "from-skillmd",
    });
  });

  it("finds eval set in default candidate paths", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    vi.mocked(fs.existsSync).mockImplementation((target: any) => {
      const value = norm(String(target));
      return (
        value.endsWith(
          "vendor/anthropic-skills/skills/skill-creator/scripts/run_loop.py"
        ) ||
        value.endsWith("/skills/skill-a/SKILL.md") ||
        value.endsWith("/skills/skill-a/eval-set.json")
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
      },
      "/repo"
    );

    stdout.emit("data", '{"scores":{}}\n');
    proc.emit("close", 0);

    await expect(promise).resolves.toEqual({ scores: {} });
  });
});
