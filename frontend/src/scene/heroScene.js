import { THREE, createLoop, damp, disposeAll, isLowPower, makeRenderer, observeSize, prefersReducedMotion } from './common'

const CARDS = [
  { title: 'Ship onboarding flow', project: 'WEB-12', color: '#6366f1', hours: '3h', done: true },
  { title: 'Fix checkout bug', project: 'PAY-7', color: '#0891b2', hours: '2h', done: false },
  { title: 'Review consent copy', project: 'LEG-3', color: '#db2777', hours: '1h', done: false },
  { title: 'Write release notes', project: 'DOC-21', color: '#d97706', hours: '1.5h', done: false },
  { title: 'Standup summary', project: 'OPS-9', color: '#059669', hours: '0.5h', done: true },
  { title: 'Plan sprint board', project: 'WEB-14', color: '#7c3aed', hours: '2h', done: false },
  { title: 'Export weekly report', project: 'RPT-2', color: '#2563eb', hours: '1h', done: false },
]

/** Colours for each theme, so the scene looks native on both a light and a dark page. */
const PALETTES = {
  dark: {
    card: '#151c33', cardDone: '#0f2a24', border: 'rgba(148,163,255,.28)', borderDone: 'rgba(52,211,153,.55)',
    title: '#f1f5f9', titleDone: 'rgba(226,232,240,.6)', check: '#a5b4fc', checkDone: '#34d399', checkInk: '#04241c',
    chipText: '#cbd5e1', chipBg: 'rgba(148,163,184,.18)', open: '#fbbf24', openBg: 'rgba(251,191,36,.16)', done: '#34d399', doneBg: 'rgba(52,211,153,.16)',
    shadow: 'rgba(0,0,0,.45)', track: 0x2a3358, trackOpacity: 0.85, glow: ['rgba(129,140,248,.55)', 'rgba(99,102,241,.18)', 'rgba(99,102,241,0)'],
    particles: 0xa5b4fc, particleOpacity: 0.65, checkMark: 0xffffff, ringA: '#818cf8', ringB: '#22d3ee',
  },
  light: {
    card: '#ffffff', cardDone: '#ecfdf5', border: 'rgba(99,102,241,.28)', borderDone: 'rgba(5,150,105,.5)',
    title: '#0f172a', titleDone: 'rgba(15,23,42,.5)', check: '#6366f1', checkDone: '#059669', checkInk: '#ffffff',
    chipText: '#475569', chipBg: 'rgba(100,116,139,.14)', open: '#b45309', openBg: 'rgba(217,119,6,.14)', done: '#047857', doneBg: 'rgba(5,150,105,.14)',
    shadow: 'rgba(30,41,99,.22)', track: 0xdfe3f5, trackOpacity: 1, glow: ['rgba(99,102,241,.32)', 'rgba(99,102,241,.1)', 'rgba(99,102,241,0)'],
    particles: 0x6366f1, particleOpacity: 0.4, checkMark: 0x4f46e5, ringA: '#6366f1', ringB: '#06b6d4',
  },
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Draws one task card to a canvas (the same look as the real app's cards). */
function drawCard(card, done, pal) {
  const W = 640
  const H = 320
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  g.shadowColor = pal.shadow
  g.shadowBlur = 28
  g.shadowOffsetY = 10
  roundRect(g, 24, 20, W - 48, H - 56, 28)
  g.fillStyle = done ? pal.cardDone : pal.card
  g.fill()
  g.shadowColor = 'transparent'
  g.lineWidth = 2
  g.strokeStyle = done ? pal.borderDone : pal.border
  g.stroke()
  roundRect(g, 24, 20, 14, H - 56, 7)
  g.fillStyle = card.color
  g.fill()
  const cx = 92
  const cy = 98
  g.beginPath()
  g.arc(cx, cy, 24, 0, Math.PI * 2)
  g.lineWidth = 4
  g.strokeStyle = done ? pal.checkDone : pal.check
  g.fillStyle = done ? pal.checkDone : 'transparent'
  g.fill()
  g.stroke()
  if (done) {
    g.beginPath()
    g.moveTo(cx - 10, cy + 1)
    g.lineTo(cx - 2, cy + 9)
    g.lineTo(cx + 12, cy - 9)
    g.lineWidth = 6
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.strokeStyle = pal.checkInk
    g.stroke()
  }
  g.font = '600 38px Inter, system-ui, sans-serif'
  g.fillStyle = done ? pal.titleDone : pal.title
  g.textBaseline = 'middle'
  g.fillText(card.title, 140, 98, W - 190)
  if (done) {
    const w = Math.min(g.measureText(card.title).width, W - 190)
    g.fillRect(140, 98, w, 3)
  }
  g.font = '700 26px Inter, system-ui, sans-serif'
  const chip = (x, text, fg, bg) => {
    const w = g.measureText(text).width + 34
    roundRect(g, x, 170, w, 46, 23)
    g.fillStyle = bg
    g.fill()
    g.fillStyle = fg
    g.fillText(text, x + 17, 194)
    return x + w + 12
  }
  let x = 62
  x = chip(x, card.project, card.color, `${card.color}26`)
  x = chip(x, card.hours, pal.chipText, pal.chipBg)
  chip(x, done ? 'Completed' : 'In progress', done ? pal.done : pal.open, done ? pal.doneBg : pal.openBg)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

const RING_VERT = `
  varying vec3 vPos; varying vec3 vNormal;
  void main() { vPos = position; vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const RING_FRAG = `
  uniform float uProgress; uniform vec3 uA; uniform vec3 uB; uniform float uTime;
  varying vec3 vPos; varying vec3 vNormal;
  void main() {
    float a = atan(vPos.x, vPos.y);            // 0 at top, clockwise
    float t = mod(a + 6.2831853, 6.2831853) / 6.2831853;
    if (t > uProgress) discard;
    vec3 col = mix(uA, uB, t);
    float rim = pow(1.0 - abs(vNormal.z), 2.0);
    float pulse = 0.85 + 0.15 * sin(uTime * 2.0 - t * 8.0);
    vec3 lit = col * (0.85 + rim * 1.1) * pulse;
    gl_FragColor = vec4(pow(lit, vec3(1.0 / 2.2)), 1.0);
  }`

/**
 * Hero scene: task cards orbit a progress ring. Cards complete one after another and the ring fills.
 * Click a card to toggle it. `theme` is 'light' | 'dark'. Returns { dispose }.
 */
export function createHeroScene(container, { onProgress, theme = 'dark' } = {}) {
  const pal = PALETTES[theme] || PALETTES.dark
  const reduced = prefersReducedMotion()
  const low = isLowPower()
  const renderer = makeRenderer(container)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60)
  camera.position.set(0, 0.2, 10)

  // --- ring ---
  const ring = new THREE.Group()
  const track = new THREE.Mesh(
    new THREE.TorusGeometry(1.75, 0.1, 24, 160),
    new THREE.MeshBasicMaterial({ color: pal.track, transparent: true, opacity: pal.trackOpacity }),
  )
  const progressMat = new THREE.ShaderMaterial({
    vertexShader: RING_VERT, fragmentShader: RING_FRAG, side: THREE.DoubleSide,
    uniforms: { uProgress: { value: 0 }, uA: { value: new THREE.Color(pal.ringA) }, uB: { value: new THREE.Color(pal.ringB) }, uTime: { value: 0 } },
  })
  const fill = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.14, 24, 200), progressMat)
  ring.add(track, fill)

  const checkCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.62, -0.02, 0), new THREE.Vector3(-0.2, -0.46, 0), new THREE.Vector3(0.66, 0.5, 0)], false, 'catmullrom', 0.05)
  const check = new THREE.Mesh(
    new THREE.TubeGeometry(checkCurve, 40, 0.11, 16, false),
    new THREE.MeshBasicMaterial({ color: pal.checkMark, transparent: true, opacity: 0.95 }),
  )
  ring.add(check)
  const glowTex = (() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')
    const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128)
    gr.addColorStop(0, pal.glow[0])
    gr.addColorStop(0.5, pal.glow[1])
    gr.addColorStop(1, pal.glow[2])
    g.fillStyle = gr
    g.fillRect(0, 0, 256, 256)
    return new THREE.CanvasTexture(c)
  })()
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false }))
  glow.position.z = -1.2
  scene.add(glow, ring)

  // --- cards ---
  const cardGroup = new THREE.Group()
  scene.add(cardGroup)
  const geo = new THREE.PlaneGeometry(3, 1.5)
  const cards = CARDS.map((data, i) => {
    const texDone = drawCard(data, true, pal)
    const texOpen = drawCard(data, false, pal)
    const mat = new THREE.MeshBasicMaterial({ map: data.done ? texDone : texOpen, transparent: true, depthWrite: false })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.userData = { i, data: { ...data }, texDone, texOpen, pulse: 0 }
    cardGroup.add(mesh)
    return mesh
  })
  const placement = (i, angle) => {
    const n = CARDS.length
    const a = angle + (i / n) * Math.PI * 2
    return { x: Math.cos(a) * 3.5, y: Math.sin(a) * 1.5 + Math.sin(a * 2 + i) * 0.28, z: Math.sin(a) * 2 - 0.6, a }
  }

  // --- particles ---
  const count = low ? 140 : 380
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 20
    pos[i * 3 + 1] = (Math.random() - 0.5) * 11
    pos[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2
  }
  const pGeo = new THREE.BufferGeometry()
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: pal.particles, size: 0.045, transparent: true, opacity: pal.particleOpacity, depthWrite: false, sizeAttenuation: true }))
  scene.add(points)

  // --- state ---
  const mouse = { x: 0, y: 0 }
  let progress = 0
  let autoTimer = 0
  let interacted = 0
  let angle = 0
  let baseZ = 10
  const doneCount = () => cards.filter((c) => c.userData.data.done).length
  const setDone = (mesh, done) => {
    mesh.userData.data.done = done
    mesh.material.map = done ? mesh.userData.texDone : mesh.userData.texOpen
    mesh.material.needsUpdate = true
    mesh.userData.pulse = 1
  }

  const onMove = (e) => {
    const r = container.getBoundingClientRect()
    mouse.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2))
    mouse.y = Math.max(-1, Math.min(1, -((e.clientY - r.top) / r.height - 0.5) * 2))
  }
  window.addEventListener('pointermove', onMove, { passive: true })

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const pick = (e) => {
    const r = container.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    return raycaster.intersectObjects(cards, false)[0]?.object
  }
  const onClick = (e) => {
    const hit = pick(e)
    if (!hit) return
    interacted = 6
    setDone(hit, !hit.userData.data.done)
    if (reduced) renderStill()
  }
  const onHover = (e) => {
    container.style.cursor = pick(e) ? 'pointer' : 'default'
  }
  container.addEventListener('click', onClick)
  container.addEventListener('pointermove', onHover, { passive: true })

  const frame = (dt, t) => {
    angle += dt * 0.16
    autoTimer += dt
    interacted = Math.max(0, interacted - dt)
    if (!reduced && interacted === 0 && autoTimer > 2.4) {
      autoTimer = 0
      const open = cards.filter((c) => !c.userData.data.done)
      if (open.length) setDone(open[0], true)
      else cards.forEach((c, i) => i % 3 !== 0 && setDone(c, false)) // restart the story
    }
    const target = doneCount() / cards.length
    progress = damp(progress, target, 4, dt)
    progressMat.uniforms.uProgress.value = Math.min(1, progress + 0.002)
    progressMat.uniforms.uTime.value = t
    onProgress?.(target)

    cards.forEach((m) => {
      const { i } = m.userData
      const p = placement(i, angle)
      m.position.set(p.x, p.y + Math.sin(t * 0.9 + i * 1.7) * 0.12, p.z)
      const depth = (p.z + 2.8) / 5 // 0 back .. 1 front
      m.scale.setScalar(0.72 + depth * 0.4 + m.userData.pulse * 0.12)
      m.material.opacity = 0.35 + depth * 0.65
      m.rotation.y = -p.x * 0.05 + mouse.x * 0.12
      m.rotation.x = mouse.y * 0.06
      m.rotation.z = Math.sin(t * 0.5 + i) * 0.035
      m.renderOrder = Math.round(depth * 10)
      m.userData.pulse = damp(m.userData.pulse, 0, 6, dt)
    })

    ring.rotation.y = Math.sin(t * 0.35) * 0.25 + mouse.x * 0.22
    ring.rotation.x = -mouse.y * 0.16 + Math.sin(t * 0.27) * 0.08
    ring.position.y = Math.sin(t * 0.8) * 0.06
    glow.material.opacity = 0.85 + Math.sin(t * 1.3) * 0.12
    points.rotation.y += dt * 0.02
    points.rotation.x = mouse.y * 0.04
    camera.position.x = damp(camera.position.x, mouse.x * 0.6, 3, dt)
    camera.position.y = damp(camera.position.y, 0.2 + mouse.y * 0.35, 3, dt)
    camera.position.z = baseZ
    camera.lookAt(0, 0, 0)
    renderer.render(scene, camera)
  }

  const renderStill = () => {
    cards.forEach((c, i) => setDone(c, i % 3 !== 1))
    progress = doneCount() / cards.length
    progressMat.uniforms.uProgress.value = progress
    frame(0, 1.2)
  }

  const unobserve = observeSize(container, renderer, camera, (w, h) => {
    // fit the whole orbit (half-width ~5 units) into the view for any aspect ratio
    const tan = Math.tan((camera.fov * Math.PI) / 360)
    baseZ = Math.max(8.5, 5.2 / (tan * (w / h)))
    camera.position.z = baseZ
    if (reduced) renderStill()
  })
  const loop = createLoop(container, frame, { reduced })
  if (reduced) renderStill()

  return {
    dispose() {
      loop.stop()
      unobserve()
      window.removeEventListener('pointermove', onMove)
      container.removeEventListener('click', onClick)
      container.removeEventListener('pointermove', onHover)
      glowTex.dispose()
      disposeAll(scene, renderer)
    },
  }
}
