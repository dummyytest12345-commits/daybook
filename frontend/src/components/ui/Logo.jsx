import { BRAND } from '../../brand'

/** Brand mark as inline SVG (same artwork as public/favicon.svg): an open daybook with a check. */
export function LogoMark({ size = 32, className, title = `${BRAND.name} logo` }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id="db-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c83ff" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#db-g)" />
      <path d="M13 19.5c6.5-2.6 13-2.2 19 1.5v27c-6-3.7-12.5-4.1-19-1.5z" fill="#fff" opacity=".92" />
      <path d="M51 19.5c-6.5-2.6-13-2.2-19 1.5v27c6-3.7 12.5-4.1 19-1.5z" fill="#fff" />
      <path d="M18 28.5h8M18 34h8M18 39.5h6" stroke="#a5b4fc" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M37.5 33.5l4.2 4.2 7-8.5" fill="none" stroke="#4f46e5" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ collapsed, className = '' }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <LogoMark size={32} className="shrink-0" />
      {!collapsed && <span className="text-[15px] font-bold tracking-tight">{BRAND.name}</span>}
    </span>
  )
}
