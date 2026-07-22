import { describe, it, expect, afterEach } from "vitest";
import { isLlmConfigured } from "./config";

describe("isLlmConfigured", () => {
  const original = process.env.LLM_API_KEY;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.LLM_API_KEY;
    } else {
      process.env.LLM_API_KEY = original;
    }
  });

  it("false when missing", () => {
    delete process.env.LLM_API_KEY;
    expect(isLlmConfigured()).toBe(false);
  });

  it("false when blank", () => {
    process.env.LLM_API_KEY = "   ";
    expect(isLlmConfigured()).toBe(false);
  });

  it("true when non-empty", () => {
    process.env.LLM_API_KEY = "sk-test";
    expect(isLlmConfigured()).toBe(true);
  });
});
