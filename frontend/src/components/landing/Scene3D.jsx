import { useEffect, useRef, useState } from 'react'
import { webglAvailable } from '../../scene/common'

/**
 * Mounts a three.js scene lazily (separate chunk) and cleans it up on unmount.
 * `create(container)` must return { dispose, ... }. Falls back to `fallback` when WebGL is missing or fails.
 */
export function Scene3D({ create, fallback, className = '', label, onReady }) {
  const ref = useRef(null)
  const createRef = useRef(create)
  const readyRef = useRef(onReady)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!webglAvailable()) {
      setFailed(true)
      return
    }
    let handle
    let cancelled = false
    createRef
      .current(ref.current)
      .then((h) => {
        if (cancelled) h.dispose()
        else {
          handle = h
          readyRef.current?.(h)
        }
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      handle?.dispose()
    }
  }, [])

  if (failed) return <div className={className}>{fallback}</div>
  return <div ref={ref} className={className} role="img" aria-label={label} />
}
