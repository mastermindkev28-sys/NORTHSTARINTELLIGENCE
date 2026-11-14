import { newId } from "@northstar/core";
import type { ApprovalRequest, ApprovalStatus, AuditEntry, DeadLetter, DomainEvent, ExecutionLog, NewRun, RunStatus, StepRecord, WorkflowRun, WorkflowStore } from "./types";

/** In-process store for tests, local development, and the demo workspace. Not durable. */
export class InMemoryWorkflowStore implements WorkflowStore {
  readonly events = new Map<string, DomainEvent>();
  readonly runs = new Map<string, WorkflowRun>();
  readonly steps = new Map<string, StepRecord>();
  readonly deadLetters: DeadLetter[] = [];
  readonly approvals = new Map<string, ApprovalRequest>();
  readonly logs: ExecutionLog[] = [];
  readonly audit: AuditEntry[] = [];

  async insertEvent(event: DomainEvent) {
    const existing = [...this.events.values()].find((e) => e.organizationId === event.organizationId && e.idempotencyKey === event.idempotencyKey);
    if (existing) return { event: existing, inserted: false };
    this.events.set(event.id, structuredClone(event));
    return { event, inserted: true };
  }

  async getEvent(organizationId: string, eventId: string) {
    const e = this.events.get(eventId);
    return e && e.organizationId === organizationId ? structuredClone(e) : null;
  }

  async createRun(r: NewRun) {
    const existing = [...this.runs.values()].find((x) => x.workflowId === r.workflowId && x.eventId === r.eventId);
    if (existing) return { run: structuredClone(existing), inserted: false };
    const run: WorkflowRun = { id: newId(), ...r, status: "queued", attempt: 0, lockedBy: null, lockedUntil: null, lastError: null, output: null, createdAt: r.nextRunAt, updatedAt: r.nextRunAt, finishedAt: null };
    this.runs.set(run.id, run);
    return { run: structuredClone(run), inserted: true };
  }

  async claimDueRuns({ now, limit, workerId, leaseMs }: { now: Date; limit: number; workerId: string; leaseMs: number }) {
    const t = now.getTime();
    const due = [...this.runs.values()]
      .filter((r) => ((r.status === "queued" || r.status === "sleeping") && Date.parse(r.nextRunAt) <= t) || (r.status === "running" && r.lockedUntil !== null && Date.parse(r.lockedUntil) < t))
      .sort((a, b) => Date.parse(a.nextRunAt) - Date.parse(b.nextRunAt))
      .slice(0, limit);
    for (const r of due) {
      r.status = "running";
      r.lockedBy = workerId;
      r.lockedUntil = new Date(t + leaseMs).toISOString();
      r.updatedAt = now.toISOString();
    }
    return due.map((r) => structuredClone(r));
  }

  async getRun(organizationId: string, runId: string) {
    const r = this.runs.get(runId);
    return r && r.organizationId === organizationId ? structuredClone(r) : null;
  }

  async updateRun(organizationId: string, runId: string, workerId: string | null, patch: Partial<WorkflowRun>) {
    const r = this.runs.get(runId);
    if (!r || r.organizationId !== organizationId) return false;
    if (workerId !== null && r.lockedBy !== workerId) return false;
    Object.assign(r, structuredClone(patch));
    return true;
  }

  async listRuns(organizationId: string, filter: { status?: RunStatus; workflowId?: string; limit?: number } = {}) {
    return [...this.runs.values()]
      .filter((r) => r.organizationId === organizationId && (!filter.status || r.status === filter.status) && (!filter.workflowId || r.workflowId === filter.workflowId))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, filter.limit ?? 100)
      .map((r) => structuredClone(r));
  }

  async getStep(organizationId: string, runId: string, name: string) {
    const s = this.steps.get(`${runId}:${name}`);
    return s && s.organizationId === organizationId ? structuredClone(s) : null;
  }

  async saveStep(record: StepRecord) {
    const key = `${record.runId}:${record.name}`;
    if (!this.steps.has(key)) this.steps.set(key, structuredClone(record));
  }

  async insertDeadLetter(dl: DeadLetter) {
    this.deadLetters.push(structuredClone(dl));
  }

  async listDeadLetters(organizationId: string) {
    return this.deadLetters.filter((d) => d.organizationId === organizationId).map((d) => structuredClone(d));
  }

  async createApproval(a: ApprovalRequest) {
    const existing = [...this.approvals.values()].find((x) => x.runId === a.runId && x.stepName === a.stepName);
    if (existing) return structuredClone(existing);
    this.approvals.set(a.id, structuredClone(a));
    return a;
  }

  async getApprovalForStep(organizationId: string, runId: string, stepName: string) {
    const a = [...this.approvals.values()].find((x) => x.organizationId === organizationId && x.runId === runId && x.stepName === stepName);
    return a ? structuredClone(a) : null;
  }

  async getApproval(organizationId: string, approvalId: string) {
    const a = this.approvals.get(approvalId);
    return a && a.organizationId === organizationId ? structuredClone(a) : null;
  }

  async decideApproval(organizationId: string, approvalId: string, d: { status: "approved" | "rejected"; decidedBy: string; reason: string | null; at: string }) {
    const a = this.approvals.get(approvalId);
    if (!a || a.organizationId !== organizationId || a.status !== "pending") return null;
    a.status = d.status;
    a.decidedBy = d.decidedBy;
    a.reason = d.reason;
    a.decidedAt = d.at;
    return structuredClone(a);
  }

  async listApprovals(organizationId: string, status?: ApprovalStatus) {
    return [...this.approvals.values()].filter((a) => a.organizationId === organizationId && (!status || a.status === status)).map((a) => structuredClone(a));
  }

  async appendLog(log: ExecutionLog) {
    this.logs.push(structuredClone(log));
  }

  async listLogs(organizationId: string, runId: string) {
    return this.logs.filter((l) => l.organizationId === organizationId && l.runId === runId);
  }

  async appendAudit(entry: AuditEntry) {
    this.audit.push(structuredClone(entry));
  }
}
