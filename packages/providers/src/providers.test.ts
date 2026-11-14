import { describe, expect, it } from "vitest";
import { NorthstarError } from "@northstar/core";
import {
  AttomProvider,
  DemoPropertyProvider,
  MemoryProviderCache,
  PropertyDataRegistry,
  RentCastProvider,
  type FetchLike,
  type PropertyDataProvider,
} from "./index";

const addr = { line1: "1 Main St", city: "Springfield", state: "IL", zip: "62701" };
const now = () => new Date("2026-11-14T12:00:00Z");

function fakeFetch(
  routes: Record<string, { status: number; body?: unknown }>,
  calls: string[] = [],
): FetchLike {
  return async (url, init) => {
    calls.push(url);
    const match = Object.entries(routes).find(([k]) => url.includes(k));
    const r = match?.[1] ?? { status: 404 };
    void init;
    return {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      json: async () => r.body,
      text: async () => JSON.stringify(r.body ?? ""),
    };
  };
}

const attomBody = {
  status: { code: 0 },
  property: [
    {
      identifier: { attomId: 145423726, apn: "14-28-322-001" },
      summary: {
        yearbuilt: 1962,
        propertyType: "SINGLE FAMILY RESIDENCE",
        absenteeInd: "OWNER OCCUPIED",
      },
      building: { size: { livingsize: 1450 }, rooms: { beds: 3, bathstotal: 2 } },
      lot: { lotsize2: 6500 },
      location: { latitude: "39.7817", longitude: "-89.6501" },
      assessment: {
        assessed: { assdttlvalue: 61000 },
        tax: { taxamt: 3812.44 },
        owner: { owner1: { fullName: "PUBLIC RECORD OWNER" } },
      },
      sale: { amount: { saleamt: 98000 }, saleTransDate: "2011-06-14" },
    },
  ],
};

describe("AttomProvider", () => {
  it("maps present fields with provenance and leaves absent fields absent", async () => {
    const calls: string[] = [];
    const p = new AttomProvider({
      apiKey: "k",
      fetch: fakeFetch({ expandedprofile: { status: 200, body: attomBody } }, calls),
      now,
    });
    const r = await p.getPropertyDetails(addr);
    const f = r!.data.facts;
    expect(f.livingAreaSqft?.value).toBe(1450);
    expect(f.bedrooms?.value).toBe(3);
    expect(f.latitude?.value).toBeCloseTo(39.7817, 4);
    expect(f.ownerOccupied?.value).toBe(true);
    expect(f.annualTaxAmount?.value).toBe(3812.44);
    expect(f.livingAreaSqft?.origin).toBe("third_party_estimate");
    expect(f.livingAreaSqft?.source?.recordId).toBe("145423726");
    expect(f.livingAreaSqft?.source?.retrievedAt).toBe("2026-11-14T12:00:00.000Z");
    expect(f.county).toBeUndefined();
    expect(calls[0]).toContain("address1=1%20Main%20St");
    expect(r!.meta.isDemoData).toBe(false);
  });
  it("returns null when ATTOM has no record", async () => {
    const p = new AttomProvider({ apiKey: "k", fetch: fakeFetch({}), now });
    expect(await p.getPropertyDetails(addr)).toBeNull();
  });
  it("classifies errors for retry policy", async () => {
    const down = new AttomProvider({
      apiKey: "k",
      fetch: fakeFetch({ expandedprofile: { status: 503 } }),
      now,
    });
    await expect(down.getPropertyDetails(addr)).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      retryable: true,
    });
    const badKey = new AttomProvider({
      apiKey: "k",
      fetch: fakeFetch({ expandedprofile: { status: 401 } }),
      now,
    });
    await expect(badKey.getPropertyDetails(addr)).rejects.toMatchObject({
      code: "PROVIDER_NOT_CONFIGURED",
      retryable: false,
    });
    const noKey = new AttomProvider({ apiKey: undefined, fetch: fakeFetch({}), now });
    await expect(noKey.getPropertyDetails(addr)).rejects.toMatchObject({
      code: "PROVIDER_NOT_CONFIGURED",
    });
  });
  it("maps AVM confidence", async () => {
    const p = new AttomProvider({
      apiKey: "k",
      fetch: fakeFetch({
        attomavm: {
          status: 200,
          body: {
            property: [{ avm: { amount: { value: 182000, low: 165000, high: 199000, scr: 84 } } }],
          },
        },
      }),
      now,
    });
    const v = await p.getValuation(addr);
    expect(v!.data.value.value).toBe(182000);
    expect(v!.data.value.confidence).toBeCloseTo(0.84, 10);
  });
});

