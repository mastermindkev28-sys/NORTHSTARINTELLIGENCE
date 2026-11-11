export type NavIcon = 'command' | 'target' | 'globe' | 'calc' | 'shield' | 'file' | 'briefcase' | 'users' | 'log';

export interface NavItem { href: string | null; label: string; code: string; icon: NavIcon; hint?: string }

export const NAV: { section: string; items: NavItem[] }[] = [
  { section: 'Platform', items: [{ href: '/app', label: 'Command center', code: '00', icon: 'command' }] },
  {
    section: 'Divisions',
    items: [
      { href: '/app/market', label: 'Market Intelligence', code: '02', icon: 'globe' },
      { href: '/app/underwrite', label: 'Underwrite', code: '03', icon: 'calc' },
    ],
  },
  {
    section: 'Roadmap',
    items: [
      { href: null, label: 'Acquire', code: '01', icon: 'target' },
      { href: null, label: 'Due Diligence', code: '04', icon: 'shield' },
      { href: null, label: 'Transact', code: '05', icon: 'file' },
      { href: null, label: 'Portfolio', code: '06', icon: 'briefcase' },
    ],
  },
  {
    section: 'Administration',
    items: [
      { href: '/app/settings/members', label: 'Members & roles', code: 'A1', icon: 'users' },
      { href: '/app/settings/audit', label: 'Audit log', code: 'A2', icon: 'log' },
    ],
  },
];

/** Destinations offered by the command palette (⌘K). */
export const COMMANDS: { href: string; label: string; group: string; keywords?: string }[] = [
  { href: '/app', label: 'Command center', group: 'Navigate', keywords: 'home dashboard overview' },
  { href: '/app/underwrite/new?kind=wholesale', label: 'New wholesale / flip analysis', group: 'Create', keywords: 'mao offer arv deal' },
  { href: '/app/underwrite/new?kind=rental', label: 'New rental analysis', group: 'Create', keywords: 'cap rate noi dscr cash flow' },
  { href: '/app/underwrite', label: 'All analyses', group: 'Underwrite', keywords: 'reports saved' },
  { href: '/app/market', label: 'Market explorer', group: 'Market Intelligence', keywords: 'ranking score metro zip' },
  { href: '/app/market/compare', label: 'Compare areas', group: 'Market Intelligence' },
  { href: '/app/market/regulatory', label: 'Landlord Regulatory Index', group: 'Market Intelligence', keywords: 'law eviction rent control' },
  { href: '/app/market/property', label: 'Undervaluation evidence', group: 'Market Intelligence', keywords: 'below market comps avm' },
  { href: '/app/market/watchlists', label: 'Monitoring and alerts', group: 'Market Intelligence', keywords: 'watchlist' },
  { href: '/app/market/profiles', label: 'Score profiles', group: 'Market Intelligence', keywords: 'weights strategy' },
  { href: '/app/market/sources', label: 'Sources and methodology', group: 'Market Intelligence' },
  { href: '/app/settings/members', label: 'Members and roles', group: 'Administration', keywords: 'team invite' },
  { href: '/app/settings/audit', label: 'Audit log', group: 'Administration', keywords: 'history events' },
];

const LABELS: Record<string, string> = {
  app: 'Command center', market: 'Market Intelligence', underwrite: 'Underwrite', new: 'New analysis', settings: 'Settings', members: 'Members', audit: 'Audit log',
  compare: 'Compare', regulatory: 'Regulatory Index', property: 'Undervaluation evidence', watchlists: 'Monitoring', profiles: 'Score profiles', sources: 'Sources & method', area: 'Area',
};

export function breadcrumbs(path: string): { href: string; label: string }[] {
  const parts = path.split('/').filter(Boolean);
  const out: { href: string; label: string }[] = [];
  let acc = '';
  let prev = '';
  for (const p of parts) {
    acc += `/${p}`;
    const after = prev;
    prev = p;
    if (p === 'settings' || p === 'area' || (p === 'app' && parts.length > 1)) continue;
    const label = after === 'area' ? 'Area profile' : LABELS[p] ?? (/^[0-9a-f-]{36}$/i.test(p) ? 'Report' : decodeURIComponent(p));
    out.push({ href: acc, label });
  }
  return out;
}
