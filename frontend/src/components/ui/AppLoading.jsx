import { LogoMark } from './Logo'
import { LottieLoader } from './LottieLoader'

/**
 * Full-screen loading screen shown while a signed-in user's session and data are opened.
 * Signed-out visitors never see it: their state is known synchronously and they go straight to the page.
 * It matches the CSS-only boot screen in index.html so the hand-over is seamless.
 */
export function AppLoading({ label = 'Opening your diary' }) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-canvas">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,color-mix(in_srgb,var(--color-primary)_16%,transparent),transparent_60%)]"
        aria-hidden
      />
      <div className="loading-fade relative grid place-items-center">
        <LottieLoader size={168} label={label} />
        <LogoMark size={44} className="absolute drop-shadow-lg" title="" />
      </div>
    </div>
  )
}
