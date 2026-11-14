import { NextResponse } from "next/server";
import { EVENTS } from "@northstar/agents";
import { contextForRole, stableHash } from "@northstar/core";
import { verifyWebhook } from "@northstar/integrations";
import { LeadInput } from "@northstar/leads";
import { getWorkspace, DEMO_ORG } from "@/lib/workspace";

const MAX_BODY_BYTES = 64 * 1024;

/**
 * Inbound lead webhook. Verifies the HMAC signature and timestamp, validates the payload, and emits an
 * idempotent `lead.received` event. Processing is asynchronous — the response returns as soon as the event is durable.
 */
export async function POST(req: Request) {
  const secret = process.env.LEAD_WEBHOOK_SIGNING_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook signing secret not configured" }, { status: 503 });
  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const v = verifyWebhook(secret, raw, req.headers.get("x-northstar-signature"), Math.floor(Date.now() / 1000));
  if (!v.valid) return NextResponse.json({ error: `Invalid signature (${v.reason})` }, { status: 401 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }
  const parsed = LeadInput.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid lead payload", issues: parsed.error.issues.slice(0, 10) }, { status: 422 });
  const ws = await getWorkspace();
  const ctx = contextForRole(DEMO_ORG, { type: "system", id: `webhook:${parsed.data.source}` }, "owner");
  const idempotencyKey = req.headers.get("idempotency-key") ?? `lead:${parsed.data.source}:${parsed.data.externalId ?? stableHash(json)}`;
  const { event, inserted } = await ws.engine.emit(ctx, EVENTS.leadReceived, { lead: json }, { idempotencyKey });
  void ws.engine.drain();
  return NextResponse.json({ eventId: event.id, duplicate: !inserted }, { status: inserted ? 202 : 200 });
}
