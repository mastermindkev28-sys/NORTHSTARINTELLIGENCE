/**
 * Demo connector: deterministic synthetic records for a fictional county, every record flagged
 * `demo: true`. Used for local development, e2e tests, and product demos. Never mixed with live data.
 */
import type { SourceRecord } from '../types';
import type { CountyConnector, FetchPageRequest, FetchPageResult } from './types';

const STREETS = ['Maple Ave', 'Cedar St', 'Birch Rd', 'Elm St', 'Willow Ln'];
const SIGNALS = [
  { eventType: 'code_violation', status: 'active' },
  { eventType: 'tax_delinquency', status: 'active' },
  { eventType: 'sheriff_sale_scheduled', status: 'scheduled' },
  { eventType: 'vacancy_indicator', status: 'active' },
  { eventType: 'code_violation', status: 'resolved' },
] as const;

export class DemoCountyConnector implements CountyConnector {
  readonly sourceKey = 'demo.county_events';
  readonly county = { state: 'ZZ', countyFips: '00000', name: 'Demo County (fictional)' };
  readonly category = 'code_enforcement' as const;
  readonly demo = true;
  readonly license = { tag: 'demo', name: 'Synthetic demo data', automatedAccess: 'permitted', commercialDisplay: 'permitted', attributionRequired: false } as const;
  constructor(private readonly total = 25, private readonly retrievedAt = '2026-11-01T00:00:00.000Z') {}

  async fetchPage(req: FetchPageRequest): Promise<FetchPageResult> {
    const offset = req.cursor ? Number(req.cursor) : 0;
    const size = req.pageSize ?? 10;
    const records: SourceRecord[] = [];
    for (let i = offset; i < Math.min(this.total, offset + size); i++) {
      const sig = SIGNALS[i % SIGNALS.length]!;
      const month = String((i % 12) + 1).padStart(2, '0');
      records.push({
        sourceKey: this.sourceKey,
        sourceRecordId: `DEMO-${String(i).padStart(5, '0')}`,
        category: this.category,
        retrievedAt: this.retrievedAt,
        licenseTag: 'demo',
        apn: `DEMO${String(1000 + (i % 15))}`,
        address: { line1: `${100 + (i % 15)} ${STREETS[i % STREETS.length]}`, city: 'DEMO CITY', state: 'ZZ', postalCode: '00000' },
        event: { eventType: sig.eventType, status: sig.status, eventDate: `2026-${month}-15`, ...(sig.status === 'scheduled' ? { scheduledDate: '2027-01-20' } : {}) },
        attributes: { label: 'DEMO' },
        demo: true,
      });
    }
    const next = offset + size < this.total ? String(offset + size) : null;
    return { records, nextCursor: next, skipped: 0 };
  }
}
