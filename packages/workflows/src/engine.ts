import { NorthstarError, authorize, isNorthstarError, isRetryable, newId, silentLogger, systemClock, type Clock, type Logger, type TenantContext } from "@northstar/core";
import { ApprovalRejectedError, SuspendSignal } from "./errors.js";
import type { DomainEvent, RetryPolicy, RunError, StepTools, WorkflowContext, WorkflowDefinition, WorkflowRun, WorkflowStore } from "./types.js";

export interface EngineOptions {
  store: WorkflowStore;
  clock?: Clock;
  logger?: Logger;
  workerId?: string;
  leaseMs?: number;
  /** Returns a multiplier in [0.8, 1.2] by default; inject `() => 1` for deterministic tests. */
  jitter?: () => number;
}

export interface EmitOptions {
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string;
}

export interface TickResult {
  claimed: number;
  succeeded: number;
  suspended: number;
  retried: number;
  deadLettered: number;
  cancelled: number;
}

const DEFAULT_RETRY: RetryPolicy = { baseDelayMs: 5_000, maxDelayMs: 15 * 60_000 };

export function backoffDelay(failedAttempts: number, policy: RetryPolicy, jitter: number): number {
  const exp = policy.baseDelayMs * 2 ** Math.max(0, failedAttempts - 1);
  return Math.round(Math.min(policy.maxDelayMs, exp) * jitter);
}

export class WorkflowEngine {
  readonly store: WorkflowStore;
  private readonly clock: Clock;
  private readonly logger: Logger;
  private readonly workerId: string;
  private readonly leaseMs: number;
  private readonly jitter: () => number;
  private readonly definitions = new Map<string, WorkflowDefinition<any>>();

  constructor(opts: EngineOptions) {
    this.store = opts.store;
    this.clock = opts.clock ?? systemClock;
    this.logger = opts.logger ?? silentLogger;
    this.workerId = opts.workerId ?? `worker-${newId().slice(0, 8)}`;
    this.leaseMs = opts.leaseMs ?? 5 * 60_000;
    this.jitter = opts.jitter ?? (() => 0.8 + Math.random() * 0.4);
  }

  register<P>(def: WorkflowDefinition<P>): this {
    if (this.definitions.has(def.id)) throw new Error(`Workflow ${def.id} already registered`);
    this.definitions.set(def.id, def);
    return this;
  }

  get registered(): WorkflowDefinition<any>[] {
    return [...this.definitions.values()];
  }

  /** Persist an event and create one run per subscribed workflow. Fully idempotent on `idempotencyKey`. */
  async emit(ctx: TenantContext, type: string, payload: unknown, opts: EmitOptions): Promise<{ event: DomainEvent; inserted: boolean; runs: WorkflowRun[] }> {
    const now = this.clock.now().toISOString();
    const { event, inserted } = await this.store.insertEvent({
      id: newId(), organizationId: ctx.organizationId, type, payload, idempotencyKey: opts.idempotencyKey, occurredAt: now, actor: ctx.actor,
      correlationId: opts.correlationId ?? null, causationId: opts.causationId ?? null,
    });
    const runs: WorkflowRun[] = [];
    for (const def of this.definitions.values()) {
      if (!def.triggers.includes(event.type)) continue;
      const { run } = await this.store.createRun({
        organizationId: event.organizationId, workflowId: def.id, workflowVersion: def.version, eventId: event.id,
        maxAttempts: def.maxAttempts ?? 5, nextRunAt: now,
      });
      runs.push(run);
    }
    return { event, inserted, runs };
  }

  /** Claim and execute due runs once. Safe to call concurrently from many workers. */
  async tick(limit = 10): Promise<TickResult> {
    const result: TickResult = { claimed: 0, succeeded: 0, suspended: 0, retried: 0, deadLettered: 0, cancelled: 0 };
    const runs = await this.store.claimDueRuns({ now: this.clock.now(), limit, workerId: this.workerId, leaseMs: this.leaseMs });
    result.claimed = runs.length;
    for (const run of runs) {
      const outcome = await this.execute(run);
      result[outcome]++;
    }
    return result;
  }

  /** Development/test helper: tick until nothing is immediately due. */
  async drain(maxTicks = 50): Promise<TickResult> {
    const total: TickResult = { claimed: 0, succeeded: 0, suspended: 0, retried: 0, deadLettered: 0, cancelled: 0 };
    for (let i = 0; i < maxTicks; i++) {
      const r = await this.tick(25);
      for (const k of Object.keys(total) as (keyof TickResult)[]) total[k] += r[k];
      if (r.claimed === 0) break;
    }
    return total;
  }

