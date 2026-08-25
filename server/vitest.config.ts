import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/helpers/setup-env.ts"],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    pool: "forks",
    fileParallelism: false,
  },
});