describe("RentCastProvider", () => {
  it("maps rent estimate and labels comparables as listings, dropping incomplete records", async () => {
    const p = new RentCastProvider({
      apiKey: "k",
      now,
      fetch: fakeFetch({
        "rent/long-term": {
          status: 200,
          body: {
            rent: 1650,
            rentRangeLow: 1500,
            rentRangeHigh: 1800,
            comparables: [
              {
                id: "a",
                formattedAddress: "5 Elm St, Springfield, IL",
                price: 1600,
                squareFootage: 1400,
                bedrooms: 3,
                bathrooms: 2,
                distance: 0.4,
                listedDate: "2026-09-01T00:00:00Z",
              },
              { id: "b", formattedAddress: "7 Elm St", price: 1700 },
            ],
          },
        },
      }),
    });
    const r = await p.getRentEstimate(addr);
    expect(r!.data.monthlyRent.value).toBe(1650);
    expect(r!.data.comparables).toHaveLength(1);
    expect(r!.data.comparables[0]).toMatchObject({
      kind: "listing",
      date: "2026-09-01",
      livingAreaSqft: 1400,
    });
  });
});

describe("PropertyDataRegistry", () => {
  it("refuses demo data in production", () => {
    expect(
      () =>
        new PropertyDataRegistry({
          providers: [new DemoPropertyProvider(now)],
          environment: "production",
        }),
    ).toThrow(NorthstarError);
    expect(
      () =>
        new PropertyDataRegistry({
          providers: [new DemoPropertyProvider(now)],
          environment: "development",
        }),
    ).not.toThrow();
  });
  it("falls back when the primary is down or not configured, and meters usage", async () => {
    const usage: string[] = [];
    const down = new AttomProvider({
      apiKey: "k",
      fetch: fakeFetch({ attomavm: { status: 500 } }),
      now,
    });
    const unconfigured = new RentCastProvider({ apiKey: undefined, fetch: fakeFetch({}), now });
    const reg = new PropertyDataRegistry({
      providers: [down, unconfigured, new DemoPropertyProvider(now)],
      environment: "development",
      onUsage: (u) => {
        usage.push(u.provider);
      },
    });
    const v = await reg.getValuation(addr);
    expect(v!.meta.provider).toBe("demo");
    expect(v!.meta.isDemoData).toBe(true);
    expect(usage).toEqual(["demo"]);
  });
  it("stops on non-retryable errors", async () => {
    const broken: PropertyDataProvider = {
      id: "x",
      isDemo: false,
      capabilities: new Set(["valuation"]),
      getValuation: async () => {
        throw new NorthstarError("VALIDATION_FAILED", "bad address");
      },
    };
    const reg = new PropertyDataRegistry({
      providers: [broken, new DemoPropertyProvider(now)],
      environment: "test",
    });
    await expect(reg.getValuation(addr)).rejects.toThrow(/bad address/);
  });
  it("caches results to control provider cost", async () => {
    const calls: string[] = [];
    const p = new AttomProvider({
      apiKey: "k",
      fetch: fakeFetch({ expandedprofile: { status: 200, body: attomBody } }, calls),
      now,
    });
    const reg = new PropertyDataRegistry({
      providers: [p],
      environment: "test",
      cache: new MemoryProviderCache(),
    });
    await reg.getPropertyDetails(addr);
    await reg.getPropertyDetails({ ...addr, line1: "1 MAIN ST" });
    expect(calls).toHaveLength(1);
  });
  it("errors when no provider supports a capability", async () => {
    const reg = new PropertyDataRegistry({
      providers: [new RentCastProvider({ apiKey: "k", fetch: fakeFetch({}), now })],
      environment: "test",
    });
    await expect(reg.getComparableSales(addr)).rejects.toMatchObject({
      code: "PROVIDER_NOT_CONFIGURED",
    });
  });
  it("demo provider is deterministic", async () => {
    const d = new DemoPropertyProvider(now);
    expect(await d.getComparableSales(addr, {})).toEqual(await d.getComparableSales(addr, {}));
  });
});
