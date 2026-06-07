import { beforeAll, afterAll, vi } from "vitest";

beforeAll(() => {
  vi.stubGlobal("console", {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});