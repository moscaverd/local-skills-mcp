import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // The e2e suite spawns the compiled server, so ensure dist/ is built and
    // current before any test runs.
    globalSetup: ["./vitest.global-setup.ts"],
    // Only the TypeScript sources are the suite. globalSetup compiles src/ into
    // dist/, test files included, so without this the compiled copies get
    // collected and every test runs twice.
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["**/node_modules/**", "dist/**"],
    testTimeout: 60000, // 60 seconds for e2e tests on slower CI environments
    hookTimeout: 60000, // 60 seconds for setup/teardown hooks on slower CI environments
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "node_modules/**",
        "dist/**",
        "**/types.ts", // Type definitions only, no runtime code
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 87, // Adjusted: main entry point tested via e2e, not unit tests
        statements: 95,
        perFile: false,
      },
    },
  },
});
