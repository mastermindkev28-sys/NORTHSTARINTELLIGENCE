import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NorthstarError } from "@northstar/core";
import type { z } from "zod";

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StructuredRequest<S extends z.ZodType> {
  /** Stable, cacheable instructions. */
  system: string;
  /** Volatile per-request content (transcript, facts). */
  input: string;
  schema: S;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

export interface StructuredResponse<T> {
  object: T;
  usage: ModelUsage;
  model: string;
  /** True when produced by the deterministic mock rather than a live model. */
  simulated: boolean;
}

/** Narrow interface the agents depend on — keeps the platform model-agnostic and testable. */
export interface StructuredModel {
  readonly id: string;
  generate<S extends z.ZodType>(req: StructuredRequest<S>): Promise<StructuredResponse<z.infer<S>>>;
}

/**
 * Claude via the official Anthropic SDK using structured outputs (schema-constrained JSON).
 * Server-side refusal fallback is enabled ("default" routing) so a declined request is re-run on a fallback model
 * within the same call; a final refusal surfaces as a non-retryable error and the workflow escalates to a human.
 */
export class ClaudeStructuredModel implements StructuredModel {
  readonly id: string;
  private readonly client: Anthropic;

  constructor(opts: { apiKey?: string; model?: string; client?: Anthropic } = {}) {
    this.id = opts.model ?? process.env.NORTHSTAR_LLM_MODEL ?? "claude-opus-5-5";
    this.client = opts.client ?? new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
  }

  async generate<S extends z.ZodType>(req: StructuredRequest<S>): Promise<StructuredResponse<z.infer<S>>> {
    try {
      const response = await this.client.beta.messages.parse({
        model: this.id,
        max_tokens: req.maxTokens ?? 16_000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: req.effort ?? "medium", format: zodOutputFormat(req.schema) },
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: req.input }],
      });
      if (response.stop_reason === "refusal") {
        throw new NorthstarError("INTERNAL", "Model declined the request; escalating to a human", { retryable: false, details: { category: response.stop_details?.category ?? null } });
      }
      if (response.stop_reason === "max_tokens") throw new NorthstarError("INTERNAL", "Model output truncated", { retryable: true });
      if (response.parsed_output == null) throw new NorthstarError("INTERNAL", "Model output failed schema validation", { retryable: true });
      return {
        object: response.parsed_output as z.infer<S>,
        usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
        model: response.model,
        simulated: false,
      };
    } catch (e) {
      if (e instanceof NorthstarError) throw e;
      if (e instanceof Anthropic.RateLimitError) throw new NorthstarError("RATE_LIMITED", "Model rate limited", { retryable: true, cause: e });
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new NorthstarError("PROVIDER_NOT_CONFIGURED", "Anthropic credentials rejected", { retryable: false, cause: e });
      if (e instanceof Anthropic.BadRequestError) throw new NorthstarError("VALIDATION_FAILED", `Model request rejected: ${e.message}`, { retryable: false, cause: e });
      if (e instanceof Anthropic.APIError) throw new NorthstarError("PROVIDER_UNAVAILABLE", `Model API error ${e.status ?? ""}`, { retryable: true, cause: e });
      throw new NorthstarError("PROVIDER_UNAVAILABLE", `Model call failed: ${(e as Error).message}`, { retryable: true, cause: e });
    }
  }
}

/**
 * Deterministic stand-in used when no API key is configured and in tests. The handler receives the request and
 * returns an object that MUST satisfy the schema (validated here). Outputs are flagged `simulated: true`.
 */
export class MockStructuredModel implements StructuredModel {
  readonly id = "mock-deterministic";
  readonly calls: StructuredRequest<z.ZodType>[] = [];
  constructor(private readonly handler: (req: StructuredRequest<z.ZodType>) => unknown) {}
  async generate<S extends z.ZodType>(req: StructuredRequest<S>): Promise<StructuredResponse<z.infer<S>>> {
    this.calls.push(req);
    const object = req.schema.parse(this.handler(req));
    return { object, usage: { inputTokens: Math.ceil((req.system.length + req.input.length) / 4), outputTokens: 50 }, model: this.id, simulated: true };
  }
}
