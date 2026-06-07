import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "workers",
    include: ["test/**/*.test.ts"],
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
});