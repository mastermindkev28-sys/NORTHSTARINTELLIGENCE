"use server";
import { revalidatePath } from "next/cache";
import { getWorkspace, DEMO_MANAGER } from "@/lib/workspace";

/** Approves or rejects a pending approval as the demo manager, then lets the engine resume the run. */
export async function decide(formData: FormData) {
  const id = String(formData.get("approvalId") ?? "");
  const decision = formData.get("decision") === "approved" ? "approved" : "rejected";
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid approval id");
  const ws = await getWorkspace();
  await ws.engine.decideApproval(
    DEMO_MANAGER,
    id,
    decision,
    decision === "approved" ? "Approved in demo workspace" : "Rejected in demo workspace",
  );
  await ws.engine.drain();
  revalidatePath("/automation");
  revalidatePath("/");
}
