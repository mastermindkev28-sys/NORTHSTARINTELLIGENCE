import { describe, expect, it } from "vitest";
import { SandboxMessaging, TwilioMessaging, signWebhook, twilioSignature, verifyTwilioSignature, verifyWebhook } from "./index";

describe("webhook verification", () => {
  const body = JSON.stringify({ source: "web_form", firstName: "Jane" });
  it("accepts valid signatures and rejects tampering, staleness, and malformed headers", () => {
    const header = signWebhook("s3cret", body, 1_763_000_000);
    expect(verifyWebhook("s3cret", body, header, 1_763_000_100)).toEqual({ valid: true, timestamp: 1_763_000_000 });
    expect(verifyWebhook("s3cret", body + " ", header, 1_763_000_100)).toEqual({ valid: false, reason: "mismatch" });
    expect(verifyWebhook("other", body, header, 1_763_000_100)).toEqual({ valid: false, reason: "mismatch" });
    expect(verifyWebhook("s3cret", body, header, 1_763_000_400)).toEqual({ valid: false, reason: "stale" });
    expect(verifyWebhook("s3cret", body, "t=abc,v1=zz", 1_763_000_000)).toEqual({ valid: false, reason: "malformed" });
    expect(verifyWebhook("s3cret", body, undefined, 1_763_000_000)).toEqual({ valid: false, reason: "missing" });
  });
  it("matches Twilio's documented signature example", () => {
    // Example from Twilio's webhook security documentation.
    const url = "https://mycompany.com/myapp.php?foo=1&bar=2";
    const params = { CallSid: "CA1234567890ABCDE", Caller: "+12349013030", Digits: "1234", From: "+12349013030", To: "+18005551212" };
    expect(twilioSignature("12345", url, params)).toBe("0/KCTR6DLpKmkAf8muzZqo1nDgQ=");
    expect(verifyTwilioSignature("12345", url, params, "0/KCTR6DLpKmkAf8muzZqo1nDgQ=")).toBe(true);
    expect(verifyTwilioSignature("12345", url, { ...params, Digits: "9" }, "0/KCTR6DLpKmkAf8muzZqo1nDgQ=")).toBe(false);
  });
});

describe("messaging adapters", () => {
  it("sandbox is idempotent and refuses non-allowed verdicts", async () => {
    const m = new SandboxMessaging();
    const a = await m.sendSms({ to: "+13125550142", body: "hi", idempotencyKey: "k" }, "allow");
    const b = await m.sendSms({ to: "+13125550142", body: "hi", idempotencyKey: "k" }, "allow");
    expect(a.providerMessageId).toBe(b.providerMessageId);
    expect(m.sent).toHaveLength(1);
    await expect(m.sendSms({ to: "+1", body: "x", idempotencyKey: "z" }, "block" as "allow")).rejects.toThrow(/compliance/);
  });
  it("twilio posts form-encoded messages via a messaging service", async () => {
    const calls: { url: string; body: string; headers: Record<string, string> }[] = [];
    const t = new TwilioMessaging({ accountSid: "AC1", authToken: "tok", messagingServiceSid: "MG1", fetch: async (url, init) => { calls.push({ url, body: init.body, headers: init.headers }); return { status: 201, ok: true, json: async () => ({ sid: "SM123" }) }; } });
    const r = await t.sendSms({ to: "+13125550142", body: "Hello", idempotencyKey: "k" }, "allow");
    expect(r.providerMessageId).toBe("SM123");
    expect(calls[0]!.url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
    expect(new URLSearchParams(calls[0]!.body).get("MessagingServiceSid")).toBe("MG1");
    expect(calls[0]!.headers.authorization).toBe(`Basic ${Buffer.from("AC1:tok").toString("base64")}`);
  });
  it("twilio classifies failures and requires configuration", async () => {
    const down = new TwilioMessaging({ accountSid: "AC1", authToken: "t", messagingServiceSid: "MG", fetch: async () => ({ status: 503, ok: false, json: async () => ({}) }) });
    await expect(down.sendSms({ to: "+1", body: "x", idempotencyKey: "k" }, "allow")).rejects.toMatchObject({ retryable: true });
    const none = new TwilioMessaging({ fetch: async () => ({ status: 200, ok: true, json: async () => ({}) }) });
    await expect(none.sendSms({ to: "+1", body: "x", idempotencyKey: "k" }, "allow")).rejects.toMatchObject({ code: "PROVIDER_NOT_CONFIGURED" });
  });
});
