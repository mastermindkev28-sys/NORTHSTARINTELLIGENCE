/**
 * Cited regulatory factor rows for the pilot jurisdictions, transcribed from docs/LANDLORD_REGULATORY_INDEX.md
 * (research thread, retrieved 2026-11-10). Verification follows that document: "official" = statute, ordinance or
 * government publication; "secondary" = secondary summary pending verification; "unverified" = research could not
 * confirm. NOT LEGAL ADVICE: counsel must review before customer-facing use.
 *
 * Factors the research has not sourced yet (court timelines, entry notice at state level, inspections) are absent on
 * purpose, so the index reports reduced coverage rather than guessing.
 */
import type { GeoArea } from './types';
import type { RegulatoryFactorRow } from './regulatory';

const RETRIEVED = '2026-11-10T00:00:00Z';

const PA_LTA = { title: 'Pennsylvania Landlord and Tenant Act of 1951', url: 'https://www.legis.state.pa.us/wu01/li/li/us/pdf/1951/0/0020..pdf' };

export const PILOT_JURISDICTIONS: GeoArea[] = [
  { key: 'state:42', level: 'state', code: '42', name: 'Pennsylvania', parentKey: null, stateCode: 'PA', isDemo: false },
  { key: 'state:17', level: 'state', code: '17', name: 'Illinois', parentKey: null, stateCode: 'IL', isDemo: false },
  { key: 'state:39', level: 'state', code: '39', name: 'Ohio', parentKey: null, stateCode: 'OH', isDemo: false },
  { key: 'city:4260000', level: 'city', code: '4260000', name: 'Philadelphia, PA', parentKey: 'state:42', stateCode: 'PA', countyFips: '42101', isDemo: false },
  { key: 'city:1714000', level: 'city', code: '1714000', name: 'Chicago, IL', parentKey: 'state:17', stateCode: 'IL', countyFips: '17031', isDemo: false },
  { key: 'city:3916000', level: 'city', code: '3916000', name: 'Cleveland, OH', parentKey: 'state:39', stateCode: 'OH', countyFips: '39035', isDemo: false },
];

const row = (r: Omit<RegulatoryFactorRow, 'retrievedAt'>): RegulatoryFactorRow => ({ ...r, retrievedAt: RETRIEVED });
const PA = { jurisdictionKey: 'state:42', jurisdictionName: 'Pennsylvania', jurisdictionLevel: 'state' } as const;
const IL = { jurisdictionKey: 'state:17', jurisdictionName: 'Illinois', jurisdictionLevel: 'state' } as const;
const OH = { jurisdictionKey: 'state:39', jurisdictionName: 'Ohio', jurisdictionLevel: 'state' } as const;
const PHL = { jurisdictionKey: 'city:4260000', jurisdictionName: 'Philadelphia', jurisdictionLevel: 'city' } as const;
const CHI = { jurisdictionKey: 'city:1714000', jurisdictionName: 'Chicago', jurisdictionLevel: 'city' } as const;
const CLE = { jurisdictionKey: 'city:3916000', jurisdictionName: 'Cleveland', jurisdictionLevel: 'city' } as const;

