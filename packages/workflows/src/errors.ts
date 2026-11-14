/** Internal control-flow signal: the run must suspend (sleep or approval). Never surfaced to users. */
export class SuspendSignal extends Error {
  constructor(
    readonly kind: "sleep" | "approval",
    readonly until: Date | null,
    readonly stepName: string,
  ) {
    super(`Suspended at step ${stepName}`);
    this.name = "SuspendSignal";
  }
}

export class ApprovalRejectedError extends Error {
  constructor(
    readonly stepName: string,
    readonly decidedBy: string,
    readonly reason: string | null,
  ) {
    super(`Approval rejected at step ${stepName}${reason ? `: ${reason}` : ""}`);
    this.name = "ApprovalRejectedError";
  }
}
