import type pg from "pg";
import type {
  ApprovalRequest, ApprovalStatus, AuditEntry, DeadLetter, DomainEvent, ExecutionLog, NewRun, RunStatus, StepRecord, WorkflowRun, WorkflowStore,
} from "@northstar/workflows";
import { withTenant, withoutTenant } from "./tenant.js";

const iso = (v: Date | string | null): string | null => (v === null ? null : new Date(v).toISOString());

function toRun(r: Record<string, any>): WorkflowRun {
  return {
    id: r.id, organizationId: r.organization_id, workflowId: r.workflow_id, workflowVersion: r.workflow_version, eventId: r.event_id,
    status: r.status, attempt: r.attempt, maxAttempts: r.max_attempts, nextRunAt: iso(r.next_run_at) as string, lockedBy: r.locked_by,
    lockedUntil: iso(r.locked_until), lastError: r.last_error, output: r.output, createdAt: iso(r.created_at) as string,
    updatedAt: iso(r.updated_at) as string, finishedAt: iso(r.finished_at),
  };
}

function toEvent(r: Record<string, any>): DomainEvent {
  return {
    id: r.id, organizationId: r.organization_id, type: r.type, payload: r.payload, idempotencyKey: r.idempotency_key, occurredAt: iso(r.occurred_at) as string,
    actor: { type: r.actor_type, id: r.actor_id, ...(r.actor_display ? { display: r.actor_display } : {}) }, correlationId: r.correlation_id, causationId: r.causation_id,
  };
}

function toApproval(r: Record<string, any>): ApprovalRequest {
  return {
    id: r.id, organizationId: r.organization_id, runId: r.run_id, stepName: r.step_name, summary: r.summary, requiredPermission: r.required_permission,
    payload: r.payload, status: r.status, decidedBy: r.decided_by, decidedAt: iso(r.decided_at), reason: r.reason, createdAt: iso(r.created_at) as string,
  };
}

const RUN_COLUMNS: Record<string, string> = {
  status: "status", attempt: "attempt", maxAttempts: "max_attempts", nextRunAt: "next_run_at", lockedBy: "locked_by", lockedUntil: "locked_until",
  lastError: "last_error", output: "output", updatedAt: "updated_at", finishedAt: "finished_at", workflowVersion: "workflow_version",
};
const JSON_COLUMNS = new Set(["last_error", "output"]);

/** Postgres-backed WorkflowStore. All tenant reads/writes go through RLS via `withTenant`. */
export class PostgresWorkflowStore implements WorkflowStore {
  constructor(private readonly pool: pg.Pool) {}

  async insertEvent(e: DomainEvent) {
    return withTenant(this.pool, e.organizationId, async (c) => {
      const ins = await c.query(
        `INSERT INTO events (id, organization_id, type, payload, idempotency_key, occurred_at, actor_type, actor_id, actor_display, correlation_id, causation_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (organization_id, idempotency_key) DO NOTHING RETURNING *`,
        [e.id, e.organizationId, e.type, JSON.stringify(e.payload ?? null), e.idempotencyKey, e.occurredAt, e.actor.type, e.actor.id, e.actor.display ?? null, e.correlationId ?? null, e.causationId ?? null],
      );
      if (ins.rows[0]) return { event: toEvent(ins.rows[0]), inserted: true };
      const existing = await c.query("SELECT * FROM events WHERE organization_id = $1 AND idempotency_key = $2", [e.organizationId, e.idempotencyKey]);
      return { event: toEvent(existing.rows[0]), inserted: false };
    });
  }

  async getEvent(organizationId: string, eventId: string) {
    return withTenant(this.pool, organizationId, async (c) => {
      const r = await c.query("SELECT * FROM events WHERE id = $1", [eventId]);
      return r.rows[0] ? toEvent(r.rows[0]) : null;
    });
  }

