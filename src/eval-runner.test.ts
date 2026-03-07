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
    expect(result.missing.join(" ")).toContain("ANTHROPIC_API_KEY");
    expect(result.missing.join(" ")).toContain("run_loop.py");
  });

  it("parses JSON result from run_loop output", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0 } as any);

    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const proc = new EventEmitter() as any;
    proc.stdout = stdout;
    proc.stderr = stderr;

    vi.mocked(spawn).mockReturnValue(proc);

    const promise = evaluateSkill({ skill_name: "skill-a" }, "/repo");
    stdout.emit(
      "data",
      'log line\n{"best_description":"best","scores":{"baseline":0.5},"iteration_history":[]}\n'
    );
    proc.emit("close", 0);

    await expect(promise).resolves.toEqual({
      best_description: "best",
      scores: { baseline: 0.5 },
      iteration_history: [],
    });
  });
});
