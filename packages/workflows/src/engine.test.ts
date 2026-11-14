import { beforeEach, describe, expect, it } from "vitest";
import { backoffDelay } from "./engine.js";
import { InMemoryWorkflowStore } from "./memoryStore.js";
import { defineWorkflowStoreContract } from "./storeContract.js";

describe("backoffDelay", () => {
  it("grows exponentially and caps", () => {
    const p = { baseDelayMs: 1000, maxDelayMs: 8000 };
    expect([1, 2, 3, 4, 5].map((n) => backoffDelay(n, p, 1))).toEqual([1000, 2000, 4000, 8000, 8000]);
    expect(backoffDelay(1, p, 1.2)).toBe(1200);
  });
});

describe("InMemoryWorkflowStore", () => {
  defineWorkflowStoreContract({ describe, it, expect, beforeEach }, async () => new InMemoryWorkflowStore(), {
    a: "11111111-1111-4111-8111-111111111111",
    b: "22222222-2222-4222-8222-222222222222",
  });
});
