/**
 * Northstar symbol: an original four-point navigational mark. The north point is extended and set in
 * Signal Blue; the four tips are joined by a hairline circuit to suggest connected data.
 */
export function NorthstarMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 2 L25 17 L16 27 L7 17 Z" fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="0.75" />
      <path d="M16 2 L18.2 14.8 L16 17 L13.8 14.8 Z" fill="#5689FF" />
      <path d="M25 17 L18.2 19.2 L16 17 L18.2 14.8 Z" fill="currentColor" fillOpacity="0.9" />
      <path d="M16 27 L13.8 19.2 L16 17 L18.2 19.2 Z" fill="currentColor" fillOpacity="0.55" />
      <path d="M7 17 L13.8 14.8 L16 17 L13.8 19.2 Z" fill="currentColor" fillOpacity="0.9" />
      <circle cx="16" cy="2" r="1.1" fill="#5689FF" />
      <circle cx="25" cy="17" r="0.8" fill="currentColor" />
      <circle cx="16" cy="27" r="0.8" fill="currentColor" fillOpacity="0.6" />
      <circle cx="7" cy="17" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function NorthstarWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-titanium">
      <NorthstarMark size={compact ? 22 : 26} />
      <span className="leading-none">
        <span className="block text-[13px] font-semibold tracking-[0.22em]">NORTHSTAR</span>
        {!compact && <span className="mt-1 block font-mono text-[9.5px] tracking-[0.32em] text-muted">INTELLIGENCE</span>}
      </span>
    </span>
  );
}
