import { describe, it, expect, vi } from 'vitest'
vi.mock('../../core/db.js', () => ({ getSalesData: async () => [] }))
vi.mock('../../core/store.js', () => ({ showToast: () => {} }))
vi.mock('../../utils/modal.js', () => ({ openModal: () => {} }))
vi.mock('../../utils/importExport.js', () => ({ exportToExcel: () => {}, exportToCSV: () => {} }))
import { modelsFromSales } from './ModelProfitability.js'

describe('modelsFromSales', () => {
  it('builds models only from sold rows with a price', () => {
    const r = modelsFromSales([
      { model: 'S07', brand: 'Deepal', delivered: true, salePrice: 1000000, cost: 900000, comFinance: 20000 },
      { model: 'S07', brand: 'Deepal', delivered: true, salePrice: 1200000, cost: 1000000, comFinance: 0 },
      { model: 'S07', delivered: false, salePrice: 999 },
      { model: 'L07', delivered: true, salePrice: 0 },
    ])
    expect(r).toEqual([{ model: 'S07', brand: 'Deepal', sold: 2, avgPrice: 1100000, avgCost: 950000, finance: 10000 }])
  })
})
