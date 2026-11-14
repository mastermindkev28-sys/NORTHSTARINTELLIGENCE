import type { Actor, Logger, Permission, TenantContext } from "@northstar/core";
import type { z } from "zod";

export type RunStatus =
  | "queued"
  | "running"
  | "sleeping"
  | "awaiting_approval"
  | "succeeded"
  | "cancelled"
  | "dead_lettered";
export const TERMINAL_STATUSES: readonly RunStatus[] = ["succeeded", "cancelled", "dead_lettered"];

export interface DomainEvent<P = unknown> {
  id: string;
  organizationId: string;
  type: string;
  payload: P;
  /** Unique per organization. Re-emitting with the same key is a no-op that returns the original event. */
  idempotencyKey: string;
  occurredAt: string;
  actor: Actor;
  correlationId?: string | null;
  causationId?: string | null;
}

export interface RunError {
  message: string;
  code?: string;
  retryable: boolean;
  stepName?: string;
}

export interface WorkflowRun {
  id: string;
  organizationId: string;
  workflowId: string;
  workflowVersion: number;
  eventId: string;
  status: RunStatus;
  /** Number of failed executions so far. */
  attempt: number;
  maxAttempts: number;
  nextRunAt: string;
  lockedBy: string | null;
  lockedUntil: string | null;
  lastError: RunError | null;
  output: unknown;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface StepRecord {
  runId: string;
  organizationId: string;
  name: string;
  output: unknown;
  completedAt: string;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalRequest {
  id: string;
  organizationId: string;
  runId: string;
  stepName: string;
  summary: string;
  requiredPermission: Permission;
  payload: unknown;
  status: ApprovalStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  reason: string | null;
  createdAt: string;
}

export interface DeadLetter {
  id: string;
  organizationId: string;
  runId: string;
  workflowId: string;
  eventId: string;
  error: RunError;
  attempts: number;
  createdAt: string;
}

export interface ExecutionLog {
  organizationId: string;
  runId: string;
  level: "info" | "warn" | "error";
  message: string;
  stepName?: string;
  data?: Record<string, unknown>;
  at: string;
}

export interface AuditEntry {
  organizationId: string;
  actorType: Actor["type"];
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  data?: Record<string, unknown>;
  at: string;
}

export interface NewRun {
  organizationId: string;
  workflowId: string;
  workflowVersion: number;
  eventId: string;
  maxAttempts: number;
  nextRunAt: string;
}

export interface WorkflowStore {
  insertEvent(event: DomainEvent): Promise<{ event: DomainEvent; inserted: boolean }>;
  getEvent(organizationId: string, eventId: string): Promise<DomainEvent | null>;
  /** Idempotent on (workflowId, eventId). */
  createRun(run: NewRun): Promise<{ run: WorkflowRun; inserted: boolean }>;
  /** Atomically lease due runs across all tenants (worker-only operation). */
  claimDueRuns(params: {
    now: Date;
    limit: number;
    workerId: string;
    leaseMs: number;
  }): Promise<WorkflowRun[]>;
  getRun(organizationId: string, runId: string): Promise<WorkflowRun | null>;
  /** Update a run the caller holds the lease for. Returns false if the lease was lost. */
  updateRun(
    organizationId: string,
    runId: string,
    workerId: string | null,
    patch: Partial<Omit<WorkflowRun, "id" | "organizationId">>,
  ): Promise<boolean>;
  listRuns(
    organizationId: string,
    filter?: { status?: RunStatus; workflowId?: string; limit?: number },
  ): Promise<WorkflowRun[]>;
  getStep(organizationId: string, runId: string, name: string): Promise<StepRecord | null>;
  saveStep(record: StepRecord): Promise<void>;
  insertDeadLetter(dl: DeadLetter): Promise<void>;
  listDeadLetters(organizationId: string): Promise<DeadLetter[]>;
  /** Idempotent on (runId, stepName). */
  createApproval(a: ApprovalRequest): Promise<ApprovalRequest>;
  getApprovalForStep(
    organizationId: string,
    runId: string,
    stepName: string,
  ): Promise<ApprovalRequest | null>;
  getApproval(organizationId: string, approvalId: string): Promise<ApprovalRequest | null>;
  /** Only transitions pending → approved/rejected. Returns null if already decided. */
  decideApproval(
    organizationId: string,
    approvalId: string,
    decision: {
      status: "approved" | "rejected";
      decidedBy: string;
      reason: string | null;
      at: string;
    },
  ): Promise<ApprovalRequest | null>;
  listApprovals(organizationId: string, status?: ApprovalStatus): Promise<ApprovalRequest[]>;
  appendLog(log: ExecutionLog): Promise<void>;
  listLogs(organizationId: string, runId: string): Promise<ExecutionLog[]>;
  appendAudit(entry: AuditEntry): Promise<void>;
}

export interface StepTools {
  /** Execute once; on replay the memoized output is returned without re-running `fn`. */
  run<T>(name: string, fn: () => Promise<T> | T): Promise<T>;
  /** Durable sleep: suspends the run until `at`. */
  sleepUntil(name: string, at: Date): Promise<void>;
  /** Suspends until a human with `requiredPermission` approves. Throws ApprovalRejectedError if rejected. */
  waitForApproval(
    name: string,
    req: { summary: string; requiredPermission: Permission; payload?: unknown },
  ): Promise<{ decidedBy: string; reason: string | null }>;
  /** Emit a follow-on event exactly once for this run + step. */
  emit(name: string, type: string, payload: unknown): Promise<void>;
  /** Stable key for idempotent external side effects (e.g., message send) in this step. */
  idempotencyKey(name: string): string;
}

export interface WorkflowContext<P = unknown> {
  event: DomainEvent<P>;
  run: WorkflowRun;
  tenant: TenantContext;
  step: StepTools;
  logger: Logger;
  now(): Date;
}

export interface RetryPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface WorkflowDefinition<P = unknown> {
  id: string;
  version: number;
  description: string;
  triggers: readonly string[];
  /** Least-privilege grant for the workflow's tenant context. */
  permissions: readonly Permission[];
  maxAttempts?: number;
  retry?: RetryPolicy;
  payloadSchema?: z.ZodType<P>;
  handler(ctx: WorkflowContext<P>): Promise<unknown>;
}

/**
 * Heterogeneous collection type for registered workflows. Payload types differ per workflow and are validated at
 * runtime by `payloadSchema`, so the registry must erase them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyWorkflowDefinition = WorkflowDefinition<any>;
