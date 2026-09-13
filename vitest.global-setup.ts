import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(projectRoot, "src");
const distEntry = path.join(projectRoot, "dist", "index.js");
const tscBin = path.join(
  projectRoot,
  "node_modules",
  "typescript",
  "bin",
  "tsc"
);

/**
 * Most recent modification time under a directory, in milliseconds.
 */
function newestMtimeMs(dir: string): number {
  let newest = 0;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    const mtime = entry.isDirectory()
      ? newestMtimeMs(entryPath)
      : fs.statSync(entryPath).mtimeMs;

    if (mtime > newest) {
      newest = mtime;
    }
  }

  return newest;
}

/**
 * Build the project when `dist/` is missing or older than `src/`.
 *
 * The e2e suite spawns `dist/index.js` as a real subprocess, so the compiled
 * output is a test prerequisite. Building here keeps every entry point
 * (`npm test`, `test:run`, `test:e2e`, `test:coverage`) working on a fresh
 * clone instead of failing with an opaque "Server exited with code 1".
 */
export default function setup(): void {
  const distExists = fs.existsSync(distEntry);
  const isStale =
    distExists && newestMtimeMs(srcDir) > fs.statSync(distEntry).mtimeMs;

  if (distExists && !isStale) {
    return;
  }

  console.log(
    distExists
      ? "[vitest] dist/ is older than src/ — rebuilding before tests..."
      : "[vitest] dist/ not found — building before tests..."
  );

  execFileSync(process.execPath, [tscBin], {
    cwd: projectRoot,
    stdio: "inherit",
  });
}