  async createRun(n: NewRun) {
    return withTenant(this.pool, n.organizationId, async (c) => {
      const ins = await c.query(
        `INSERT INTO workflow_runs (organization_id, workflow_id, workflow_version, event_id, status, max_attempts, next_run_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'queued',$5,$6,$6,$6) ON CONFLICT (workflow_id, event_id) DO NOTHING RETURNING *`,
        [n.organizationId, n.workflowId, n.workflowVersion, n.eventId, n.maxAttempts, n.nextRunAt],
      );
      if (ins.rows[0]) return { run: toRun(ins.rows[0]), inserted: true };
      const existing = await c.query("SELECT * FROM workflow_runs WHERE workflow_id = $1 AND event_id = $2", [n.workflowId, n.eventId]);
      return { run: toRun(existing.rows[0]), inserted: false };
    });
  }

  async claimDueRuns({ now, limit, workerId, leaseMs }: { now: Date; limit: number; workerId: string; leaseMs: number }) {
    return withoutTenant(this.pool, async (c) => {
      const r = await c.query("SELECT * FROM app.claim_due_runs($1, $2, $3, $4)", [workerId, leaseMs, limit, now.toISOString()]);
      return r.rows.map(toRun);
    });
  }

  async getRun(organizationId: string, runId: string) {
    return withTenant(this.pool, organizationId, async (c) => {
      const r = await c.query("SELECT * FROM workflow_runs WHERE id = $1", [runId]);
      return r.rows[0] ? toRun(r.rows[0]) : null;
    });
  }

  async updateRun(organizationId: string, runId: string, workerId: string | null, patch: Partial<WorkflowRun>) {
    const sets: string[] = [];
    const values: unknown[] = [runId];
    for (const [key, value] of Object.entries(patch)) {
      const col = RUN_COLUMNS[key];
      if (!col) continue;
      values.push(JSON_COLUMNS.has(col) ? (value === undefined ? null : JSON.stringify(value)) : value);
      sets.push(`${col} = $${values.length}`);
    }
    if (sets.length === 0) return true;
    let where = "id = $1";
    if (workerId !== null) {
      values.push(workerId);
      where += ` AND locked_by = $${values.length}`;
    }
    return withTenant(this.pool, organizationId, async (c) => {
      const r = await c.query(`UPDATE workflow_runs SET ${sets.join(", ")} WHERE ${where} RETURNING id`, values);
      return (r.rowCount ?? 0) > 0;
    });
  }

  async listRuns(organizationId: string, filter: { status?: RunStatus; workflowId?: string; limit?: number } = {}) {
    return withTenant(this.pool, organizationId, async (c) => {
      const r = await c.query(
        `SELECT * FROM workflow_runs WHERE ($1::text IS NULL OR status = $1) AND ($2::text IS NULL OR workflow_id = $2) ORDER BY created_at DESC LIMIT $3`,
        [filter.status ?? null, filter.workflowId ?? null, filter.limit ?? 100],
      );
      return r.rows.map(toRun);
    });
  }

  async getStep(organizationId: string, runId: string, name: string) {
    return withTenant(this.pool, organizationId, async (c) => {
      const r = await c.query("SELECT * FROM workflow_steps WHERE run_id = $1 AND name = $2", [runId, name]);
      const row = r.rows[0];
      return row ? { runId: row.run_id, organizationId: row.organization_id, name: row.name, output: row.output, completedAt: iso(row.completed_at) as string } : null;
    });
  }

  async saveStep(s: StepRecord) {
    await withTenant(this.pool, s.organizationId, (c) =>
      c.query("INSERT INTO workflow_steps (run_id, organization_id, name, output, completed_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING", [s.runId, s.organizationId, s.name, JSON.stringify(s.output ?? null), s.completedAt]),
    );
  }

