/**
 * Northstar mark: a four-point north-oriented star formed by two offset chevrons over a node lattice —
 * navigation (north), connected data (nodes), structured intelligence (grid). Original geometry.
 */
export function NorthstarMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2 L19.2 12.8 L16 11 L12.8 12.8 Z" fill="#5689FF" />
      <path d="M16 30 L12.8 19.2 L16 21 L19.2 19.2 Z" fill="#DCE4EE" opacity="0.55" />
      <path d="M2 16 L12.8 12.8 L11 16 L12.8 19.2 Z" fill="#DCE4EE" opacity="0.8" />
      <path d="M30 16 L19.2 19.2 L21 16 L19.2 12.8 Z" fill="#DCE4EE" opacity="0.8" />
      <circle cx="16" cy="16" r="2.2" fill="#F7F9FC" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <NorthstarMark />
      <div className="leading-none">
        <div className="text-[13px] font-semibold tracking-[0.22em] text-arctic">NORTHSTAR</div>
        <div className="mt-1 text-[9.5px] font-medium tracking-[0.34em] text-muted">INTELLIGENCE</div>
      </div>
    </div>
  );
}
