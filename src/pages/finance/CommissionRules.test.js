import { describe, it, expect } from 'vitest'
import { calcCommission, BASE_RULES } from './CommissionRules.js'

const tieredRule = { key: 'tiered_monthly', type: 'tiered', active: true, tiers: [{ from: 1, to: 3, amt: 5000 }, { from: 4, to: 6, amt: 7000 }, { from: 7, to: 99, amt: 10000 }] }
const perUnitRule = { key: 'per_unit_base', type: 'per_unit', active: true, value: 5000 }
const premiumBonusRule = { key: 'premium_bonus', type: 'bonus', active: true, value: 3000 }
const floorPercentRule = { key: 'floor_percent', type: 'percent', base: 'floor', active: true, value: 20 }
const financePercentRule = { key: 'finance_percent', type: 'percent', base: 'finance', active: true, value: 2 }

describe('calcCommission — units (tiered vs per-unit)', () => {
  it('sums per-car amounts across tier boundaries when a tiered rule is active', () => {
    // units 1-3 @5000, units 4-5 @7000 = 15000 + 14000
    const { total, breakdown } = calcCommission({ units: 5 }, [tieredRule])
    expect(total).toBe(29000)
    expect(breakdown).toEqual([['ขั้นบันได (5 คัน)', 29000]])
  })

  it('falls back to flat per-unit pay when there is no active tiered rule', () => {
    const { total, breakdown } = calcCommission({ units: 3 }, [perUnitRule])
    expect(total).toBe(15000)
    expect(breakdown).toEqual([['พื้นฐาน (3 คัน)', 15000]])
  })

  it('prefers the tiered rule over per-unit when both are active', () => {
    const { total } = calcCommission({ units: 5 }, [tieredRule, perUnitRule])
    expect(total).toBe(29000) // tiered result, not 5*5000=25000
  })

  it('contributes nothing when units is 0, even with active rules', () => {
    expect(calcCommission({ units: 0 }, [tieredRule]).total).toBe(0)
    expect(calcCommission({ units: 0 }, [perUnitRule]).total).toBe(0)
  })

  it('contributes nothing from an inactive per-unit rule', () => {
    expect(calcCommission({ units: 3 }, [{ ...perUnitRule, active: false }]).total).toBe(0)
  })
})

describe('calcCommission — premium bonus', () => {
  it('pays per premium unit when the bonus rule is active', () => {
    const { total } = calcCommission({ premiumUnits: 2 }, [premiumBonusRule])
    expect(total).toBe(6000)
  })

  it('pays nothing when there are no premium units', () => {
    expect(calcCommission({ premiumUnits: 0 }, [premiumBonusRule]).total).toBe(0)
  })

  it('pays nothing when the bonus rule is inactive', () => {
    expect(calcCommission({ premiumUnits: 2 }, [{ ...premiumBonusRule, active: false }]).total).toBe(0)
  })
})

describe('calcCommission — percent-based rules', () => {
  it('computes a percentage of the matching base amount', () => {
    const { total } = calcCommission({ overFloor: 100000 }, [floorPercentRule])
    expect(total).toBe(20000)
  })

  it('applies multiple active percent rules against their own bases independently', () => {
    const { total, breakdown } = calcCommission({ overFloor: 100000, financeTotal: 50000 }, [floorPercentRule, financePercentRule])
    expect(total).toBe(21000) // 20000 (floor) + 1000 (finance)
    expect(breakdown).toHaveLength(2)
  })

  it('skips a percent rule when its base amount is zero', () => {
    const { total, breakdown } = calcCommission({ overFloor: 0 }, [floorPercentRule])
    expect(total).toBe(0)
    expect(breakdown).toEqual([])
  })

  it('skips an inactive percent rule', () => {
    expect(calcCommission({ overFloor: 100000 }, [{ ...floorPercentRule, active: false }]).total).toBe(0)
  })

  it('rounds the percent amount to the nearest baht', () => {
    const { total } = calcCommission({ overFloor: 33333 }, [{ ...floorPercentRule, value: 10 }])
    expect(total).toBe(Math.round(33333 * 0.1))
  })
})

describe('calcCommission — combined realistic scenario', () => {
  it('adds up tiered units + premium bonus + floor percent + finance percent together', () => {
    const rules = [tieredRule, premiumBonusRule, floorPercentRule, financePercentRule]
    const { total } = calcCommission({ units: 6, premiumUnits: 2, overFloor: 30000, financeTotal: 20000 }, rules)
    // tiered(6 cars: 5000*3 + 7000*3 = 15000+21000=36000) + bonus(2*3000=6000) + floor(30000*0.2=6000) + finance(20000*0.02=400)
    expect(total).toBe(36000 + 6000 + 6000 + 400)
  })

  it('produces zero total and empty breakdown when given no rules at all', () => {
    const { total, breakdown } = calcCommission({ units: 10, overFloor: 50000 }, [])
    expect(total).toBe(0)
    expect(breakdown).toEqual([])
  })
})

describe('calcCommission — with the real default BASE_RULES config', () => {
  it('excludes insurance/accessory percent rules by default (seeded inactive)', () => {
    const { total } = calcCommission({ insuranceTotal: 100000, accessoryTotal: 100000 }, BASE_RULES)
    expect(total).toBe(0)
  })

  it('a newly-added custom percent rule (no legacy key) is still applied correctly', () => {
    // Regression guard for the v1.0.390 fix: custom rules created via the "+ เพิ่มกติกา"
    // form have no `key` field at all — only type:'percent' rules are matched generically
    // by type, so this must keep working even without a hardcoded key.
    const customRule = { type: 'percent', base: 'accessory', active: true, value: 15, name: 'โบนัสอุปกรณ์พิเศษ' }
    const { total } = calcCommission({ accessoryTotal: 10000 }, [customRule])
    expect(total).toBe(1500)
  })
})
