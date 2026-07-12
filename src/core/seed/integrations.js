// Demo seed data — integrations module (split from demoSeedData.js for maintainability)
// ห้าม import อะไรจาก db.js — รับ demoCol เป็นพารามิเตอร์เพื่อกัน circular import
export function runSeed(demoCol) {

  const now = new Date()

  // Integration settings (หน้า /integrations/settings)
  const isNow = Date.now()

  // Webhook Builder (หน้า /integrations/webhooks)
  const webhooksDemo = [
    { id:'wh001', name:'LINE Notify – ยอดขาย', url:'https://notify-api.line.me/api/notify', events:['sale.created','sale.updated'], method:'POST', active:true, lastFired:'2026-06-14T09:32:00', fires:142, fails:0, secret:'sk_ln_xxxx' },
    { id:'wh002', name:'Google Sheets – Lead', url:'https://script.google.com/macros/s/xxxxx/exec', events:['lead.created','lead.converted'], method:'POST', active:true, lastFired:'2026-06-13T17:05:00', fires:67, fails:2, secret:'' },
    { id:'wh003', name:'Slack – บริการแจ้งเตือน', url:'https://hooks.slack.com/services/T00/B00/xxx', events:['service.completed'], method:'POST', active:false, lastFired:'2026-05-30T12:00:00', fires:23, fails:0, secret:'' },
  ]
  webhooksDemo.forEach(w => { if (!demoCol('webhooks')[w.id]) demoCol('webhooks')[w.id] = w })

}