  async insertDeadLetter(d: DeadLetter) {
    await withTenant(this.pool, d.organizationId, (c) =>
      c.query("INSERT INTO dead_letters (id, organization_id, run_id, workflow_id, event_id, error, attempts, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [d.id, d.organizationId, d.runId, d.workflowId, d.eventId, JSON.stringify(d.error), d.attempts, d.createdAt]),
    );
  }

  async listDeadLetters(organizationId: string) {
    return withTenant(this.pool, organizationId, async (c) => {
      const r = await c.query("SELECT * FROM dead_letters ORDER BY created_at DESC");
      return r.rows.map((x) => ({ id: x.id, organizationId: x.organization_id, runId: x.run_id, workflowId: x.workflow_id, eventId: x.event_id, error: x.error, attempts: x.attempts, createdAt: iso(x.created_at) as string }));
    });
  }

  async createApproval(a: ApprovalRequest) {
    return withTenant(this.pool, a.organizationId, async (c) => {
      const ins = await c.query(
        `INSERT INTO approvals (id, organization_id, run_id, step_name, summary, required_permission, payload, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (run_id, step_name) DO NOTHING RETURNING *`,
        [a.id, a.organizationId, a.runId, a.stepName, a.summary, a.requiredPermission, JSON.stringify(a.payload ?? null), a.status, a.createdAt],
      );
      if (ins.rows[0]) return toApproval(ins.rows[0]);
      const r = await c.query("SELECT * FROM approvals WHERE run_id = $1 AND step_name = $2", [a.runId, a.stepName]);
      return toApproval(r.rows[0]);
    });
  }

  async getApprovalForStep(organizationId: string, runId: string, stepName: string) {
    return withTenant(this.pool, organizationId, async (c) => {
      const r = await c.query("SELECT * FROM approvals WHERE run_id = $1 AND step_name = $2", [runId, stepName]);
      return r.rows[0] ? toApproval(r.rows[0]) : null;
    });
  }

  async getApproval(organizationId: string, approvalId: string) {
    return withTenant(this.pool, organizationId, async (c) => {
      const r = await c.query("SELECT * FROM approvals WHERE id = $1", [approvalId]);
      return r.rows[0] ? toApproval(r.rows[0]) : null;
    });
  }

  async decideApproval(organizationId: string, approvalId: string, d: { status: "approved" | "rejected"; decidedBy: string; reason: string | null; at: string }) {
    return withTenant(this.pool, organizationId, async (c) => {
      const r = await c.query(
        "UPDATE approvals SET status = $2, decided_by = $3, reason = $4, decided_at = $5 WHERE id = $1 AND status = 'pending' RETURNING *",
        [approvalId, d.status, d.decidedBy, d.reason, d.at],
      );
      return r.rows[0] ? toApproval(r.rows[0]) : null;
    });
  }

  async listApprovals(organizationId: string, status?: ApprovalStatus) {
    return withTenant(this.pool, organizationId, async (c) => {
      const r = await c.query("SELECT * FROM approvals WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at", [status ?? null]);
      return r.rows.map(toApproval);
    });
  }

  async appendLog(l: ExecutionLog) {
    await withTenant(this.pool, l.organizationId, (c) =>
      c.query("INSERT INTO workflow_logs (organization_id, run_id, level, message, step_name, data, at) VALUES ($1,$2,$3,$4,$5,$6,$7)", [l.organizationId, l.runId, l.level, l.message, l.stepName ?? null, l.data ? JSON.stringify(l.data) : null, l.at]),
    );
  }

  async listLogs(organizationId: string, runId: string) {
    return withTenant(this.pool, organizationId, async (c) => {
      const r = await c.query("SELECT * FROM workflow_logs WHERE run_id = $1 ORDER BY id", [runId]);
      return r.rows.map((x) => ({ organizationId: x.organization_id, runId: x.run_id, level: x.level, message: x.message, stepName: x.step_name ?? undefined, data: x.data ?? undefined, at: iso(x.at) as string }));
    });
  }

  async appendAudit(a: AuditEntry) {
    await withTenant(this.pool, a.organizationId, (c) =>
      c.query("INSERT INTO audit_log (organization_id, actor_type, actor_id, action, target_type, target_id, data, at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [a.organizationId, a.actorType, a.actorId, a.action, a.targetType, a.targetId, a.data ? JSON.stringify(a.data) : null, a.at]),
    );
  }
}
