// (v1.0.1381) โหลดข้อมูลที่ตัวคาดการณ์ส่งมอบต้องใช้ (ใบจอง รถ ใบสั่งรถ เป้า) — แยกจาก deliveryForecast.js ที่เป็นฟังก์ชันล้วน
import { listDocs } from '../core/db.js'
import { companyScopeFilters } from '../core/companyScope.js'
import { loadSalesBudget } from './salesBudget.js'
import { todayBangkok } from './format.js'
import { etaForBookings } from './orderNeeds.js'
import { deliveryForecast, pickDeliveryTarget, nextMonthOutlook } from './deliveryForecast.js'

const alive = rows => (rows || []).filter(r => r && !r.deleted)

// ของเสริม (รถ ใบสั่งรถ เป้า) — หน้าภาพรวมมีใบจอง/รถอยู่แล้ว เรียกแค่ส่วนนี้
export async function loadDeliveryExtras({ vehicles = null, today = todayBangkok() } = {}) {
  const ym = today.slice(0, 7)
  const [veh, orders, budget, teamTargets] = await Promise.all([
    vehicles ? Promise.resolve(vehicles) : listDocs('vehicles', companyScopeFilters(), 'arrivedAt', 'desc', 3000).catch(() => []),
    listDocs('vehicle_orders', companyScopeFilters(), 'createdAt', 'desc', 1000).catch(() => []),
    loadSalesBudget(Number(ym.slice(0, 4))).catch(() => ({ units: null })),
    listDocs('team_targets', companyScopeFilters(), 'period', 'desc', 200).catch(() => []),
  ])
  return { vehicles: alive(veh), orders: alive(orders), ...pickDeliveryTarget({ budgetUnits: budget?.units, teamTargets, ym }) }
}

export function computeDeliveryForecast({ bookings, vehicles = [], orders = [], target = null, today = todayBangkok(), fmt, etaMap: given }) {
  const live = alive(bookings)
  const etaMap = given !== undefined ? given : (vehicles.length || orders.length) ? etaForBookings({ bookings: live, vehicles, orders, today }) : null
  return deliveryForecast({ bookings: live, vehicles, orders, etaMap, today, target, fmt })
}

export async function loadDeliveryForecast({ today = todayBangkok(), fmt } = {}) {
  const [bookings, extras] = await Promise.all([
    listDocs('bookings', companyScopeFilters(), 'createdAt', 'desc', 3000).catch(() => []),
    loadDeliveryExtras({ today }),
  ])
  const live = alive(bookings)
  const etaMap = (extras.vehicles.length || extras.orders.length) ? etaForBookings({ bookings: live, vehicles: extras.vehicles, orders: extras.orders, today }) : null
  return { ...extras, bookings: live, fc: computeDeliveryForecast({ bookings: live, ...extras, today, fmt, etaMap }), next: nextMonthOutlook({ bookings: live, vehicles: extras.vehicles, orders: extras.orders, etaMap, today, fmt }) }
}
