import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')
const light = css.match(/\[data-theme='light'\] \{([\s\S]*?)\n\}/)?.[1] || ''

function hexToken(name: string): string {
  return new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(light)?.[1] || ''
}

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)!.map((part) => parseInt(part, 16) / 255)
  const [r, g, b] = channels.map((value) => (
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

describe('mineral light theme', () => {
  it('uses the approved layered surfaces', () => {
    expect(hexToken('void')).toBe('#d9ded8')
    expect(hexToken('ink')).toBe('#e7eae4')
    expect(hexToken('surface-raised')).toBe('#f0f1ec')
    expect(hexToken('surface-code')).toBe('#171c19')
  })

  it('keeps reading and code contrast above WCAG AA', () => {
    expect(contrast(hexToken('paper'), hexToken('void'))).toBeGreaterThan(7)
    expect(contrast(hexToken('paper-dim'), hexToken('ink'))).toBeGreaterThan(4.5)
    expect(contrast(hexToken('code-text'), hexToken('surface-code'))).toBeGreaterThan(4.5)
  })
})
