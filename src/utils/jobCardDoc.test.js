import { describe, it, expect } from 'vitest'
import { jobCardHtml } from './jobCardDoc.js'

describe('jobCardHtml', () => {
  it('shows job, car, labor, DD/MM date and escapes text', () => {
    const h = jobCardHtml({ jobNo: 'JOB-2026-012', custName: 'สมชาย <x>', phone: '0800000000', brand: 'DEEPAL', model: 'S07', plate: 'กข 1234', mileage: 12500, createdAt: '2026-11-23T03:00:00Z', desc: 'เช็คระยะ', parts: ['ไส้กรองแอร์'], labor: 1500, techName: 'ช่างเอ' }, { typeLabel: '🔧 เข้าศูนย์บริการ', statusLabel: '🔑 รับรถแล้ว' })
    expect(h).toContain('ใบรับรถ / ใบสั่งงานซ่อม')
    expect(h).toContain('JOB-2026-012')
    expect(h).toContain('สมชาย &lt;x&gt;')
    expect(h).toContain('12,500 กม.')
    expect(h).toContain('1,500')
    expect(h).toContain('ไส้กรองแอร์')
    expect(h).toContain('>เข้าศูนย์บริการ<')
    expect(h).toMatch(/23\/11\/(2026|2569)/)
  })
})
