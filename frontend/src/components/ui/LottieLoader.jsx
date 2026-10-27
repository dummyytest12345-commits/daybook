import { useEffect, useRef } from 'react'
import { buildLoaderAnimation } from '../../lottie/loader'

/**
 * Lottie loading animation (lottie-web light player, loaded on demand). Respects reduced motion
 * by showing a still frame. `label` is read by screen readers; nothing is shown as visible text.
 */
export function LottieLoader({ size = 96, primary = '#6366f1', secondary = '#22d3ee', label = 'Loading', className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    let anim
    let cancelled = false
    import('lottie-web/build/player/lottie_light').then((m) => {
      if (cancelled || !ref.current) return
      const lottie = m.default || m
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      anim = lottie.loadAnimation({
        container: ref.current,
        renderer: 'svg',
        loop: true,
        autoplay: !reduce,
        animationData: buildLoaderAnimation(primary, secondary),
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet', progressiveLoad: false },
      })
      if (reduce) anim.goToAndStop(50, true)
    })
    return () => {
      cancelled = true
      anim?.destroy()
    }
  }, [primary, secondary])

  return (
    <span role="status" aria-live="polite" aria-label={label} className={`inline-block ${className}`} style={{ width: size, height: size }}>
      <span ref={ref} data-lottie="loader" className="block size-full" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}