export const PILOT_REGULATORY_ROWS: RegulatoryFactorRow[] = [
  // Pennsylvania
  row({ ...PA, factor: 'nonpayment_notice_days', value: 10, citation: { ...PA_LTA, section: '68 P.S. § 250.501(b)' }, effectiveDate: null, verification: 'official', notes: '10 days notice to quit after rent demand.' }),
  row({ ...PA, factor: 'termination_notice_days', value: 15, citation: { ...PA_LTA, section: '68 P.S. § 250.501(b)' }, effectiveDate: null, verification: 'official', notes: '15 days for leases of one year or less or indeterminate; 30 days for leases over one year.' }),
  row({ ...PA, factor: 'security_deposit_cap_months', value: 2, citation: { ...PA_LTA, section: '68 P.S. § 250.511a' }, effectiveDate: null, verification: 'official', notes: '2 months in year one; 1 month from year two.' }),
  row({ ...PA, factor: 'deposit_return_days', value: 30, citation: { ...PA_LTA, section: '68 P.S. § 250.512' }, effectiveDate: null, verification: 'official', notes: 'Itemized list required; double damages if missed.' }),
  row({ ...PA, factor: 'rent_regulation', value: 'none', citation: { title: 'No state preemption statute found' }, effectiveDate: null, verification: 'unverified', notes: 'Research could not confirm whether PA preempts local rent control.' }),
  // Illinois
  row({ ...IL, factor: 'nonpayment_notice_days', value: 5, citation: { title: 'Illinois Code of Civil Procedure', section: '735 ILCS 5/9-209', url: 'https://www.ilga.gov/legislation/ilcs/documents/073500050K9-209.htm' }, effectiveDate: '2018-01-01', verification: 'official', notes: 'Notice must carry the "Only FULL PAYMENT..." statement (P.A. 100-173).' }),
  row({ ...IL, factor: 'rent_regulation', value: 'preempted', citation: { title: 'Rent Control Preemption Act', section: '50 ILCS 825/5', url: 'https://ilga.gov/legislation/ilcs/documents/005008250K5.htm' }, effectiveDate: null, verification: 'official' }),
  row({ ...IL, factor: 'security_deposit_cap_months', value: null, citation: { title: 'No state cap found' }, effectiveDate: null, verification: 'unverified' }),
  // Ohio
  row({ ...OH, factor: 'nonpayment_notice_days', value: 3, citation: { title: 'Ohio Revised Code', section: 'ORC 1923.04(A)', url: 'https://codes.ohio.gov/ohio-revised-code/section-1923.04' }, effectiveDate: null, verification: 'official', notes: 'Three-day notice to leave with required tenant statement.' }),
  row({ ...OH, factor: 'deposit_return_days', value: 30, citation: { title: 'Ohio Revised Code', section: 'ORC 5321.16', url: 'https://codes.ohio.gov/ohio-revised-code/section-5321.16' }, effectiveDate: null, verification: 'official' }),
  row({ ...OH, factor: 'security_deposit_cap_months', value: null, citation: { title: 'No cap found' }, effectiveDate: null, verification: 'unverified' }),
  row({ ...OH, factor: 'rent_regulation', value: 'preempted', citation: { title: 'Ohio Revised Code', section: 'ORC 5321.20', url: 'https://codes.ohio.gov/ohio-revised-code/section-5321.20' }, effectiveDate: '2022-09-23', verification: 'official' }),
  // Philadelphia
  row({ ...PHL, factor: 'just_cause_required', value: true, citation: { title: 'Philadelphia Bill No. 250330-AA', section: 'Phila. Code § 9-804(12)', url: 'https://files.amlegal.com/pdffiles/Philadelphia/250330-AA.pdf' }, effectiveDate: '2026-11-01', verification: 'official', notes: 'Good cause required for any lease length; signed 2026-05-07.' }),
  row({ ...PHL, factor: 'rental_license_required', value: true, citation: { title: 'City of Philadelphia Fair Housing guide', url: 'https://www.phila.gov/media/20251106145008/Fair-Housing-guide-1.pdf' }, effectiveDate: null, verification: 'official', notes: 'Without a license a landlord may not collect rent or evict.' }),
  row({ ...PHL, factor: 'lead_certification_required', value: true, citation: { title: 'City of Philadelphia Fair Housing guide', url: 'https://www.phila.gov/media/20251106145008/Fair-Housing-guide-1.pdf' }, effectiveDate: null, verification: 'official', notes: 'Pre-1978 rentals, even without children.' }),
  row({ ...PHL, factor: 'pre_filing_diversion_required', value: true, citation: { title: 'Phila. Code § 9-811 (Eviction Diversion Program)', url: 'https://www.biggerpockets.com/posts/7323275' }, effectiveDate: null, verification: 'secondary', notes: 'At least 30 days in the program before filing; verify against Code.' }),
  // Chicago (RLTO)
  row({ ...CHI, factor: 'entry_notice_hours', value: 48, citation: { title: 'Chicago RLTO', section: 'Mun. Code 5-12-050', url: 'https://www.chicago.gov/content/dam/city/depts/doh/RLTO/RLTO%20Summary_2023_EN_FINAL.pdf' }, effectiveDate: null, verification: 'official' }),
  row({ ...CHI, factor: 'termination_notice_days', value: 30, citation: { title: 'Chicago Fair Notice Ordinance', url: 'https://www.chicago.gov/content/dam/city/depts/doh/RLTO/RLTO%20Summary_2023_EN_FINAL.pdf' }, effectiveDate: null, verification: 'official', notes: '30 / 60 / 120 days by tenancy length; shortest tier shown.' }),
  row({ ...CHI, factor: 'rent_increase_notice_days', value: 30, citation: { title: 'Chicago Fair Notice Ordinance', url: 'https://www.chicago.gov/content/dam/city/depts/doh/RLTO/RLTO%20Summary_2023_EN_FINAL.pdf' }, effectiveDate: null, verification: 'official', notes: '30 / 60 / 120 days by tenancy length; shortest tier shown.' }),
  row({ ...CHI, factor: 'deposit_return_days', value: 45, citation: { title: 'Chicago RLTO', section: 'Mun. Code 5-12-080', url: 'https://www.chicago.gov/content/dam/city/depts/doh/RLTO/RLTO%20Summary_2023_EN_FINAL.pdf' }, effectiveDate: null, verification: 'official', notes: 'Itemized damages within 30 days; return within 45.' }),
  // Cleveland
  row({ ...CLE, factor: 'rental_registration_required', value: true, citation: { title: 'City of Cleveland 2026 Rental Registration Guide', url: 'https://www.clevelandohio.gov/sites/clevelandohio/files/Building%20and%20Housing/2026%20Rental%20Registration%20Guide.pdf' }, effectiveDate: null, verification: 'official' }),
  row({ ...CLE, factor: 'lead_certification_required', value: true, citation: { title: 'City of Cleveland 2026 Rental Registration Guide', url: 'https://www.clevelandohio.gov/sites/clevelandohio/files/Building%20and%20Housing/2026%20Rental%20Registration%20Guide.pdf' }, effectiveDate: null, verification: 'official', notes: 'Lead Safe Certificate for units built before 1978.' }),
];