  async decideApproval(ctx: TenantContext, approvalId: string, decision: "approved" | "rejected", reason: string | null = null) {
    const approval = await this.store.getApproval(ctx.organizationId, approvalId);
    if (!approval) throw new NorthstarError("NOT_FOUND", "Approval not found");
    authorize(ctx, approval.requiredPermission);
    if (ctx.actor.type !== "user") throw new NorthstarError("FORBIDDEN", "Approvals must be decided by a human user");
    const now = this.clock.now().toISOString();
    const decided = await this.store.decideApproval(ctx.organizationId, approvalId, { status: decision, decidedBy: ctx.actor.id, reason, at: now });
    if (!decided) throw new NorthstarError("CONFLICT", "Approval has already been decided");
    await this.store.appendAudit({ organizationId: ctx.organizationId, actorType: ctx.actor.type, actorId: ctx.actor.id, action: `approval.${decision}`, targetType: "approval", targetId: approvalId, data: { runId: approval.runId, stepName: approval.stepName, summary: approval.summary, reason }, at: now });
    await this.store.updateRun(ctx.organizationId, approval.runId, null, { status: "queued", nextRunAt: now, lockedBy: null, lockedUntil: null, updatedAt: now });
    return decided;
  }

  private async execute(run: WorkflowRun): Promise<keyof Omit<TickResult, "claimed">> {
    const def = this.definitions.get(run.workflowId);
    const log = this.logger.child({ runId: run.id, workflowId: run.workflowId, organizationId: run.organizationId });
    const appendLog = (level: "info" | "warn" | "error", message: string, extra: { stepName?: string; data?: Record<string, unknown> } = {}) =>
      this.store.appendLog({ organizationId: run.organizationId, runId: run.id, level, message, at: this.clock.now().toISOString(), ...extra });

    if (!def) {
      return this.failRun(run, { message: `No workflow registered with id ${run.workflowId}`, retryable: false, code: "INTERNAL" }, appendLog);
    }
    const event = await this.store.getEvent(run.organizationId, run.eventId);
    if (!event) return this.failRun(run, { message: "Triggering event not found", retryable: false, code: "NOT_FOUND" }, appendLog);

    const tenant: TenantContext = {
      organizationId: run.organizationId,
      actor: { type: "system", id: `workflow:${def.id}`, display: def.description },
      permissions: new Set(def.permissions),
      requestId: run.id,
    };
    const step = this.stepTools(run, tenant, appendLog);
    await appendLog("info", run.attempt > 0 ? `Run resumed (after ${run.attempt} failed attempt(s))` : "Run started");

    try {
      let payload = event.payload;
      if (def.payloadSchema) {
        const parsed = def.payloadSchema.safeParse(payload);
        if (!parsed.success) throw new NorthstarError("VALIDATION_FAILED", `Invalid payload for ${def.id}: ${parsed.error.message}`);
        payload = parsed.data;
      }
      const ctx: WorkflowContext = { event: { ...event, payload }, run, tenant, step, logger: log, now: () => this.clock.now() };
      const output = await def.handler(ctx);
      const now = this.clock.now().toISOString();
      const ok = await this.store.updateRun(run.organizationId, run.id, this.workerId, { status: "succeeded", output: output ?? null, lastError: null, lockedBy: null, lockedUntil: null, finishedAt: now, updatedAt: now });
      if (!ok) log.warn("Lease lost before completion; another worker will reconcile");
      await appendLog("info", "Run succeeded");
      return "succeeded";
    } catch (e) {
      const now = this.clock.now();
      if (e instanceof SuspendSignal) {
        const patch = e.kind === "sleep"
          ? { status: "sleeping" as const, nextRunAt: (e.until as Date).toISOString() }
          : { status: "awaiting_approval" as const, nextRunAt: new Date(now.getTime() + 365 * 86_400_000).toISOString() };
        await this.store.updateRun(run.organizationId, run.id, this.workerId, { ...patch, lockedBy: null, lockedUntil: null, updatedAt: now.toISOString() });
        await appendLog("info", e.kind === "sleep" ? `Sleeping until ${patch.nextRunAt}` : "Awaiting human approval", { stepName: e.stepName });
        return "suspended";
      }
      if (e instanceof ApprovalRejectedError) {
        await this.store.updateRun(run.organizationId, run.id, this.workerId, { status: "cancelled", output: { rejected: true, stepName: e.stepName, decidedBy: e.decidedBy, reason: e.reason }, lockedBy: null, lockedUntil: null, finishedAt: now.toISOString(), updatedAt: now.toISOString() });
        await appendLog("warn", `Cancelled: approval rejected at ${e.stepName}`, { stepName: e.stepName });
        return "cancelled";
      }
      const err = e as Error & { stepName?: string };
      const runError: RunError = {
        message: err?.message ?? String(e),
        code: isNorthstarError(e) ? e.code : undefined,
        retryable: isRetryable(e),
        stepName: err?.stepName,
      };
      return this.failRun(run, runError, appendLog, def.retry);
    }
  }

