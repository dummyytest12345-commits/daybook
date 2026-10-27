/** Decorative inline-SVG illustrations (aria-hidden). Colours follow the theme tokens. */
const ink = 'var(--color-line)'

export function EmptyLogIllustration({ className = 'h-28 w-28' }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden fill="none">
      <circle cx="60" cy="62" r="48" fill="var(--color-primary)" opacity=".08" />
      <rect x="30" y="22" width="60" height="78" rx="8" fill="var(--color-surface)" stroke={ink} strokeWidth="2" />
      <rect x="46" y="16" width="28" height="12" rx="6" fill="var(--color-primary)" />
      <g strokeLinecap="round" strokeLinejoin="round" strokeWidth="3">
        <path d="M40 46l4 4 7-8" stroke="var(--color-st-completed)" />
        <path d="M58 46h22" stroke={ink} />
        <path d="M40 66l4 4 7-8" stroke="var(--color-st-completed)" opacity=".5" />
        <path d="M58 66h16" stroke={ink} />
        <circle cx="45" cy="86" r="4.5" stroke="var(--color-st-pending)" />
        <path d="M58 86h20" stroke={ink} />
      </g>
    </svg>
  )
}

export function EmptyChartIllustration({ className = 'h-24 w-24' }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden fill="none">
      <circle cx="60" cy="60" r="48" fill="var(--color-primary)" opacity=".08" />
      <path d="M26 92h68" stroke={ink} strokeWidth="3" strokeLinecap="round" />
      <rect x="34" y="62" width="12" height="30" rx="3" fill="#b7d3f6" />
      <rect x="54" y="44" width="12" height="48" rx="3" fill="#6da7ec" />
      <rect x="74" y="28" width="12" height="64" rx="3" fill="#2a78d6" />
    </svg>
  )
}

/** Hero artwork for the sign-in / register pages. */
export function AuthHero({ className = 'w-full max-w-md' }) {
  return (
    <svg viewBox="0 0 420 320" className={className} aria-hidden fill="none">
      <rect x="20" y="20" width="380" height="280" rx="20" fill="var(--color-surface)" stroke={ink} strokeWidth="2" />
      <rect x="44" y="46" width="332" height="12" rx="6" fill={ink} />
      <rect x="44" y="46" width="230" height="12" rx="6" fill="var(--color-st-completed)" />
      <g strokeLinecap="round" strokeLinejoin="round" strokeWidth="4">
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(0 ${i * 40})`}>
            {i < 2 ? <path d="M52 100l6 6 10-11" stroke="var(--color-st-completed)" /> : <circle cx="58" cy="100" r="7" stroke={i === 2 ? 'var(--color-st-progress)' : 'var(--color-st-pending)'} />}
            <rect x="84" y="94" width={[220, 170, 250, 140][i]} height="12" rx="6" fill={ink} stroke="none" />
          </g>
        ))}
      </g>
      <g transform="translate(44 250)">
        <rect width="40" height="34" rx="4" fill="#b7d3f6" transform="translate(0 -34)" />
        <rect x="56" width="40" height="22" rx="4" fill="#6da7ec" transform="translate(0 -22)" />
        <rect x="112" width="40" height="44" rx="4" fill="#2a78d6" transform="translate(0 -44)" />
        <rect x="168" width="40" height="28" rx="4" fill="#184f95" transform="translate(0 -28)" />
      </g>
      <circle cx="330" cy="240" r="34" stroke={ink} strokeWidth="10" />
      <path d="M330 206a34 34 0 1 1-30 50" stroke="var(--color-primary)" strokeWidth="10" strokeLinecap="round" />
    </svg>
  )
}

export function EmptyProjectsIllustration({ className = 'h-28 w-28' }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden fill="none">
      <circle cx="60" cy="62" r="48" fill="var(--color-primary)" opacity=".08" />
      <rect x="18" y="38" width="84" height="56" rx="10" fill="var(--color-surface)" stroke={ink} strokeWidth="2" />
      <path d="M18 48a10 10 0 0 1 10-10h18l8 8h38a10 10 0 0 1 10 10" stroke={ink} strokeWidth="2" />
      <rect x="30" y="58" width="16" height="26" rx="3" fill="#b7d3f6" />
      <rect x="52" y="58" width="16" height="18" rx="3" fill="#6da7ec" />
      <rect x="74" y="58" width="16" height="22" rx="3" fill="#2a78d6" />
      <circle cx="92" cy="30" r="10" fill="var(--color-primary)" />
      <path d="M92 25v10M87 30h10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
