import * as THREE from 'three'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch {
    return false
  }
}

/** Phones and low-core devices get fewer particles and a lower pixel ratio. */
export const isLowPower = () =>
  typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 8) <= 4 || window.innerWidth < 640

export function makeRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isLowPower() ? 1.5 : 2))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const el = renderer.domElement
  el.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y'
  container.appendChild(el)
  return renderer
}

/**
 * Runs `frame(dt, t)` with requestAnimationFrame only while the container is on screen and the
 * tab is visible. Returns { stop, renderOnce, isRunning }.
 */
export function createLoop(container, frame, { reduced = false } = {}) {
  let raf = 0
  let visible = true
  let last = performance.now()
  let t = 0
  let stopped = false

  const tick = (now) => {
    raf = 0
    if (stopped || !visible || document.hidden) return
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    t += dt
    frame(dt, t)
    raf = requestAnimationFrame(tick)
  }
  const start = () => {
    if (reduced || raf || stopped || !visible || document.hidden) return
    last = performance.now()
    raf = requestAnimationFrame(tick)
  }
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
    if (visible) start()
    else if (raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }, { threshold: 0.01 })
  io.observe(container)
  const onVis = () => (document.hidden ? raf && (cancelAnimationFrame(raf), (raf = 0)) : start())
  document.addEventListener('visibilitychange', onVis)
  start()

  return {
    renderOnce: () => frame(0.016, t),
    stop() {
      stopped = true
      if (raf) cancelAnimationFrame(raf)
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    },
  }
}

/** Keep the renderer and camera in sync with the container size. */
export function observeSize(container, renderer, camera, onResize) {
  const fit = () => {
    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    onResize?.(w, h)
  }
  const ro = new ResizeObserver(fit)
  ro.observe(container)
  fit()
  return () => ro.disconnect()
}

/** Dispose every geometry, material and texture under an object, then the renderer. */
export function disposeAll(scene, renderer) {
  scene.traverse((o) => {
    o.geometry?.dispose?.()
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
    mats.forEach((m) => {
      Object.values(m).forEach((v) => v?.isTexture && v.dispose())
      m.dispose()
    })
  })
  renderer.dispose()
  renderer.forceContextLoss()
  renderer.domElement.remove()
}

export const lerp = (a, b, t) => a + (b - a) * t
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))
export { THREE }
