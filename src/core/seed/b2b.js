// Demo seed data — b2b module (split from demoSeedData.js for maintainability)
// ห้าม import อะไรจาก db.js — รับ demoCol เป็นพารามิเตอร์เพื่อกัน circular import
export function runSeed(demoCol) {

  // Fleet quotes (หน้า /b2b/fleet-quote)
  const fqAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  // B2B Partners (หน้า /b2b/partners)
  const ppAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
}
