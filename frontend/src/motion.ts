export type Vec = { x: number; y: number }

export type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  ox: number
  oy: number
  life: number
  size: number
  hue: number
}

export function springStep(
  pos: number,
  vel: number,
  target: number,
  dt: number,
  stiffness = 140,
  damping = 18,
): { pos: number; vel: number } {
  const accel = (target - pos) * stiffness - vel * damping
  const nextVel = vel + accel * dt
  return { pos: pos + nextVel * dt, vel: nextVel }
}

export function magneticOffset(from: Vec, pointer: Vec, radius: number, strength: number): Vec {
  const dx = pointer.x - from.x
  const dy = pointer.y - from.y
  const dist = Math.hypot(dx, dy)
  if (dist === 0 || dist > radius) return { x: 0, y: 0 }
  const falloff = (1 - dist / radius) ** 2
  return { x: (dx / dist) * strength * falloff, y: (dy / dist) * strength * falloff }
}

export function cardTilt(from: Vec, pointer: Vec, maxDeg = 7, radius = 280): { rx: number; ry: number } {
  const dx = (pointer.x - from.x) / radius
  const dy = (pointer.y - from.y) / radius
  const clamp = (n: number) => Math.max(-1, Math.min(1, n))
  return { rx: clamp(-dy) * maxDeg, ry: clamp(dx) * maxDeg }
}

export function createParticles(count: number, width: number, height: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const x = ((i * 97) % Math.max(width, 1)) + (i % 7) * 11
    const y = ((i * 53) % Math.max(height, 1)) + (i % 5) * 17
    return {
      x,
      y,
      vx: 0,
      vy: 0,
      ox: (i % 19) - 9,
      oy: (i % 13) - 6,
      life: 0.35 + (i % 8) * 0.08,
      size: 1.1 + (i % 5) * 0.55,
      hue: i % 3,
    }
  })
}

export function stepParticle(particle: Particle, pointer: Vec, dt: number, bounds: { w: number; h: number }): Particle {
  const targetX = pointer.x + particle.ox * 14
  const targetY = pointer.y + particle.oy * 14
  const sx = springStep(particle.x, particle.vx, targetX, dt, 28 + particle.hue * 8, 6.5)
  const sy = springStep(particle.y, particle.vy, targetY, dt, 28 + particle.hue * 8, 6.5)
  let { pos: x, vel: vx } = sx
  let { pos: y, vel: vy } = sy
  if (x < -40) x = bounds.w + 20
  if (x > bounds.w + 40) x = -20
  if (y < -40) y = bounds.h + 20
  if (y > bounds.h + 40) y = -20
  return { ...particle, x, y, vx, vy }
}

export function stepScene(
  particles: Particle[],
  pointer: Vec,
  dt: number,
  bounds: { w: number; h: number },
): Particle[] {
  const clamped = Math.min(Math.max(dt, 0.008), 0.033)
  return particles.map((p) => stepParticle(p, pointer, clamped, bounds))
}

export function particleColor(hue: number, alpha = 0.72): string {
  if (hue === 0) return `rgba(226, 58, 40, ${alpha})`
  if (hue === 1) return `rgba(201, 162, 39, ${alpha})`
  return `rgba(212, 255, 74, ${alpha})`
}

export function cursorRing(current: Vec, velocity: Vec, pointer: Vec, dt: number): { pos: Vec; vel: Vec } {
  const x = springStep(current.x, velocity.x, pointer.x, dt, 220, 22)
  const y = springStep(current.y, velocity.y, pointer.y, dt, 220, 22)
  return { pos: { x: x.pos, y: y.pos }, vel: { x: x.vel, y: y.vel } }
}
