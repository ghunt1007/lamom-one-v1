import { describe, it, expect } from 'vitest'
import { iconTitle } from './iconTitles.js'

const btn = (text, { id = '', className = '', title = '' } = {}) => ({ textContent: text, id, className, title, getAttribute: () => null })

describe('iconTitle', () => {
  it('labels icon-only buttons by class name first, then by icon', () => {
    expect(iconTitle(btn('✅', { className: 'btn approve-btn' }))).toBe('อนุมัติ')
    expect(iconTitle(btn('❌', { className: 'btn reject-btn' }))).toBe('ไม่อนุมัติ')
    expect(iconTitle(btn('✏️', { className: 'btn btn-ghost' }))).toBe('แก้ไข')
    expect(iconTitle(btn('◀', { id: 'prev-day' }))).toBe('ก่อนหน้า')
    expect(iconTitle(btn('🗑'))).toBe('ลบ')
  })
  it('leaves buttons with words, titles or unknown icons alone', () => {
    expect(iconTitle(btn('✏️ แก้ไข'))).toBe('')
    expect(iconTitle(btn('✏️', { title: 'x' }))).toBe('')
    expect(iconTitle(btn('📱'))).toBe('')
    expect(iconTitle(btn(''))).toBe('')
  })
})

describe('iconTitle name matching', () => {
  it('does not mistake model/address for delete/add', () => {
    expect(iconTitle(btn('🚗', { className: 'btn model-btn' }))).toBe('')
    expect(iconTitle(btn('📱', { className: 'btn address-pick' }))).toBe('')
    expect(iconTitle(btn('✕', { className: 'vehicle-remove' }))).toBe('ลบ/เอาออก')
    expect(iconTitle(btn('+', { className: 'btn add-item-btn' }))).toBe('เพิ่ม')
  })
})
describe('iconTitle word boundaries', () => {
  it('matches only whole words', () => {
    expect(iconTitle(btn('🚚', { className: 'btn delivery-btn' }))).toBe('')
    expect(iconTitle(btn('▶', { id: 'next-slide-btn' }))).toBe('ถัดไป')
    expect(iconTitle(btn('⏭', { className: 'btn fu-skip-btn' }))).toBe('ข้าม')
  })
})
