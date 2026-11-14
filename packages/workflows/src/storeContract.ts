import { contextForRole, FixedClock, NorthstarError, type TenantContext } from "@northstar/core";
import { z } from "zod";
import { WorkflowEngine } from "./engine";
import type { WorkflowStore } from "./types";

/**
 * Behavioral contract every WorkflowStore must satisfy, expressed as engine-level scenarios.
 * Test files call `defineWorkflowStoreContract` with their test framework primitives.
 */
export interface ContractHarness {
  describe: (name: string, fn: () => void) => void;
  it: (name: string, fn: () => Promise<void>) => void;
  // Matcher chains from the host test framework (Vitest/Jest) are intentionally untyped here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect: (v: unknown) => any;
  beforeEach: (fn: () => Promise<void> | void) => void;
}

export function defineWorkflowStoreContract(h: ContractHarness, makeStore: () => Promise<WorkflowStore>, orgs: { a: string; b: string }) {
  const { describe, it, expect, beforeEach } = h;
  let store: WorkflowStore;
  let clock: FixedClock;
  const ctxA: TenantContext = contextForRole(orgs.a, { type: "system", id: "test" }, "owner");
  const userA: TenantContext = contextForRole(orgs.a, { type: "user", id: "00000000-0000-0000-0000-0000000000aa" }, "manager");
  const userB: TenantContext = contextForRole(orgs.b, { type: "user", id: "00000000-0000-0000-0000-0000000000bb" }, "owner");

  const mkEngine = (workerId = "w1") => new WorkflowEngine({ store, clock, workerId, jitter: () => 1, leaseMs: 60_000 });

  beforeEach(async () => {
    store = await makeStore();
    clock = new FixedClock("2026-11-16T15:00:00Z");
  });

  describe("workflow store contract", () => {
    it("runs a workflow end to end and memoizes steps", async () => {
      let sideEffects = 0;
      const engine = mkEngine().register({
        id: "t.basic", version: 1, description: "basic", triggers: ["thing.created"], permissions: ["leads.read"],
        payloadSchema: z.object({ n: z.number() }),
        handler: async ({ event, step }) => {
          const doubled = await step.run("double", () => { sideEffects++; return event.payload.n * 2; });
          return { doubled };
        },
      });
      const { runs } = await engine.emit(ctxA, "thing.created", { n: 21 }, { idempotencyKey: "k1" });
      expect(runs).toHaveLength(1);
      const r = await engine.drain();
      expect(r.succeeded).toBe(1);
      const run = await store.getRun(orgs.a, runs[0]!.id);
      expect(run?.status).toBe("succeeded");
      expect(run?.output).toEqual({ doubled: 42 });
      expect(sideEffects).toBe(1);
      const logs = await store.listLogs(orgs.a, runs[0]!.id);
      expect(logs.map((l) => l.message)).toContain("Run succeeded");
    });

    it("is idempotent on event emission", async () => {
      const engine = mkEngine().register({ id: "t.idem", version: 1, description: "", triggers: ["x"], permissions: [], handler: async () => "ok" });
      const first = await engine.emit(ctxA, "x", {}, { idempotencyKey: "same" });
      const second = await engine.emit(ctxA, "x", { different: true }, { idempotencyKey: "same" });
      expect(second.inserted).toBe(false);
      expect(second.event.id).toBe(first.event.id);
      expect(second.runs[0]!.id).toBe(first.runs[0]!.id);
      // Same key in another tenant is independent.
      const other = await engine.emit({ ...ctxA, organizationId: orgs.b }, "x", {}, { idempotencyKey: "same" });
      expect(other.inserted).toBe(true);
    });

    it("retries with backoff, resumes after completed steps, then dead-letters", async () => {
      let stepOneCalls = 0;
      let failures = 0;
      const engine = mkEngine().register({
        id: "t.retry", version: 1, description: "", triggers: ["r"], permissions: [], maxAttempts: 3, retry: { baseDelayMs: 1000, maxDelayMs: 10_000 },
        handler: async ({ step }) => {
          await step.run("one", () => { stepOneCalls++; return 1; });
          await step.run("two", () => { failures++; throw new Error("provider timeout"); });
        },
      });
      const { runs } = await engine.emit(ctxA, "r", {}, { idempotencyKey: "r1" });
      const id = runs[0]!.id;
      expect((await engine.tick()).retried).toBe(1);
      let run = await store.getRun(orgs.a, id);
      expect(run?.status).toBe("queued");
      expect(run?.attempt).toBe(1);
      expect(run?.nextRunAt).toBe("2026-11-16T15:00:01.000Z");
      expect((await engine.tick()).claimed).toBe(0); // not yet due
      clock.advance(1000);
      expect((await engine.tick()).retried).toBe(1);
      run = await store.getRun(orgs.a, id);
      expect(run?.nextRunAt).toBe("2026-11-16T15:00:03.000Z"); // 2s backoff
      clock.advance(2000);
      expect((await engine.tick()).deadLettered).toBe(1);
      run = await store.getRun(orgs.a, id);
      expect(run?.status).toBe("dead_lettered");
      expect(run?.lastError?.stepName).toBe("two");
      expect(stepOneCalls).toBe(1);
      expect(failures).toBe(3);
      const dls = await store.listDeadLetters(orgs.a);
      expect(dls).toHaveLength(1);
      expect(dls[0]!.attempts).toBe(3);
    });

    it("dead-letters non-retryable errors immediately", async () => {
      const engine = mkEngine().register({
        id: "t.fatal", version: 1, description: "", triggers: ["f"], permissions: [],
        handler: async () => { throw new NorthstarError("VALIDATION_FAILED", "bad input"); },
      });
      await engine.emit(ctxA, "f", {}, { idempotencyKey: "f1" });
      expect((await engine.tick()).deadLettered).toBe(1);
    });

    it("rejects invalid payloads without retrying", async () => {
      const engine = mkEngine().register({ id: "t.schema", version: 1, description: "", triggers: ["s"], permissions: [], payloadSchema: z.object({ n: z.number() }), handler: async () => null });
      await engine.emit(ctxA, "s", { n: "nope" }, { idempotencyKey: "s1" });
      expect((await engine.tick()).deadLettered).toBe(1);
    });

    it("durably sleeps", async () => {
      const engine = mkEngine().register({
        id: "t.sleep", version: 1, description: "", triggers: ["z"], permissions: [],
        handler: async ({ step, now }) => {
          await step.sleepUntil("wait-a-day", new Date(Date.parse("2026-11-17T15:00:00Z")));
          return now().toISOString();
        },
      });
      const { runs } = await engine.emit(ctxA, "z", {}, { idempotencyKey: "z1" });
      expect((await engine.tick()).suspended).toBe(1);
      expect((await store.getRun(orgs.a, runs[0]!.id))?.status).toBe("sleeping");
      clock.advance(23 * 3600_000);
      expect((await engine.tick()).claimed).toBe(0);
      clock.advance(3600_000);
      expect((await engine.tick()).succeeded).toBe(1);
      expect((await store.getRun(orgs.a, runs[0]!.id))?.output).toBe("2026-11-17T15:00:00.000Z");
    });

    it("gates consequential actions behind human approval", async () => {
      let sent = 0;
      const engine = mkEngine().register({
        id: "t.approval", version: 1, description: "", triggers: ["offer.drafted"], permissions: ["leads.read"],
        handler: async ({ step }) => {
          const decision = await step.waitForApproval("approve-offer", { summary: "Send offer of $150,000", requiredPermission: "offers.approve", payload: { amount: 150000 } });
          await step.run("send", () => { sent++; return decision.decidedBy; });
          return "sent";
        },
      });
      const { runs } = await engine.emit(ctxA, "offer.drafted", {}, { idempotencyKey: "o1" });
      expect((await engine.tick()).suspended).toBe(1);
      const [approval] = await store.listApprovals(orgs.a, "pending");
      expect(approval?.summary).toBe("Send offer of $150,000");
      // Agents/system actors and users without permission cannot approve; other tenants cannot see it.
      await expect(engine.decideApproval(ctxA, approval!.id, "approved")).rejects.toThrow(/human user/);
      const acq = contextForRole(orgs.a, { type: "user", id: "00000000-0000-0000-0000-0000000000cc" }, "acquisitions");
      await expect(engine.decideApproval(acq, approval!.id, "approved")).rejects.toThrow(/offers.approve/);
      await expect(engine.decideApproval(userB, approval!.id, "approved")).rejects.toThrow(/not found/i);
      expect(sent).toBe(0);
      await engine.decideApproval(userA, approval!.id, "approved", "Comps support it");
      await expect(engine.decideApproval(userA, approval!.id, "rejected")).rejects.toThrow(/already been decided/);
      expect((await engine.tick()).succeeded).toBe(1);
      expect(sent).toBe(1);
      expect((await store.getRun(orgs.a, runs[0]!.id))?.status).toBe("succeeded");
    });

    it("cancels the run when approval is rejected", async () => {
      const engine = mkEngine().register({
        id: "t.reject", version: 1, description: "", triggers: ["o"], permissions: [],
        handler: async ({ step }) => { await step.waitForApproval("approve", { summary: "x", requiredPermission: "offers.approve" }); return "never"; },
      });
      const { runs } = await engine.emit(ctxA, "o", {}, { idempotencyKey: "o2" });
      await engine.tick();
      const [approval] = await store.listApprovals(orgs.a, "pending");
      await engine.decideApproval(userA, approval!.id, "rejected", "Price too high");
      expect((await engine.tick()).cancelled).toBe(1);
      const run = await store.getRun(orgs.a, runs[0]!.id);
      expect(run?.status).toBe("cancelled");
      expect(run?.output).toMatchObject({ rejected: true, reason: "Price too high" });
    });

    it("emits follow-on events exactly once and chains workflows", async () => {
      const engine = mkEngine()
        .register({ id: "t.parent", version: 1, description: "", triggers: ["p"], permissions: [], handler: async ({ step }) => { await step.emit("notify", "c", { from: "parent" }); } })
        .register({ id: "t.child", version: 1, description: "", triggers: ["c"], permissions: [], handler: async ({ event }) => event.payload });
      await engine.emit(ctxA, "p", {}, { idempotencyKey: "p1" });
      const r = await engine.drain();
      expect(r.succeeded).toBe(2);
      const child = (await store.listRuns(orgs.a, { workflowId: "t.child" }))[0];
      expect(child?.output).toEqual({ from: "parent" });
    });

    it("never executes a run twice under concurrent workers", async () => {
      let executions = 0;
      const def = { id: "t.concurrent", version: 1, description: "", triggers: ["k"], permissions: [] as const, handler: async () => { executions++; } };
      const w1 = mkEngine("w1").register({ ...def, permissions: [] });
      const w2 = mkEngine("w2").register({ ...def, permissions: [] });
      for (let i = 0; i < 20; i++) await w1.emit(ctxA, "k", { i }, { idempotencyKey: `k${i}` });
      const [a, b] = await Promise.all([w1.tick(20), w2.tick(20)]);
      expect(a.claimed + b.claimed).toBe(20);
      expect(executions).toBe(20);
    });

    it("reclaims runs whose lease expired (crashed worker)", async () => {
      const engine = mkEngine("survivor").register({ id: "t.lease", version: 1, description: "", triggers: ["l"], permissions: [], handler: async () => "done" });
      const { runs } = await engine.emit(ctxA, "l", {}, { idempotencyKey: "l1" });
      const claimed = await store.claimDueRuns({ now: clock.now(), limit: 1, workerId: "crashed", leaseMs: 60_000 });
      expect(claimed).toHaveLength(1);
      expect((await engine.tick()).claimed).toBe(0);
      clock.advance(61_000);
      expect((await engine.tick()).succeeded).toBe(1);
      // The crashed worker's late write is rejected because it no longer holds the lease.
      expect(await store.updateRun(orgs.a, runs[0]!.id, "crashed", { status: "dead_lettered" })).toBe(false);
      expect((await store.getRun(orgs.a, runs[0]!.id))?.status).toBe("succeeded");
    });

    it("isolates tenants on reads", async () => {
      const engine = mkEngine().register({ id: "t.iso", version: 1, description: "", triggers: ["i"], permissions: [], handler: async () => null });
      const { runs } = await engine.emit(ctxA, "i", {}, { idempotencyKey: "i1" });
      expect(await store.getRun(orgs.b, runs[0]!.id)).toBeNull();
      expect(await store.listRuns(orgs.b)).toHaveLength(0);
    });
  });
}
