/**
 * County source registry (code side). The database table `discover.county_sources` mirrors these
 * entries; this file is the reviewed, versioned definition from which connectors are built.
 *
 * Endpoints, dataset ids, and license notes come from docs/PUBLIC_RECORDS_SOURCE_INVENTORY.md.
 * Column mappings follow the sources' published data dictionaries and have NOT yet been checked
 * against live responses (`mappingVerified: false`): this environment's network policy blocks the
 * portals. Verify each mapping against a live sample before enabling a source in production.
 */
import type { RecordCategory, SourceLicense, SourceRecord } from '../types';
import { CartoConnector, SocrataConnector } from './generic';
import { day, num, str, type CountyConnector, type CountyRef, type HttpOptions, type RowMapper } from './types';

export type SourceStatus = 'planned' | 'built' | 'verified' | 'disabled';

export interface CountySourceDefinition {
  sourceKey: string;
  county: CountyRef;
  category: RecordCategory;
  title: string;
  platform: 'socrata' | 'arcgis' | 'carto' | 'manual';
  status: SourceStatus;
  mappingVerified: boolean;
  refreshCadence: string;
  license: SourceLicense;
  notes: string;
  build?: (http?: HttpOptions) => CountyConnector;
}

export const PHILADELPHIA: CountyRef = { state: 'PA', countyFips: '42101', name: 'Philadelphia County' };
export const COOK: CountyRef = { state: 'IL', countyFips: '17031', name: 'Cook County' };
export const CUYAHOGA: CountyRef = { state: 'OH', countyFips: '39035', name: 'Cuyahoga County' };

const PHL_LICENSE: SourceLicense = {
  tag: 'phl-open-data',
  name: 'City of Philadelphia License',
  url: 'https://www.opendataphilly.org/',
  automatedAccess: 'permitted',
  commercialDisplay: 'permitted',
  attributionRequired: true,
  notes: 'Open data under the City of Philadelphia License; attribution required. Re-review terms before launch.',
  reviewedOn: '2026-11-10',
};
const COOK_LICENSE: SourceLicense = {
  tag: 'cook-unstated',
  name: 'No license stated',
  url: 'https://datacatalog.cookcountyil.gov/',
  automatedAccess: 'not_stated',
  commercialDisplay: 'not_stated',
  attributionRequired: true,
  notes: 'Portal states no explicit license. Ingest for evaluation only; customer display requires legal review.',
  reviewedOn: '2026-11-10',
};
const CUYAHOGA_LICENSE: SourceLicense = {
  tag: 'cuyahoga-open-data',
  name: 'Cuyahoga County open data (terms to confirm)',
  automatedAccess: 'not_stated',
  commercialDisplay: 'not_stated',
  attributionRequired: true,
  notes: 'Terms not yet reviewed.',
};

const PHL_CARTO = 'https://phl.carto.com/api/v2/sql';

/** Philadelphia RTT_SUMMARY: deeds, mortgages, sheriff deeds, assignments, satisfactions (1999+). */
export const mapPhillyRtt: RowMapper = (row, ctx) => {
  const id = str(row['document_id']);
  const type = str(row['document_type']);
  if (!id || !type) return null;
  const consideration = num(row['total_consideration']);
  const parties = [
    ...splitParties(str(row['grantors'])).map((name) => ({ role: 'grantor' as const, name })),
    ...splitParties(str(row['grantees'])).map((name) => ({ role: 'grantee' as const, name })),
  ];
  const recordedDate = day(row['recording_date']);
  const apn = str(row['opa_account_num']);
  const rec: SourceRecord = {
    sourceKey: ctx.sourceKey,
    sourceRecordId: id,
    category: 'recorder',
    retrievedAt: ctx.retrievedAt,
    licenseTag: ctx.licenseTag,
    apn,
    address: { line1: str(row['street_address']), postalCode: str(row['zip_code']), city: 'PHILADELPHIA', state: 'PA' },
    instrument: {
      instrumentType: type.toUpperCase(),
      instrumentNumber: id,
      recordedDate,
      instrumentDate: day(row['document_date']),
      parties,
      consideration,
      apn,
    },
    attributes: { document_type: type },
  };
  if (/^DEED/i.test(type) && recordedDate) {
    rec.event = { eventType: 'recent_sale', status: 'completed', eventDate: recordedDate, amount: consideration };
  }
  return rec;
};

/** Philadelphia L&I code violations. */
export const mapPhillyViolation: RowMapper = (row, ctx) => {
  const id = str(row['violationnumber']) ?? str(row['casenumber']);
  if (!id) return null;
  const rawStatus = (str(row['violationstatus']) ?? str(row['casestatus']) ?? '').toUpperCase();
  const status = /OPEN|ACTIVE/.test(rawStatus) ? 'active' : /COMPL|CLOSED|RESOLVED/.test(rawStatus) ? 'resolved' : null;
  if (!status) return null;
  return {
    sourceKey: ctx.sourceKey,
    sourceRecordId: id,
    category: 'code_enforcement',
    retrievedAt: ctx.retrievedAt,
    licenseTag: ctx.licenseTag,
    apn: str(row['opa_account_num']),
    address: { line1: str(row['address']), postalCode: str(row['zip']), city: 'PHILADELPHIA', state: 'PA' },
    event: { eventType: 'code_violation', status, eventDate: day(row['violationdate']) },
    attributes: { violation_code: str(row['violationcode']) ?? null, raw_status: rawStatus },
  };
};

