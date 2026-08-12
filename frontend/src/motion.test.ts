import { describe, expect, it } from 'vitest'
import { cardTilt, createParticles, cursorRing, magneticOffset, particleColor, springStep, stepScene } from './motion'

describe('shipped motion helpers', () => {
  it('springs a value toward the target', () => {
    let pos = 0
    let vel = 0
    for (let i = 0; i < 80; i += 1) {
      const next = springStep(pos, vel, 100, 1 / 60)
      pos = next.pos
      vel = next.vel
    }
    expect(pos).toBeGreaterThan(80)
    expect(pos).toBeLessThan(120)
  })

  it('computes a magnetic pull inside the radius', () => {
    const inside = magneticOffset({ x: 0, y: 0 }, { x: 20, y: 0 }, 80, 12)
    const outside = magneticOffset({ x: 0, y: 0 }, { x: 200, y: 0 }, 80, 12)
    expect(inside.x).toBeGreaterThan(0)
    expect(outside.x).toBe(0)
    expect(outside.y).toBe(0)
  })

  it('tilts a card toward the pointer', () => {
    const tilt = cardTilt({ x: 0, y: 0 }, { x: 80, y: -40 })
    expect(tilt.ry).toBeGreaterThan(0)
    expect(tilt.rx).toBeGreaterThan(0)
  })

  it('steps the canvas particle scene from time and pointer', () => {
    const start = createParticles(8, 400, 300)
    const next = stepScene(start, { x: 200, y: 150 }, 1 / 60, { w: 400, h: 300 })
    expect(next).toHaveLength(8)
    expect(next.some((p, i) => p.x !== start[i].x || p.y !== start[i].y)).toBe(true)
    expect(particleColor(0)).toContain('226')
    const ring = cursorRing({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 40, y: 10 }, 1 / 60)
    expect(ring.pos.x).toBeGreaterThan(0)
  })
})
