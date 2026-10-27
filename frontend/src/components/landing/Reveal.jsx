import { useEffect, useRef, useState } from 'react'
import { cn } from '../../utils/format'

/** Fades/slides children in once when they scroll into view. Shows immediately for reduced motion. */
export function Reveal({ children, delay = 0, className, as: Tag = 'div', y = 24 }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return setShown(true)
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setShown(true)
        io.disconnect()
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  return (
    <Tag
      ref={ref}
      className={cn('transition-all duration-700 ease-out will-change-transform', shown ? 'translate-y-0 opacity-100' : 'opacity-0', className)}
      style={{ transitionDelay: `${delay}ms`, transform: shown ? undefined : `translateY(${y}px)` }}
    >
      {children}
    </Tag>
  )
}

/** Counts up to `to` when visible. */
export function CountUp({ to, suffix = '', prefix = '', duration = 1400, decimals = 0 }) {
  const ref = useRef(null)
  const [v, setV] = useState(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return setV(to)
    let raf
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const t0 = performance.now()
      const step = (now) => {
        const k = Math.min(1, (now - t0) / duration)
        setV(to * (1 - Math.pow(1 - k, 3)))
        if (k < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, { threshold: 0.4 })
    io.observe(ref.current)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [to, duration])
  return <span ref={ref}>{prefix}{v.toFixed(decimals)}{suffix}</span>
}
