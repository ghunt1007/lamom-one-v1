import { describe, it, expect } from 'vitest'
import { cosineSimilarity, topChunks, RAG_SOURCE_COLLECTIONS } from './rag.js'

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1)
  })

  it('returns -1 (never a false match) when lengths differ', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(-1)
  })

  it('returns -1 for missing/null vectors instead of throwing', () => {
    expect(cosineSimilarity(null, [1, 2])).toBe(-1)
    expect(cosineSimilarity(undefined, undefined)).toBe(-1)
  })

  it('returns -1 for a zero vector (division by zero guarded)', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(-1)
  })
})

describe('RAG_SOURCE_COLLECTIONS', () => {
  it('only lists internal knowledge collections — no customer/PII data in this phase', () => {
    expect(RAG_SOURCE_COLLECTIONS).toEqual(
      expect.arrayContaining(['sop_documents', 'kb_articles', 'product_knowledge', 'legal_references'])
    )
    expect(RAG_SOURCE_COLLECTIONS).not.toContain('customers')
    expect(RAG_SOURCE_COLLECTIONS).not.toContain('bookings')
  })
})

describe('topChunks', () => {
  const chunks = [
    { text: 'SOP ส่งมอบรถ', embedding: [1, 0, 0] },
    { text: 'สเปค DEEPAL S07', embedding: [0.9, 0.1, 0] },
    { text: 'กฎหมาย PDPA', embedding: [0, 0, 1] },
    { text: 'ไม่มี embedding' },
  ]
  it('ranks by similarity, drops unrelated and broken chunks', () => {
    expect(topChunks([1, 0, 0], chunks)).toEqual(['SOP ส่งมอบรถ', 'สเปค DEEPAL S07'])
  })
  it('respects topK', () => {
    expect(topChunks([1, 0, 0], chunks, 1)).toEqual(['SOP ส่งมอบรถ'])
  })
})
