import { describe, it, expect } from 'vitest'
import { loanerAgreementHtml } from './loanerDoc.js'

describe('loanerAgreementHtml', () => {
  it('shows borrower, car, DD/MM dates, deposit; blanks for return when active', () => {
    const h = loanerAgreementHtml({ custName: 'สมชาย <x>', carModel: 'BYD Dolphin', carPlate: 'กข 1', loanDate: '2026-11-23', returnDate: '2026-11-25', kmOut: 12000, fuelOut: 90, deposit: 5000, status: 'active', jobCard: 'JOB-2026-001' })
    expect(h).toContain('ใบยืมรถสำรอง')
    expect(h).toContain('สมชาย &lt;x&gt;')
    expect(h).toMatch(/25\/11\/(2026|2569)/)
    expect(h).toContain('5,000 บาท')
    expect(h).toContain('12,000 กม.')
    expect(h).toContain('________ %')
    expect(h).not.toContain('2026-11-25')
  })
  it('fills return values when returned', () => {
    const h = loanerAgreementHtml({ custName: 'ก', status: 'returned', actualReturn: '2026-11-24', kmIn: 12100, fuelIn: 70 })
    expect(h).toContain('12,100 กม.')
    expect(h).toContain('70%')
  })
})
