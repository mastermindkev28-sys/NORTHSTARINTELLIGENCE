/** Minimal stroked icon set (24px grid, 1.6 stroke) drawn for Northstar. */
type P = { size?: number; className?: string };

function I({ size = 16, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  );
}

export const IconCommand = (p: P) => <I {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 17.5h7M17.5 14v7" /></I>;
export const IconTarget = (p: P) => <I {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></I>;
export const IconGlobe = (p: P) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" /></I>;
export const IconCalc = (p: P) => <I {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8.5 7h7M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5v3M8.5 17.5h.01M12 17.5h.01" /></I>;
export const IconShield = (p: P) => <I {...p}><path d="M12 3l7 3v5.5c0 4.2-2.9 7.9-7 9.5-4.1-1.6-7-5.3-7-9.5V6z" /><path d="M9 12l2 2 4-4" /></I>;
export const IconFile = (p: P) => <I {...p}><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></I>;
export const IconBriefcase = (p: P) => <I {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 12.5h18" /></I>;
export const IconUsers = (p: P) => <I {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c1.8.8 3 2.6 3.5 5.2" /></I>;
export const IconLog = (p: P) => <I {...p}><path d="M4 6h16M4 12h10M4 18h13" /><circle cx="19" cy="12" r="1.5" /></I>;
export const IconSearch = (p: P) => <I {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></I>;
export const IconArrowRight = (p: P) => <I {...p}><path d="M5 12h14M13 6l6 6-6 6" /></I>;
export const IconArrowUpRight = (p: P) => <I {...p}><path d="M7 17L17 7M8 7h9v9" /></I>;
export const IconPlus = (p: P) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
export const IconLock = (p: P) => <I {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></I>;
export const IconPulse = (p: P) => <I {...p}><path d="M3 12h4l2.5-6 5 12 2.5-6h4" /></I>;
export const IconLayers = (p: P) => <I {...p}><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></I>;
export const IconScale = (p: P) => <I {...p}><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3.5 3.5 0 006 0zM19 7l-3 7a3.5 3.5 0 006 0z" /></I>;
export const IconSpark = (p: P) => <I {...p}><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" /></I>;
export const IconCheck = (p: P) => <I {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></I>;
export const IconFingerprint = (p: P) => <I {...p}><path d="M6.5 7.5A7 7 0 0119 12v1M5 12a7 7 0 01.4-2.4M8.5 20c.8-1.8 1.2-4 1.2-6.2a2.3 2.3 0 014.6 0c0 1.2-.1 2.4-.3 3.5M12 13.8c0 3-.8 5.4-2 7.2M16.5 15.5c-.2 1.7-.6 3.3-1.2 4.8" /></I>;
export const IconBolt = (p: P) => <I {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></I>;
export const IconEye = (p: P) => <I {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></I>;
export const IconBell = (p: P) => <I {...p}><path d="M6 9a6 6 0 0112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2.2 2.2 0 004 0" /></I>;
export const IconSliders = (p: P) => <I {...p}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></I>;
export const IconBook = (p: P) => <I {...p}><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5zM4 20.5A2.5 2.5 0 006.5 23H20v-5" /></I>;
export const IconCompare = (p: P) => <I {...p}><rect x="3" y="4" width="7" height="16" rx="1.5" /><rect x="14" y="4" width="7" height="16" rx="1.5" /></I>;
export const IconLogout = (p: P) => <I {...p}><path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l-5-5 5-5M5 12h11" /></I>;
