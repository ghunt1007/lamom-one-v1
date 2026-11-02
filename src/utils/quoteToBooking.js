// (2026-11-02) ใบเสนอราคา → ใบจอง โดยไม่ต้องพิมพ์ซ้ำ
// เดิมเซลส์ทำใบเสนอราคาแล้วต้องกรอกลูกค้า/รุ่น/ราคา/ส่วนลด/ของแถม/ไฟแนนซ์ใหม่หมดตอนจอง และกรอกอีกรอบในข้อมูลเอกสารขาย
// ตอนนี้กด "📝 จองเลย" ในใบเสนอราคา → ฟอร์มจองเปิดพร้อมค่าครบ และของแถม/ส่วนลด/ค่าจดทะเบียนลง bookings.sale ให้เลย

const num = v => Number(v) || 0

// หา brand/model/variant จาก vehicleLabel ("BRAND MODEL VARIANT") ของใบเสนอราคารุ่นเก่าที่ไม่ได้เก็บแยก
export function vehicleOfQuote(q, vehicles = []) {
  if (q?.brand || q?.model) return { brand: q.brand || '', model: q.model || '', variant: q.variant || '' }
  const label = String(q?.vehicleLabel || '').replace(/\s+/g, ' ').trim().toLowerCase()
  const v = label && vehicles.find(x => `${x.brand} ${x.model} ${x.variant}`.replace(/\s+/g, ' ').trim().toLowerCase() === label)
  if (v) return { brand: v.brand || '', model: v.model || '', variant: v.variant || '' }
  const [brand = '', model = '', ...rest] = String(q?.vehicleLabel || '').split(/\s+/).filter(x => x && x !== 'undefined')
  return { brand, model, variant: rest.join(' ') }
}

export function quoteToWizard(q, vehicles = []) {
  if (!q) return null
  const acc = Array.isArray(q.accessories) ? q.accessories : []
  const paid = acc.filter(a => !a.free)
  const items = acc.filter(a => a?.name).map(a => ({
    name: a.name, detail: '', cost: '',
    giftValue: a.free ? num(a.price) || '' : '',
    salePrice: a.free ? '' : num(a.price) || '',
    campaign: false,
  }))
  const note = [q.tradeIn ? `รถเทิร์น ${num(q.tradeIn).toLocaleString('th-TH')} บาท` : '', q.notes || ''].filter(Boolean).join(' · ')
  return {
    custName: q.customerName || '',
    phone: q.phone || '',
    customerId: q.customerId || null,
    ...(q.salesperson ? { salesName: q.salesperson } : {}),
    ...vehicleOfQuote(q, vehicles),
    colorOut: q.color || '',
    price: num(q.basePrice),
    discount: num(q.discount),
    accessories: paid.reduce((s, a) => s + num(a.price), 0),
    down: num(q.downPayment),
    ...(q.term ? { installments: num(q.term) } : {}),
    ...(q.rate ? { interestRate: num(q.rate) } : {}),
    quotationId: q.id || null,
    sale: { items, discount: num(q.discount) || '', regFee: num(q.regFee) || '', note },
  }
}
