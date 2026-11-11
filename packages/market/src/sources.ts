/**
 * Data source catalog for Market Intelligence. Facts here follow docs/MARKET_INTELLIGENCE_DATA_SOURCES.md
 * (research thread, retrieved 2026-11-10). `status` says whether Northstar has a working connector.
 */
import type { GeoLevel, SourceClass, SourceRef } from './types';

export type ConnectorStatus = 'planned' | 'demo_only' | 'live';

export interface SourceDefinition {
  id: string;
  name: string;
  agency: string;
  class: SourceClass;
  url: string;
  cadence: string;
  levels: readonly GeoLevel[];
  access: string;
  caveats: string;
  status: ConnectorStatus;
}

export const SOURCES: readonly SourceDefinition[] = [
  { id: 'census_acs5', name: 'American Community Survey 5-year', agency: 'U.S. Census Bureau', class: 'official', url: 'https://www.census.gov/data/developers/data-sets/acs-5year.html', cadence: 'Annual', levels: ['state', 'metro', 'city', 'zip', 'neighborhood'], access: 'Census Data API, key required', caveats: 'Survey estimates with margins of error over 5-year periods, not point-in-time.', status: 'planned' },
  { id: 'census_pep', name: 'Population Estimates Program', agency: 'U.S. Census Bureau', class: 'official', url: 'https://www.census.gov/programs-surveys/popest.html', cadence: 'Annual vintages', levels: ['state', 'metro', 'city'], access: 'Census Data API, key required', caveats: 'Components of change (migration) published at county and above.', status: 'planned' },
  { id: 'census_bps', name: 'Building Permits Survey', agency: 'U.S. Census Bureau', class: 'official', url: 'https://www.census.gov/construction/bps/index.html', cadence: 'Monthly and annual', levels: ['state', 'metro', 'city'], access: 'Excel / ASCII downloads', caveats: 'Permits, not completions; permit-issuing places only.', status: 'planned' },
  { id: 'census_hvs', name: 'Housing Vacancy Survey', agency: 'U.S. Census Bureau', class: 'official', url: 'https://www.census.gov/housing/hvs/index.html', cadence: 'Quarterly', levels: ['state', 'metro'], access: 'Downloads', caveats: '75 largest metros only.', status: 'planned' },
  { id: 'bls_laus', name: 'Local Area Unemployment Statistics', agency: 'Bureau of Labor Statistics', class: 'official', url: 'https://www.bls.gov/lau/', cadence: 'Monthly', levels: ['state', 'metro', 'city'], access: 'BLS API v2, free key; 500 queries/day, 50 series and 20 years per query', caveats: 'Revised annually.', status: 'planned' },
  { id: 'bls_ces', name: 'Current Employment Statistics (State and Metro)', agency: 'Bureau of Labor Statistics', class: 'official', url: 'https://www.bls.gov/sae/', cadence: 'Monthly', levels: ['state', 'metro'], access: 'BLS API v2', caveats: 'Establishment survey; benchmark revisions each March.', status: 'planned' },
  { id: 'bls_qcew', name: 'Quarterly Census of Employment and Wages', agency: 'Bureau of Labor Statistics', class: 'official', url: 'https://www.bls.gov/cew/', cadence: 'Quarterly', levels: ['state', 'metro'], access: 'BLS API v2 and open data files', caveats: '~5 month lag.', status: 'planned' },
  { id: 'fhfa_hpi', name: 'FHFA House Price Index', agency: 'Federal Housing Finance Agency', class: 'official', url: 'https://www.fhfa.gov/data/hpi/datasets', cadence: 'Quarterly (state, 100 largest MSAs); annual developmental (county, ZIP5, tract)', levels: ['state', 'metro', 'zip'], access: 'CSV / XLS downloads', caveats: 'Repeat sales on conforming loans; ZIP5 and tract are developmental.', status: 'planned' },
  { id: 'hud_fmr', name: 'Fair Market Rents and Small Area FMRs', agency: 'HUD', class: 'official', url: 'https://www.huduser.gov/portal/datasets/fmr.html', cadence: 'Annual (fiscal year)', levels: ['metro', 'zip'], access: 'HUD User API, token required', caveats: 'Benchmarks, not market rent and not PHA-approved rent.', status: 'planned' },
  { id: 'fbi_cde', name: 'FBI Crime Data Explorer', agency: 'Federal Bureau of Investigation', class: 'official', url: 'https://cde.ucr.cjis.gov/', cadence: 'Annual', levels: ['state', 'city'], access: 'CDE web and API', caveats: '2024 covers 95.6% of eligible population; NIBRS and SRS counts are not directly comparable.', status: 'planned' },
  { id: 'local_police_open_data', name: 'Local police incident open data', agency: 'City police departments', class: 'official', url: 'https://opendataphilly.org/', cadence: 'Often daily', levels: ['city', 'zip', 'neighborhood'], access: 'Socrata / ArcGIS / Carto, per-city license review', caveats: 'Definitions vary by city; aggregate to area level only.', status: 'planned' },
  { id: 'fema_nri', name: 'National Risk Index', agency: 'FEMA', class: 'official', url: 'https://hazards.fema.gov/nri/data-resources', cadence: 'Versioned releases', levels: ['state', 'zip', 'neighborhood'], access: 'CSV, geodatabase, shapefile, ArcGIS services', caveats: 'County and tract native; -9999 means null in shapefiles; generalized hazard, not an insurance quote.', status: 'planned' },
  { id: 'fema_nfhl', name: 'National Flood Hazard Layer', agency: 'FEMA', class: 'official', url: 'https://www.fema.gov/flood-maps/national-flood-hazard-layer', cadence: 'Continuous map revisions', levels: ['zip', 'neighborhood'], access: 'ArcGIS services, downloads', caveats: 'Effective maps only; does not capture all flood risk.', status: 'planned' },
  { id: 'noaa_climate', name: 'Climate normals', agency: 'NOAA NCEI', class: 'official', url: 'https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals', cadence: 'Decadal normals', levels: ['metro'], access: 'Downloads', caveats: 'Station-based.', status: 'planned' },
  { id: 'state_insurance_filings', name: 'State insurance department market data', agency: 'State insurance regulators', class: 'official', url: 'https://content.naic.org/state-insurance-departments', cadence: 'Varies', levels: ['state'], access: 'Varies by state', caveats: 'Not yet sourced (research next step).', status: 'planned' },
  { id: 'licensed_sales', name: 'Licensed closed sales', agency: 'Licensed provider', class: 'licensed', url: 'https://www.rentcast.io/api', cadence: 'Daily', levels: ['zip', 'neighborhood'], access: 'Provider API under license', caveats: 'Coverage varies; non-disclosure states lack sale prices.', status: 'planned' },
  { id: 'licensed_listings', name: 'Licensed active listings', agency: 'Licensed provider', class: 'licensed', url: 'https://www.rentcast.io/api', cadence: 'Daily', levels: ['zip', 'neighborhood'], access: 'Provider API under license', caveats: 'Listing data rights are restrictive; display per license.', status: 'planned' },
  { id: 'licensed_rents', name: 'Licensed rent estimates and listings', agency: 'Licensed provider', class: 'licensed', url: 'https://www.rentcast.io/api', cadence: 'Daily', levels: ['zip', 'neighborhood'], access: 'Provider API under license', caveats: 'Asking rents, not achieved rents.', status: 'planned' },
  { id: 'northstar_comps', name: 'Northstar comparable-sales evidence', agency: 'Northstar Intelligence', class: 'licensed', url: 'https://northstar.local/methodology', cadence: 'On ingest', levels: ['zip', 'neighborhood'], access: 'Derived', caveats: 'Derived from licensed sales; ≥ 3 adjusted comps required per property.', status: 'planned' },
  { id: 'northstar_lri', name: 'Northstar Landlord Regulatory Index', agency: 'Northstar Intelligence (cited statutes and ordinances)', class: 'official', url: 'https://northstar.local/methodology#lri', cadence: 'On change', levels: ['state', 'city'], access: 'Registry of cited factors', caveats: 'Not legal advice; counsel review required before customer use.', status: 'live' },
  { id: 'demo', name: 'Northstar demo dataset', agency: 'Northstar Intelligence', class: 'demo', url: 'https://northstar.local/demo', cadence: 'Static', levels: ['state', 'metro', 'zip'], access: 'Bundled', caveats: 'Illustrative values for fictional geographies. Not real statistics.', status: 'demo_only' },
];

const BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

export function getSource(id: string): SourceDefinition | undefined {
  return BY_ID.get(id);
}

export function sourceRef(id: string): SourceRef {
  const s = BY_ID.get(id);
  if (!s) return { id, name: id, class: 'third_party' };
  return { id: s.id, name: s.name, class: s.class, url: s.url };
}
