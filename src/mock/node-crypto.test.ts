// @vitest-environment node
import { createHash as nodeHash } from 'node:crypto'
import { createHash, randomBytes } from './node-crypto'

describe('in-browser node:crypto', () => {
  it('computes the same SHA-256 as Node', () => {
    const inputs = ['', 'abc', 'st-1:1111', 'ร้านแมว 🐈', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), 'q'.repeat(1000)]
    for (const text of inputs) {
      expect(createHash('sha256').update(text).digest('hex')).toBe(nodeHash('sha256').update(text).digest('hex'))
    }
  })

  it('makes random hex tokens of the asked length', () => {
    const a = randomBytes(24).toString('hex')
    expect(a).toMatch(/^[0-9a-f]{48}$/)
    expect(randomBytes(24).toString('hex')).not.toBe(a)
  })
})
