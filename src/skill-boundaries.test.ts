import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  validate: vi.fn(async () => ({ valid: true })),
  evaluate: vi.fn(async () => ({ status: "verified" })),
}));
vi.mock("./skill-validator.js", () => ({ validateSkillFile: mocks.validate }));
vi.mock("./eval-runner.js", () => ({ evaluateSkill: mocks.evaluate }));

describe("registry boundary for validation and evaluation", () => {
  let root: string;
  let skills: string;
  let server: import("./index.js").LocalSkillsServer;
  const originalListeners = process.listeners("SIGINT");

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "skill-boundaries-"));
    skills = path.join(root, "skills");
    await fs.mkdir(path.join(skills, "regular"), { recursive: true });
    await fs.mkdir(path.join(root, "outside"));
    await fs.writeFile(path.join(skills, "regular", "SKILL.md"), "fixture");
    await fs.writeFile(
      path.join(root, "outside", "SKILL.md"),
      "private fixture"
    );
    vi.resetModules();
    const { LocalSkillsServer } = await import("./index.js");
    server = new LocalSkillsServer([skills]);
    mocks.validate.mockClear();
    mocks.evaluate.mockClear();
  });

  afterEach(async () => {
    await server?.close();
    for (const listener of process.listeners("SIGINT")) {
      if (!originalListeners.includes(listener))
        process.removeListener("SIGINT", listener);
    }
    await fs.rm(root, { recursive: true, force: true });
  });

  for (const tool of ["handleValidateSkill", "handleEvaluateSkill"] as const) {
    it.each([
      "../outside",
      "..\\outside",
      ".",
      "..",
      "bad\0name",
      "",
      42,
      null,
    ])(
      `${tool} rejects invalid skill name %j before invoking file processing`,
      async (skillName) => {
        await expect(
          (server as any)[tool]({ skill_name: skillName })
        ).rejects.toThrow();
        expect(mocks.validate).not.toHaveBeenCalled();
        expect(mocks.evaluate).not.toHaveBeenCalled();
        expect(
          await fs.readFile(path.join(root, "outside", "SKILL.md"), "utf8")
        ).toBe("private fixture");
      }
    );

    it(`${tool} rejects a symlinked skill directory`, async () => {
      await fs.symlink(
        path.join(root, "outside"),
        path.join(skills, "linked"),
        "dir"
      );
      await expect(
        (server as any)[tool]({ skill_name: "linked" })
      ).rejects.toThrow("not found");
      expect(mocks.validate).not.toHaveBeenCalled();
      expect(mocks.evaluate).not.toHaveBeenCalled();
    });
  }

  it("validates a registered skill on a cold registry without parsing it first", async () => {
    await (server as any).handleValidateSkill({ skill_name: "regular" });
    expect(mocks.validate).toHaveBeenCalledTimes(1);
    expect(mocks.validate).toHaveBeenCalledWith(
      path.join(skills, "regular", "SKILL.md")
    );
  });

  it("preserves every fork-specific evaluation control", async () => {
    const controls = {
      eval_set_path: path.join(root, "eval.json"),
      max_iterations: 3,
      num_workers: 2,
      runs_per_query: 4,
      timeout_seconds: 42,
      holdout: 0.3,
      trigger_threshold: 0.6,
      description_override: "fixture description",
      model: "fixture-model",
    };
    await (server as any).handleEvaluateSkill({
      skill_name: "regular",
      ...controls,
    });
    expect(mocks.evaluate).toHaveBeenCalledWith(
      {
        skill_name: "regular",
        skill_path: path.join(skills, "regular"),
        ...controls,
      },
      expect.any(String)
    );
  });

  it("keeps a symlinked SKILL.md inside a discovered real directory supported", async () => {
    const file = path.join(skills, "regular", "SKILL.md");
    await fs.unlink(file);
    await fs.symlink(path.join(root, "outside", "SKILL.md"), file);
    await (server as any).handleValidateSkill({ skill_name: "regular" });
    expect(mocks.validate).toHaveBeenCalledTimes(1);
    expect(mocks.validate).toHaveBeenCalledWith(file);
  });
});