/** Cook County Assessor parcel sales (wvhk-k5uv). Excludes quit-claim and executor deeds at source. */
export const mapCookSale: RowMapper = (row, ctx) => {
  const doc = str(row['doc_no']);
  const pin = str(row['pin']);
  if (!doc || !pin) return null;
  const date = day(row['sale_date']);
  const price = num(row['sale_price']);
  const parties = [
    ...(str(row['seller_name']) ? [{ role: 'grantor' as const, name: str(row['seller_name'])! }] : []),
    ...(str(row['buyer_name']) ? [{ role: 'grantee' as const, name: str(row['buyer_name'])! }] : []),
  ];
  return {
    sourceKey: ctx.sourceKey,
    sourceRecordId: `${doc}:${pin}`,
    category: 'recorder',
    retrievedAt: ctx.retrievedAt,
    licenseTag: ctx.licenseTag,
    apn: pin,
    instrument: { instrumentType: (str(row['deed_type']) ?? 'DEED').toUpperCase(), instrumentNumber: doc, recordedDate: date, parties, consideration: price, apn: pin },
    event: date ? { eventType: 'recent_sale', status: 'completed', eventDate: date, amount: price } : undefined,
    attributes: { deed_type: str(row['deed_type']) ?? null, class: str(row['class']) ?? null },
  };
};

function splitParties(v: string | undefined): string[] {
  return v ? v.split(/;|\|/).map((s) => s.trim()).filter(Boolean) : [];
}

export const COUNTY_SOURCES: readonly CountySourceDefinition[] = [
  {
    sourceKey: 'phl.rtt_summary',
    county: PHILADELPHIA,
    category: 'recorder',
    title: 'Real estate transfer tax summary (deeds, mortgages, sheriff deeds, assignments, satisfactions)',
    platform: 'carto',
    status: 'built',
    mappingVerified: false,
    refreshCadence: 'daily',
    license: PHL_LICENSE,
    notes: 'Mortgage consideration is the original recorded amount, never a current balance.',
    build: (http) => new CartoConnector({ sourceKey: 'phl.rtt_summary', county: PHILADELPHIA, category: 'recorder', license: PHL_LICENSE, endpoint: PHL_CARTO, table: 'rtt_summary', orderBy: 'recording_date', map: mapPhillyRtt, http }),
  },
  {
    sourceKey: 'phl.li_violations',
    county: PHILADELPHIA,
    category: 'code_enforcement',
    title: 'L&I code violations',
    platform: 'carto',
    status: 'built',
    mappingVerified: false,
    refreshCadence: 'daily',
    license: PHL_LICENSE,
    notes: 'Open and closed violations; status mapped to active/resolved.',
    build: (http) => new CartoConnector({ sourceKey: 'phl.li_violations', county: PHILADELPHIA, category: 'code_enforcement', license: PHL_LICENSE, endpoint: PHL_CARTO, table: 'violations', orderBy: 'violationdate', map: mapPhillyViolation, http }),
  },
  {
    sourceKey: 'phl.opa_properties',
    county: PHILADELPHIA,
    category: 'assessor',
    title: 'OPA property assessments (parcel base layer)',
    platform: 'carto',
    status: 'planned',
    mappingVerified: false,
    refreshCadence: 'nightly',
    license: PHL_LICENSE,
    notes: 'Parcel spine for Philadelphia; mapping to be written against a live sample.',
  },
  {
    sourceKey: 'cook.parcel_sales',
    county: COOK,
    category: 'recorder',
    title: 'Assessor parcel sales (wvhk-k5uv)',
    platform: 'socrata',
    status: 'built',
    mappingVerified: false,
    refreshCadence: 'semi-monthly',
    license: COOK_LICENSE,
    notes: 'Recording lag; excludes quit-claim and executor deeds. No stated license: evaluation only.',
    build: (http) => new SocrataConnector({ sourceKey: 'cook.parcel_sales', county: COOK, category: 'recorder', license: COOK_LICENSE, domain: 'datacatalog.cookcountyil.gov', datasetId: 'wvhk-k5uv', orderBy: 'sale_date', map: mapCookSale, http }),
  },
  {
    sourceKey: 'cook.tax_sale',
    county: COOK,
    category: 'tax',
    title: 'Annual tax sale (55ju-2fs9)',
    platform: 'socrata',
    status: 'planned',
    mappingVerified: false,
    refreshCadence: 'annual',
    license: COOK_LICENSE,
    notes: 'Mapping pending a live sample.',
  },
  {
    sourceKey: 'cuyahoga.parcels',
    county: CUYAHOGA,
    category: 'assessor',
    title: 'Open_Data_Parcels MapServer',
    platform: 'arcgis',
    status: 'planned',
    mappingVerified: false,
    refreshCadence: 'unknown',
    license: CUYAHOGA_LICENSE,
    notes: 'Candidate county. Sheriff sale statuses (withdrawn, bankruptcy, postponed, cancelled, unsold) have no API.',
  },
];

/** Map a Cuyahoga-style sheriff sale status to the event lifecycle. */
export function mapSheriffSaleStatus(raw: string): import('../types').EventStatus | null {
  const s = raw.trim().toLowerCase();
  if (s === 'withdrawn') return 'withdrawn';
  if (s === 'postponed' || s === 'bankruptcy') return 'postponed';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  if (s === 'unsold') return 'expired';
  if (s === 'sold') return 'completed';
  if (s === 'scheduled' || s === 'active') return 'scheduled';
  return null;
}

export function buildConnector(sourceKey: string, http?: HttpOptions): CountyConnector {
  const def = COUNTY_SOURCES.find((s) => s.sourceKey === sourceKey);
  if (!def) throw new Error(`unknown source ${sourceKey}`);
  if (!def.build || def.status === 'planned' || def.status === 'disabled') throw new Error(`${sourceKey} is ${def.status}; no connector available`);
  return def.build(http);
}