  private async failRun(run: WorkflowRun, error: RunError, appendLog: (l: "info" | "warn" | "error", m: string, x?: { stepName?: string; data?: Record<string, unknown> }) => Promise<void>, policy: RetryPolicy = DEFAULT_RETRY): Promise<"retried" | "deadLettered"> {
    const now = this.clock.now();
    const attempt = run.attempt + 1;
    if (error.retryable && attempt < run.maxAttempts) {
      const delay = backoffDelay(attempt, policy, this.jitter());
      const nextRunAt = new Date(now.getTime() + delay).toISOString();
      await this.store.updateRun(run.organizationId, run.id, this.workerId, { status: "queued", attempt, lastError: error, nextRunAt, lockedBy: null, lockedUntil: null, updatedAt: now.toISOString() });
      await appendLog("warn", `Attempt ${attempt} failed; retrying at ${nextRunAt}: ${error.message}`, { stepName: error.stepName });
      return "retried";
    }
    await this.store.updateRun(run.organizationId, run.id, this.workerId, { status: "dead_lettered", attempt, lastError: error, lockedBy: null, lockedUntil: null, finishedAt: now.toISOString(), updatedAt: now.toISOString() });
    await this.store.insertDeadLetter({ id: newId(), organizationId: run.organizationId, runId: run.id, workflowId: run.workflowId, eventId: run.eventId, error, attempts: attempt, createdAt: now.toISOString() });
    await appendLog("error", `Dead-lettered after ${attempt} attempt(s): ${error.message}`, { stepName: error.stepName, data: { retryable: error.retryable, code: error.code } });
    return "deadLettered";
  }

  private stepTools(run: WorkflowRun, tenant: TenantContext, appendLog: (l: "info" | "warn" | "error", m: string, x?: { stepName?: string }) => Promise<void>): StepTools {
    const seen = new Set<string>();
    const guard = (name: string) => {
      if (seen.has(name)) throw new NorthstarError("INTERNAL", `Duplicate step name "${name}" in workflow ${run.workflowId}`, { retryable: false });
      seen.add(name);
    };
    const memo = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
      const existing = await this.store.getStep(run.organizationId, run.id, name);
      if (existing) return existing.output as T;
      let output: T;
      try {
        output = await fn();
      } catch (e) {
        if (e instanceof Error && !(e instanceof SuspendSignal) && !(e instanceof ApprovalRejectedError)) (e as Error & { stepName?: string }).stepName ??= name;
        throw e;
      }
      await this.store.saveStep({ runId: run.id, organizationId: run.organizationId, name, output: output === undefined ? null : output, completedAt: this.clock.now().toISOString() });
      await appendLog("info", "Step completed", { stepName: name });
      return output;
    };
    return {
      run: (name, fn) => {
        guard(name);
        return memo(name, async () => fn());
      },
      sleepUntil: async (name, at) => {
        guard(name);
        await memo(name, async () => {
          if (this.clock.now().getTime() < at.getTime()) throw new SuspendSignal("sleep", at, name);
          return { wokeAt: this.clock.now().toISOString() };
        });
      },
      waitForApproval: async (name, req) => {
        guard(name);
        return memo(name, async () => {
          const approval =
            (await this.store.getApprovalForStep(run.organizationId, run.id, name)) ??
            (await this.store.createApproval({
              id: newId(), organizationId: run.organizationId, runId: run.id, stepName: name, summary: req.summary, requiredPermission: req.requiredPermission,
              payload: req.payload ?? null, status: "pending", decidedBy: null, decidedAt: null, reason: null, createdAt: this.clock.now().toISOString(),
            }));
          if (approval.status === "pending") throw new SuspendSignal("approval", null, name);
          if (approval.status === "rejected") throw new ApprovalRejectedError(name, approval.decidedBy ?? "unknown", approval.reason);
          return { decidedBy: approval.decidedBy as string, reason: approval.reason };
        });
      },
      emit: async (name, type, payload) => {
        guard(name);
        await memo(name, async () => {
          const { event } = await this.emit(tenant, type, payload, { idempotencyKey: `${run.id}:${name}`, causationId: run.eventId });
          return { eventId: event.id };
        });
      },
      idempotencyKey: (name) => `${run.organizationId}:${run.id}:${name}`,
    };
  }
}
