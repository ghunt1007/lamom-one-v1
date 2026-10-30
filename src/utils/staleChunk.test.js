import { describe, it, expect } from 'vitest'
import { isStaleChunkError } from './staleChunk.js'

describe('isStaleChunkError', () => {
  it('จับ error โหลดโมดูลหลัง deploy ได้ทุกเบราว์เซอร์', () => {
    expect(isStaleChunkError('Failed to fetch dynamically imported module: https://x/assets/exceljs.min-B2g.js')).toBe(true)
    expect(isStaleChunkError('Importing a module script failed.')).toBe(true)
    expect(isStaleChunkError('error loading dynamically imported module')).toBe(true)
    expect(isStaleChunkError('Cannot read properties of undefined')).toBe(false)
  })
})
