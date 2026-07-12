// Demo seed data — dms module (split from demoSeedData.js for maintainability)
// ห้าม import อะไรจาก db.js — รับ demoCol เป็นพารามิเตอร์เพื่อกัน circular import
export function runSeed(demoCol) {

  // Vehicles
  const vehicles = [
    { id:'v1', brand:'BYD', model:'Seal', variant:'AWD', color:'ขาว Pearl', vin:'LGXCE4C10PA000001', year:2025, price:1299000, cost:1150000, status:'available', mileage:0, location:'โชว์รูมหลัก', arrivedAt:'2025-03-01', notes:'' },
    { id:'v2', brand:'BYD', model:'Atto 3', variant:'Extended Range', color:'น้ำเงิน', vin:'LGXCE4C10PA000002', year:2025, price:1099000, cost:970000, status:'reserved', mileage:0, location:'โชว์รูมหลัก', arrivedAt:'2025-02-15', notes:'จอง-วิชัย สุขใจ' },
    { id:'v3', brand:'MG', model:'MG4', variant:'X-Power', color:'แดง Dragon', vin:'SDUZZZEF5PA000003', year:2025, price:949000, cost:840000, status:'available', mileage:0, location:'โชว์รูมหลัก', arrivedAt:'2025-03-10', notes:'' },
    { id:'v4', brand:'DEEPAL', model:'S7', variant:'Pro', color:'ดำ Obsidian', vin:'LZEZ1EBA0PA000004', year:2025, price:1479000, cost:1320000, status:'pdi', mileage:0, location:'ห้อง PDI', arrivedAt:'2025-04-01', notes:'PDI เสร็จ 5 เม.ย.' },
    { id:'v5', brand:'NETA', model:'V II', variant:'Pro 400', color:'ขาว', vin:'LNBSCCAD0PA000005', year:2025, price:769000, cost:680000, status:'available', mileage:0, location:'โชว์รูมสาขา 2', arrivedAt:'2025-03-20', notes:'' },
    { id:'v6', brand:'BYD', model:'Seal', variant:'RWD', color:'เทา Ink', vin:'LGXCE4C10PA000006', year:2025, price:1199000, cost:1060000, status:'demo', mileage:3520, location:'โชว์รูมหลัก', arrivedAt:'2025-01-10', notes:'รถทดลองขับ' },
  ]
  vehicles.forEach(v => { if (!demoCol('vehicles')[v.id]) demoCol('vehicles')[v.id] = v })


  // Vehicle Orders
  const orders = [
    { id:'ord1', orderNo:'ORD-2025-001', brand:'BYD', model:'Seal', variant:'AWD', color:'ขาว Pearl', qty:3, unitCost:1150000, status:'shipped', expectedDate:'2025-04-20', supplier:'BYD Auto Thailand', notes:'ETA พอร์ตแหลมฉบัง', createdAt:'2025-03-01' },
    { id:'ord2', orderNo:'ORD-2025-002', brand:'MG', model:'MG4', variant:'X', color:'แดง', qty:2, unitCost:840000, status:'confirmed', expectedDate:'2025-05-10', supplier:'SAIC-MG Thailand', notes:'', createdAt:'2025-03-15' },
    { id:'ord3', orderNo:'ORD-2025-003', brand:'NETA', model:'V II', variant:'400', color:'ขาว', qty:5, unitCost:680000, status:'production', expectedDate:'2025-06-01', supplier:'NETA Thailand', notes:'', createdAt:'2025-04-01' },
  ]
  orders.forEach(o => { if (!demoCol('vehicle_orders')[o.id]) demoCol('vehicle_orders')[o.id] = o })


  // PDI
  const pdis = [
    { id:'pdi1', vehicleId:'v4', brand:'DEEPAL', model:'S7', color:'ดำ', vin:'LZEZ1EBA0PA000004', techName:'สมชาย รักงาน', status:'inprogress', startDate:'2025-04-02', checks:{}, defects:[], notes:'' },
    { id:'pdi2', vehicleId:'v1', brand:'BYD', model:'Seal', color:'ขาว Pearl', vin:'LGXCE4C10PA000001', techName:'วิชัย ช่างดี', status:'passed', startDate:'2025-03-05', endDate:'2025-03-05', checks:{}, defects:[], notes:'ผ่านทุกรายการ' },
  ]
  pdis.forEach(p => { if (!demoCol('pdi')[p.id]) demoCol('pdi')[p.id] = p })


  // Custom Vehicle Order — ระบบสั่งแต่งรถ (หน้า /dms/custom-orders)
  const coAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  // EV Charging Stations (หน้า /dms/ev-station)
  const evStationsDemo = [
    { id:'EV01', name:'Charger A1 (โชว์รูมหน้า)', type:'DC Fast', power:'60 kW', status:'available', connectors:['CCS2','CHAdeMO'], rate:4, todaySessions:8, todayKwh:240, revenue:960 },
    { id:'EV02', name:'Charger A2 (โชว์รูมหน้า)', type:'DC Fast', power:'60 kW', status:'charging', connectors:['CCS2'], rate:4, todaySessions:6, todayKwh:198, revenue:792 },
    { id:'EV03', name:'Charger B1 (ที่จอดรถ)', type:'AC Level 2', power:'22 kW', status:'available', connectors:['Type2'], rate:4, todaySessions:4, todayKwh:88, revenue:352 },
    { id:'EV04', name:'Charger B2 (ที่จอดรถ)', type:'AC Level 2', power:'22 kW', status:'offline', connectors:['Type2'], rate:4, todaySessions:0, todayKwh:0, revenue:0 },
    { id:'EV05', name:'Charger C1 (บริการ)', type:'DC Fast', power:'120 kW', status:'charging', connectors:['CCS2','GB/T'], rate:0, todaySessions:12, todayKwh:480, revenue:0 },
  ]
  evStationsDemo.forEach(s => { if (!demoCol('ev_charging_stations')[s.id]) demoCol('ev_charging_stations')[s.id] = s })


  // Accessory Shop (หน้า /dms/accessories) — schema matches AccessoryShop.js exactly
  const accessories = [
    { id: 'AC001', name: 'Wallbox Charger 7kW + ติดตั้ง', cat: 'charging', price: 35000, cost: 24000, stock: 6, sold30: 8, popular: true },
    { id: 'AC002', name: 'สายชาร์จพกพา Type 2 (5m)', cat: 'charging', price: 8500, cost: 5200, stock: 12, sold30: 5, popular: false },
    { id: 'AC003', name: 'ฟิล์มกันรอย PPF เต็มคัน', cat: 'protect', price: 45000, cost: 28000, stock: 99, sold30: 4, popular: true },
    { id: 'AC004', name: 'ฟิล์มกรองแสง Ceramic เต็มคัน', cat: 'protect', price: 12000, cost: 6500, stock: 99, sold30: 11, popular: true },
    { id: 'AC005', name: 'พรมปูพื้น 5D เข้ารูป', cat: 'comfort', price: 3500, cost: 1800, stock: 24, sold30: 15, popular: true },
    { id: 'AC006', name: 'กล้องติดรถหน้า-หลัง 4K', cat: 'comfort', price: 6900, cost: 4100, stock: 9, sold30: 7, popular: false },
    { id: 'AC007', name: 'สปอยเลอร์หลัง Carbon', cat: 'exterior', price: 15000, cost: 9000, stock: 3, sold30: 2, popular: false },
    { id: 'AC008', name: 'ล้อแม็กซ์ 19" ชุด 4 วง', cat: 'exterior', price: 48000, cost: 32000, stock: 2, sold30: 1, popular: false },
  ]
  accessories.forEach(a => { if (!demoCol('accessories')[a.id]) demoCol('accessories')[a.id] = a })


  // ── DMS: Vehicles & Inventory ──
  const vehicleModels = [
    { id: 'M001', brand: 'BYD', model: 'BYD Dolphin', type: 'EV', basePrice: 699000, promotionPrice: 679000, range: 340, battery: 44.9, power: 70, color: '#8b5cf6', colors: ['ขาว','ฟ้า','เขียว','ส้ม'], active: true, stock: 12 },
    { id: 'M002', brand: 'BYD', model: 'BYD Atto 3', type: 'EV', basePrice: 1099000, promotionPrice: 1069000, range: 420, battery: 60.5, power: 150, color: '#3b82f6', colors: ['ขาว','ดำ','ฟ้า','แดง'], active: true, stock: 8 },
    { id: 'M003', brand: 'BYD', model: 'BYD Seal AWD', type: 'EV', basePrice: 1499000, promotionPrice: null, range: 520, battery: 82.5, power: 390, color: '#10b981', colors: ['ขาว','ดำ','เทา'], active: true, stock: 5 },
    { id: 'M004', brand: 'BYD', model: 'BYD Han EV', type: 'EV', basePrice: 1999000, promotionPrice: null, range: 560, battery: 85.4, power: 380, color: '#f59e0b', colors: ['ดำ','ขาว'], active: true, stock: 2 },
    { id: 'M005', brand: 'MG', model: 'MG ZS EV', type: 'EV', basePrice: 879000, promotionPrice: 849000, range: 350, battery: 50.3, power: 115, color: '#ef4444', colors: ['ขาว','แดง','ดำ','น้ำเงิน'], active: true, stock: 15 },
    { id: 'M006', brand: 'MG', model: 'MG EP', type: 'PHEV', basePrice: 749000, promotionPrice: null, range: 60, battery: 17.0, power: 130, color: '#06b6d4', colors: ['ขาว','ดำ'], active: true, stock: 6 },
    { id: 'M007', brand: 'Neta', model: 'Neta V', type: 'EV', basePrice: 549000, promotionPrice: 529000, range: 280, battery: 38.5, power: 55, color: '#ec4899', colors: ['ขาว','แดง','เขียว'], active: false, stock: 0 },
  ]
  vehicleModels.forEach(v => { if (!demoCol('vehicle_models')[v.id]) demoCol('vehicle_models')[v.id] = v })


  // stock = alias collection used by QrVehicle / VehicleAging pages (mirrors vehicles)
  const stockItems = [
    { id:'st1', vin:'LGXCE4C10PA000001', brand:'BYD', model:'Seal AWD', color:'ขาว', year:2025, plate:'', status:'in_stock', location:'โชว์รูม A1', daysInStock:45, price:1299000, cost:1150000, receivedAt:'2025-05-15' },
    { id:'st2', vin:'LGXCE4C10PA000002', brand:'BYD', model:'Atto 3', color:'น้ำเงิน', year:2025, plate:'', status:'reserved', location:'โชว์รูม B2', daysInStock:30, price:1099000, cost:980000, receivedAt:'2025-05-30' },
    { id:'st3', vin:'LGXCE4C10PA000003', brand:'BYD', model:'Dolphin', color:'ชมพู', year:2025, plate:'', status:'in_stock', location:'คลัง C3', daysInStock:12, price:799000, cost:700000, receivedAt:'2025-06-17' },
    { id:'st4', vin:'LGXCE4C10PA000004', brand:'DEEPAL', model:'S7', color:'ขาว', year:2025, plate:'', status:'sold', location:'', daysInStock:60, price:1199000, cost:1050000, receivedAt:'2025-04-30' },
  ]
  stockItems.forEach(s => { if (!demoCol('stock')[s.id]) demoCol('stock')[s.id] = s })


  // Consignment Vehicles (หน้า /dms/consignment) — schema matches ConsignmentVehicle.js exactly
  const consignments = [
    { id: 'CS-001', owner: 'คุณสมศักดิ์', phone: '081-234-5678', model: 'BYD Atto 3 (2023)', plate: 'กข-1122', ask: 850000, floor: 800000, commPct: 5, start: '2026-05-10', status: 'selling' },
    { id: 'CS-002', owner: 'คุณวันดี', phone: '089-555-7788', model: 'MG ZS EV (2022)', plate: '1กก-3344', ask: 620000, floor: 590000, commPct: 5, start: '2026-04-22', status: 'selling' },
    { id: 'CS-003', owner: 'บ.รุ่งเรือง', phone: '02-111-2222', model: 'BYD Seal (2023)', plate: 'ขค-9090', ask: 1450000, floor: 1380000, commPct: 4, start: '2026-03-15', status: 'sold', soldAt: 1420000 },
  ]
  consignments.forEach(c => { if (!demoCol('consignments')[c.id]) demoCol('consignments')[c.id] = c })


  // ── DMS: Finance / Compliance ──
  const bmAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
}
