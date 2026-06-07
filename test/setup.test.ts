import { describe, it, expect } from "vitest";

describe("Vitest + miniflare test environment", () => {
  it("vitest discovers and runs tests", () => {
    expect(true).toBe(true);
  });

  it("vitest config has workers pool configured", async () => {
    const config = await import("../vitest.config.ts");
    expect(config.default).toBeDefined();
    expect(config.default.test?.pool).toBe("workers");
  });

  it("setup files are configured", async () => {
    const config = await import("../vitest.config.ts");
    expect(config.default.test?.setupFiles).toContain("./test/setup.ts");
  });

  it("globals is enabled", async () => {
    const config = await import("../vitest.config.ts");
    expect(config.default.test?.globals).toBe(true);
  });

  it("include pattern is set", async () => {
    const config = await import("../vitest.config.ts");
    expect(config.default.test?.include).toContain("test/**/*.test.ts");
  });
});