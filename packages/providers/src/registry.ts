import { NorthstarError, isRetryable, silentLogger, type Logger } from "@northstar/core";
import type {
  AddressQuery,
  ComparableRecord,
  CompsCriteria,
  PropertyDataProvider,
  PropertyDetails,
  ProviderCapability,
  ProviderResult,
  RentEstimate,
  ValuationEstimate,
} from "./types";

export interface UsageSink {
  (record: {
    provider: string;
    capability: ProviderCapability;
    units: number;
    isDemoData: boolean;
  }): void | Promise<void>;
}

export interface ProviderCache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
}

export class MemoryProviderCache implements ProviderCache {
  private readonly entries = new Map<string, { value: unknown; expires: number }>();
  constructor(private readonly now: () => number = Date.now) {}
  async get<T>(key: string) {
    const e = this.entries.get(key);
    if (!e || e.expires < this.now()) return undefined;
    return e.value as T;
  }
  async set<T>(key: string, value: T, ttlMs: number) {
    this.entries.set(key, { value, expires: this.now() + ttlMs });
  }
}

export interface RegistryOptions {
  /** Ordered by preference per capability. */
  providers: PropertyDataProvider[];
  environment: "production" | "development" | "test";
  allowDemoInProduction?: boolean;
  cache?: ProviderCache;
  /** Cache TTL. Must respect each provider's license terms on storage. */
  cacheTtlMs?: number;
  onUsage?: UsageSink;
  logger?: Logger;
}

const METHOD: Record<ProviderCapability, keyof PropertyDataProvider> = {
  property_details: "getPropertyDetails",
  comparable_sales: "getComparableSales",
  valuation: "getValuation",
  rent_estimate: "getRentEstimate",
};

/**
 * Routes each capability to the first configured provider that supports it, falling back to the next on
 * retryable failure or provider-not-configured. Non-retryable errors (bad request) stop the chain.
 */
export class PropertyDataRegistry {
  private readonly providers: PropertyDataProvider[];
  private readonly cache?: ProviderCache;
  private readonly ttl: number;
  private readonly onUsage?: UsageSink;
  private readonly logger: Logger;

  constructor(opts: RegistryOptions) {
    const demo = opts.providers.filter((p) => p.isDemo);
    if (opts.environment === "production" && demo.length > 0 && !opts.allowDemoInProduction) {
      throw new NorthstarError(
        "PROVIDER_NOT_CONFIGURED",
        "Demo data provider is not permitted in production",
      );
    }
    this.providers = opts.providers;
    this.cache = opts.cache;
    this.ttl = opts.cacheTtlMs ?? 24 * 3600_000;
    this.onUsage = opts.onUsage;
    this.logger = opts.logger ?? silentLogger;
  }

  supported(capability: ProviderCapability): string[] {
    return this.providers.filter((p) => p.capabilities.has(capability)).map((p) => p.id);
  }

  private async route<T>(
    capability: ProviderCapability,
    cacheKey: string,
    call: (p: PropertyDataProvider) => Promise<ProviderResult<T> | null> | undefined,
  ): Promise<ProviderResult<T> | null> {
    const cached = await this.cache?.get<ProviderResult<T> | null>(`${capability}:${cacheKey}`);
    if (cached !== undefined) return cached;
    const candidates = this.providers.filter(
      (p) => p.capabilities.has(capability) && typeof p[METHOD[capability]] === "function",
    );
    if (candidates.length === 0)
      throw new NorthstarError(
        "PROVIDER_NOT_CONFIGURED",
        `No provider configured for ${capability}`,
      );
    const errors: string[] = [];
    for (const p of candidates) {
      try {
        const result = (await call(p)) ?? null;
        if (result)
          await this.onUsage?.({
            provider: p.id,
            capability,
            units: result.meta.units,
            isDemoData: result.meta.isDemoData,
          });
        await this.cache?.set(`${capability}:${cacheKey}`, result, this.ttl);
        if (result || p === candidates[candidates.length - 1]) return result;
        errors.push(`${p.id}: no record`);
      } catch (e) {
        const notConfigured = e instanceof NorthstarError && e.code === "PROVIDER_NOT_CONFIGURED";
        errors.push(`${p.id}: ${(e as Error).message}`);
        this.logger.warn("provider call failed", {
          provider: p.id,
          capability,
          error: (e as Error).message,
        });
        if (!notConfigured && !isRetryable(e)) throw e;
      }
    }
    throw new NorthstarError(
      "PROVIDER_UNAVAILABLE",
      `All providers failed for ${capability}: ${errors.join("; ")}`,
      { retryable: true },
    );
  }

  private key(a: AddressQuery): string {
    return `${a.line1}|${a.city}|${a.state}|${a.zip}`.toUpperCase();
  }

  getPropertyDetails(a: AddressQuery): Promise<ProviderResult<PropertyDetails> | null> {
    return this.route("property_details", this.key(a), (p) => p.getPropertyDetails?.(a));
  }
  async getComparableSales(
    a: AddressQuery,
    c: CompsCriteria = {},
  ): Promise<ProviderResult<ComparableRecord[]>> {
    const r = await this.route("comparable_sales", `${this.key(a)}|${JSON.stringify(c)}`, (p) =>
      p.getComparableSales?.(a, c),
    );
    if (!r)
      throw new NorthstarError("PROVIDER_UNAVAILABLE", "No comparable sales returned", {
        retryable: false,
      });
    return r;
  }
  getValuation(a: AddressQuery): Promise<ProviderResult<ValuationEstimate> | null> {
    return this.route("valuation", this.key(a), (p) => p.getValuation?.(a));
  }
  getRentEstimate(a: AddressQuery): Promise<ProviderResult<RentEstimate> | null> {
    return this.route("rent_estimate", this.key(a), (p) => p.getRentEstimate?.(a));
  }
}
