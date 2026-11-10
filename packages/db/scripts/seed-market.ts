/**
 * Load Market Intelligence reference data into Postgres as the ingest role.
 * Usage: DATABASE_OWNER_URL=postgres://owner@host/db pnpm --filter @northstar/db seed:market [--demo]
 *
 * Always loads the cited pilot jurisdictions and regulatory factors (docs/LANDLORD_REGULATORY_INDEX.md).
 * With --demo, also loads the fictional demo geographies and observations (labeled is_demo / source_class 'demo').
 * Idempotent: re-running inserts nothing new.
 */
import { PILOT_JURISDICTIONS, PILOT_REGULATORY_ROWS, demoDataset, type GeoArea, type RegulatoryFactorRow } from '@northstar/market';
import { createDb } from '../src/client';
import { insertObservation, insertRegulatoryRow, upsertGeoArea, withIngest } from '../src/market';

const url = process.env.DATABASE_OWNER_URL;
if (!url) {
  console.error('DATABASE_OWNER_URL is required');
  process.exit(1);
}
const withDemo = process.argv.includes('--demo');
const db = createDb(url, 2);
const areas: GeoArea[] = [...PILOT_JURISDICTIONS, ...(withDemo ? demoDataset().areas : [])];
const regRows: RegulatoryFactorRow[] = [...PILOT_REGULATORY_ROWS, ...(withDemo ? demoDataset().regulatory : [])];
const levelOrder = ['state', 'metro', 'city', 'zip', 'neighborhood'];
areas.sort((a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level));

const counts = await withIngest(db, async (tx) => {
  let obs = 0, reg = 0;
  for (const a of areas) {
    await upsertGeoArea(tx, { key: a.key, level: a.level, code: a.code, name: a.name, parentKey: a.parentKey, stateCode: a.stateCode, countyFips: a.countyFips ?? null, zcta: a.zcta ?? null, population: a.population ? Math.round(a.population) : null, isDemo: a.isDemo });
  }
  if (withDemo) {
    for (const [key, list] of demoDataset().observations) {
      for (const o of list) {
        if (await insertObservation(tx, key, { metric: o.metric, value: o.value, period: o.period, periodEnd: o.periodEnd, measuredAt: o.measuredAt, sourceId: o.source.id, sourceClass: o.source.class, retrievedAt: o.retrievedAt, isProjection: !!o.isProjection, reportingCoverage: o.reportingCoverage ?? null, note: o.note ?? null })) obs++;
      }
    }
  }
  for (const r of regRows) {
    if (await insertRegulatoryRow(tx, { jurisdictionKey: r.jurisdictionKey, factor: r.factor, value: r.value, citationTitle: r.citation.title, citationSection: r.citation.section ?? null, sourceUrl: r.citation.url ?? null, effectiveDate: r.effectiveDate, retrievedAt: r.retrievedAt, verification: r.verification, notes: r.notes ?? null })) reg++;
  }
  return { areas: areas.length, observations: obs, regulatoryRows: reg };
});
console.log(JSON.stringify({ level: 'info', msg: 'market reference data loaded', demo: withDemo, ...counts }));
await db.end();
