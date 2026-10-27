/**
 * Builds the Daybook loading animation as Lottie JSON (so colours follow the theme):
 * an outer arc that grows and shrinks while spinning, a counter-rotating inner arc, and a pulsing dot.
 * 200x200, 60 fps, 2 s loop.
 */
const rgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]
}

const still = (k) => ({ a: 0, k })
const ease = { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } }
const linear = { i: { x: [1], y: [1] }, o: { x: [0], y: [0] } }
/** keyframes: [[frame, value], ...] */
const anim = (frames, curve = ease) => ({
  a: 1,
  k: frames.map(([t, v], idx) => (idx < frames.length - 1 ? { t, s: [v], e: [frames[idx + 1][1]], ...curve } : { t, s: [v] })),
})

const transform = (rotation, scale) => ({
  o: still(100),
  r: rotation,
  p: still([100, 100, 0]),
  a: still([0, 0, 0]),
  s: scale || still([100, 100, 100]),
})

const groupTr = { ty: 'tr', p: still([0, 0]), a: still([0, 0]), s: still([100, 100]), r: still(0), o: still(100), sk: still(0), sa: still(0) }

const stroke = (color, width) => ({ ty: 'st', nm: 'Stroke', c: still(rgb(color)), o: still(100), w: still(width), lc: 2, lj: 2, ml: 4, bm: 0 })
const ellipse = (size) => ({ ty: 'el', nm: 'Ellipse', d: 1, s: still([size, size]), p: still([0, 0]) })
const trim = (start, end) => ({ ty: 'tm', nm: 'Trim', s: start, e: end, o: still(0), m: 1 })

const layer = (ind, name, ks, shapes) => ({ ddd: 0, ind, ty: 4, nm: name, sr: 1, ks, ao: 0, shapes, ip: 0, op: 120, st: 0, bm: 0 })

export function buildLoaderAnimation(primary = '#6366f1', secondary = '#22d3ee') {
  const outer = layer(1, 'Outer arc', transform(anim([[0, 0], [120, 720]], linear)), [
    { ty: 'gr', nm: 'Outer', it: [ellipse(120), stroke(primary, 12), trim(anim([[0, 0], [60, 0], [120, 100]]), anim([[0, 0], [60, 100], [120, 100]])), groupTr] },
  ])
  const inner = layer(2, 'Inner arc', transform(anim([[0, 0], [120, -360]], linear)), [
    { ty: 'gr', nm: 'Inner', it: [ellipse(72), stroke(secondary, 8), trim(still(0), still(62)), groupTr] },
  ])
  const dot = layer(3, 'Dot', transform(still(0), anim2([[0, [100, 100, 100]], [30, [135, 135, 100]], [60, [100, 100, 100]], [90, [135, 135, 100]], [120, [100, 100, 100]]])), [
    { ty: 'gr', nm: 'Dot', it: [ellipse(20), { ty: 'fl', nm: 'Fill', c: still(rgb(primary)), o: still(100), r: 1, bm: 0 }, groupTr] },
  ])
  return { v: '5.7.0', fr: 60, ip: 0, op: 120, w: 200, h: 200, nm: 'Daybook loader', ddd: 0, assets: [], layers: [dot, inner, outer] }
}

/** Multi-dimensional keyframes (scale). */
function anim2(frames) {
  return {
    a: 1,
    k: frames.map(([t, v], idx) => (idx < frames.length - 1 ? { t, s: v, e: frames[idx + 1][1], ...ease } : { t, s: v })),
  }
}
