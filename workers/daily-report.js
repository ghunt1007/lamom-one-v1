/**
 * LAMOM ONE — Daily Report Worker (Telegram + LINE)
 * Deploy: wrangler deploy --config wrangler-daily-report.toml
 *
 * ทำไมต้องเป็น Worker แยกจาก comms-send.js: รายงานนี้ต้องทำงาน "เอง" ทุกวันตาม Cron Trigger โดยไม่มีใคร
 * ล็อกอินอยู่เลย — ต่างจาก comms-send.js ที่ทุก request ต้องมี Firebase ID token ของพนักงานที่ล็อกอินอยู่
 * ยืนยันตัวตนก่อนเสมอ Worker นี้จึงต้องอ่าน Firestore เองด้วย Firebase Service Account (เซ็น JWT ขอ access
 * token เอง) แทนที่จะพึ่ง token ของใคร — ใช้ pattern เดียวกับ getFcmAccessToken() ใน comms-send.js เป๊ะๆ
 * (เปลี่ยนแค่ scope จาก firebase.messaging เป็น datastore) แต่ละไฟล์ worker ในโปรเจกต์นี้ตั้งใจให้ยืนอ่าน
 * เข้าใจได้ครบในตัวเอง (ไม่แชร์โมดูลข้ามไฟล์) จึงคัดลอก helper พวกนี้มาแทนที่จะ import จาก comms-send.js
 *
 * Binding/vars ที่ต้องตั้งใน Cloudflare Dashboard หรือ wrangler-daily-report.toml:
 *   Var:    FIREBASE_PROJECT_ID            (เช่น "lamom-one-v1")
 *   Var:    FIREBASE_API_KEY               (Firebase Web API key — public, ใช้ verify ID token เท่านั้น)
 *   Var:    ALLOWED_ORIGIN                 (origin ของแอปจริง เช่น https://lamom-one.pages.dev)
 *   Secret: FIRESTORE_SERVICE_ACCOUNT_JSON (JSON key ทั้งไฟล์ของ Firebase service account แบบ string เดียว —
 *                                            Firebase Console > Project Settings > Service Accounts >
 *                                            Generate new private key)
 *   Secret: TELEGRAM_BOT_TOKEN             (จาก @BotFather ใน Telegram)
 *   Secret: TELEGRAM_CHAT_ID               (chat id ปลายทาง — เปิด https://api.telegram.org/bot<TOKEN>/getUpdates
 *                                            หลังทักบอทไปสักข้อความ จะเห็น "chat":{"id":...})
 *   Secret: LINE_CHANNEL_ACCESS_TOKEN      (LINE Developers Console > Messaging API — ใช้ตัวเดียวกับ
 *                                            comms-send.js ได้ถ้าเป็น LINE OA เดียวกัน)
 *   Secret: LINE_CHANNEL_SECRET            (ใช้ตรวจลายเซ็น webhook เท่านั้น — คนละค่ากับ Channel Access Token)
 *   Secret: LINE_TARGET_ID (ไม่บังคับ)      (LINE userId ปลายทาง — ถ้าไม่ตั้งเอง worker จะจับให้อัตโนมัติจาก
 *                                            webhook ครั้งแรกที่มีคนทัก LINE OA แล้วเก็บไว้ใน Firestore
 *                                            doc system_integrations/line_daily_report แทน — ต้องตั้ง webhook
 *                                            URL ของ worker นี้ (…/line/webhook) ไว้ใน LINE Console ก่อน)
 *
 * แต่ละช่องทาง (Telegram/LINE) เปิดใช้งานอิสระต่อกัน — ถ้ายังไม่ตั้ง secret ของช่องทางไหนจะข้ามช่องทางนั้น
 * ไปแบบรายงานสถานะ configured:false ตรงๆ (ไม่ throw จนพังทั้งงาน) ตาม pattern เดียวกับ comms-send.js
 */

const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore'
const DELIVERED_STATUSES = ['ส่งมอบแล้ว', 'ตัดตัวเลขรอส่งมอบ']
const PENDING_STATUSES = ['จัดไฟแนนซ์ก่อนจอง', 'รอผลไฟแนนซ์', 'ยอดจองคงค้าง', 'รอรถ', 'รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ']
const PENDING_ALWAYS_SHOWN = ['รอผลไฟแนนซ์', 'ยอดจองคงค้าง', 'รอรถ', 'รอส่งมอบ']
const CANCELLED_STATUSES = ['ถอนจอง', 'ยกเลิก']
const STAFF_ROLES = ['owner', 'admin', 'manager', 'sales', 'service', 'finance', 'hr', 'staff']
// 02:00 UTC = 09:00 เวลาไทย — ต้องตรงกับบรรทัดใน [triggers] crons ของ wrangler-daily-report.toml
const MORNING_CRON = '0 2 * * *'
// ป้ายช่องทางที่มาของลูกค้า — key เดียวกับหน้าลูกค้า (Customers.js SOURCE)
const SOURCE_LABELS = { facebook: 'Facebook', line: 'LINE', tiktok: 'TikTok', 'walk-in': 'Walk-in', referral: 'แนะนำ', google: 'Google', website: 'เว็บไซต์', phone: 'โทรเข้า', other: 'อื่นๆ' }
const STALE_LEAD_DAYS = 3
const STUCK_BOOKING_DAYS = 14

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = env.ALLOWED_ORIGIN || '*'
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })

    try {
      if (request.method === 'POST' && url.pathname === '/line/webhook') return await handleLineWebhook(request, env, cors)
      // ?kind=morning = ข้อความเตือนตอนเช้า (ไม่ใส่ = รายงานสรุป 18:00 เหมือนเดิม)
      const morning = url.searchParams.get('kind') === 'morning'
      if (url.pathname === '/test-send') return await handleTestSend(request, env, cors, morning)
      if (url.pathname === '/preview') return await handlePreview(request, env, cors, morning)
      return json({ error: 'Not found' }, 404, cors)
    } catch (err) {
      return json({ error: err.message || 'Daily report worker error' }, 500, cors)
    }
  },

  // Cron Trigger เรียกจุดนี้ตามตารางเวลาใน wrangler-daily-report.toml (ไม่มี HTTP request ผูกมาด้วยเลย)
  // มี 2 รอบ: 09:00 เตือนงานค้างรายคน, 18:00 สรุปประจำวัน — แยกด้วย event.cron
  async scheduled(event, env, ctx) {
    ctx.waitUntil(event.cron === MORNING_CRON ? runDailyReport(env, true) : runDailyReport(env))
  },
}

// ── รายงานหลัก — ใช้ร่วมกันทั้ง scheduled() และ /test-send ─────────────────────
async function runDailyReport(env, morning = false) {
  const accessToken = await getFirestoreAccessToken(env)
  if (!accessToken) return { error: 'อ่าน Firestore ไม่ได้ — ตรวจสอบ secret FIRESTORE_SERVICE_ACCOUNT_JSON' }
  if (morning) return runMorningReminder(env, accessToken)
  const text = await buildReportText(env, accessToken)
  const [telegram, line] = await Promise.all([
    sendTelegram(env, text),
    sendLineTarget(env, accessToken, text),
  ])
  return { text, telegram, line }
}

// 09:00 — สรุปรวมทุกคนส่งเจ้าของ (Telegram + LINE เดิม) แล้วส่งส่วนของใครของมันให้เซลส์ที่ลงทะเบียน LINE ไว้
async function runMorningReminder(env, accessToken) {
  const { text, sections, today, data } = await buildMorningData(env, accessToken)
  const [telegram, line] = await Promise.all([
    sendTelegram(env, text),
    sendLineTarget(env, accessToken, text),
  ])
  // วันจันทร์: ส่งสรุปสัปดาห์ที่แล้วตามไปอีกข้อความ (แทนสรุปรายสัปดาห์ของ CRM เก่าที่ปิดไปแล้ว)
  let weekly = null
  if (isMonday(today)) {
    // นัดที่ทำแล้ว (ข้อมูลเช้าดึงเฉพาะนัดค้าง) — ใช้คิด % การติดตามของสัปดาห์ที่แล้ว
    const followupsDone = await runQuery(env, accessToken, 'followups', null, null, 5000, ['dueDate', 'status', 'salesperson', 'deleted'], ['status', 'done']).catch(() => null)
    const wText = buildWeeklyReport({ ...data, followupsDone }, { today })
    const [wt, wl] = await Promise.all([sendTelegram(env, wText), sendLineTarget(env, accessToken, wText)])
    weekly = { text: wText, telegram: wt, line: wl }
  }
  const personal = []
  if (env.LINE_CHANNEL_ACCESS_TOKEN) {
    const targets = await runQuery(env, accessToken, 'line_sales_targets', null, null, 500, ['name', 'userId']).catch(() => [])
    const goals = await readSalesGoals(env, accessToken, today.slice(0, 7))
    for (const m of matchSalesTargets(sections, targets)) {
      const r = await pushLine(env, m.userId, buildPersonalReminder(m.section, today, env.ALLOWED_ORIGIN, sellerGoal(data, goals, m.name, today)))
      personal.push({ name: m.name, ...r })
    }
  }
  return { text, telegram, line, personal, weekly }
}

async function handleTestSend(request, env, cors, morning = false) {
  const auth = await requireStaff(request, env)
  if (auth.error) return json({ error: auth.error }, auth.status, cors)
  return json(await runDailyReport(env, morning), 200, cors)
}

async function handlePreview(request, env, cors, morning = false) {
  const auth = await requireStaff(request, env)
  if (auth.error) return json({ error: auth.error }, auth.status, cors)
  const accessToken = await getFirestoreAccessToken(env)
  if (!accessToken) return json({ error: 'อ่าน Firestore ไม่ได้ — ตรวจสอบ secret FIRESTORE_SERVICE_ACCOUNT_JSON' }, 500, cors)
  return json({ text: morning ? (await buildMorningData(env, accessToken)).text : await buildReportText(env, accessToken) }, 200, cors)
}

// ── LINE webhook — จับ userId ของคนที่ทัก LINE OA มาเก็บเป็นปลายทางส่งรายงาน ──────
// ทำไมต้องมีจุดนี้: LINE Messaging API "push" (ส่งเจาะจงคนเดียว ไม่ broadcast หาลูกค้าทุกคน — ตามที่เลือกไว้)
// ต้องรู้ userId ปลายทางก่อนเสมอ แต่เจ้าของระบบไม่มีทางรู้ userId ของตัวเองในแอป LINE ได้เองตรงๆ วิธีที่ LINE
// ให้มาคือรับ userId จาก webhook event ตอนมีคนทักแชทกับ OA เท่านั้น — endpoint นี้เก็บ userId แรกที่ทักมา
// ไว้ใน Firestore (system_integrations/line_daily_report) แล้วตอบกลับยืนยันให้รู้ว่าลงทะเบียนสำเร็จ
async function handleLineWebhook(request, env, cors) {
  const rawBody = await request.text()
  const signature = request.headers.get('X-Line-Signature') || ''
  if (!(await verifyLineSignature(rawBody, signature, env.LINE_CHANNEL_SECRET))) {
    return json({ error: 'Invalid signature' }, 401, cors)
  }
  let body
  try { body = JSON.parse(rawBody) } catch { body = {} }
  const events = Array.isArray(body.events) ? body.events : []
  const accessToken = await getFirestoreAccessToken(env)
  for (const ev of events) {
    const userId = ev.source?.userId
    if (!userId || !accessToken) continue
    const cmd = parseLineCommand(ev.type === 'message' && ev.message?.type === 'text' ? ev.message.text : '')
    let reply = null
    let otherMessage = false
    if (cmd.type === 'register') {
      // เซลส์ลงทะเบียนชื่อตัวเอง → เช้าวันถัดไปได้งานค้างของตัวเองทาง LINE (ชื่อต้องตรงกับชื่อเซลส์/ผู้ดูแลในแอป)
      await writeSalesTarget(env, accessToken, userId, cmd.name)
      reply = `✅ ลงทะเบียนชื่อ "${cmd.name}" แล้วครับ\nทุกเช้า 9 โมงจะส่งงานค้างของคุณมาที่นี่ หรือพิมพ์ "งาน" เพื่อดูได้ทันที\n(ชื่อต้องตรงกับชื่อเซลส์ในแอป LAMOM ONE — พิมพ์ "ยกเลิก" เพื่อหยุดรับ)`
    } else if (cmd.type === 'report') {
      // เฉพาะเจ้าของ (ปลายทางรายงานประจำวัน) เท่านั้น — คนอื่นพิมพ์มาไม่ตอบ
      const owner = env.LINE_TARGET_ID || await readLineTarget(env, accessToken)
      if (!owner) {
        await writeLineTarget(env, accessToken, userId)
        reply = '✅ ลงทะเบียนรับรายงานประจำวัน LAMOM ONE เรียบร้อยแล้วครับ (พิมพ์ "สรุป" อีกครั้งเพื่อดูรายงานตอนนี้)'
      } else if (owner === userId) {
        try { reply = clipLine(await buildReportText(env, accessToken)) } catch { reply = '⚠️ ดึงรายงานไม่สำเร็จ ลองใหม่อีกครั้งครับ' }
      } else otherMessage = true
    } else if (cmd.type === 'find' || cmd.type === 'help') {
      // เฉพาะเซลส์ที่ลงทะเบียน/เจ้าของ — ข้อมูลลูกค้าไม่ตอบให้คนนอก
      const me = await readSalesTarget(env, accessToken, userId)
      const owner = env.LINE_TARGET_ID || await readLineTarget(env, accessToken)
      if (me?.name || (owner && owner === userId)) {
        if (cmd.type === 'help') reply = LINE_HELP_TEXT
        else {
          try {
            const [customers, followups] = await Promise.all([
              runQuery(env, accessToken, 'customers', null, null, 5000, ['firstName', 'lastName', 'phone', 'lineId', 'stage', 'assignedTo', 'interestedModel', 'isLost', 'deleted']),
              runQuery(env, accessToken, 'followups', null, null, 5000, ['dueDate', 'status', 'customerId', 'deleted'], ['status', 'pending']),
            ])
            // นโยบายการมองเห็นเดียวกับในแอป: เซลส์เห็นเฉพาะลูกค้าที่ตัวเองดูแล — เจ้าของเห็นทั้งหมด
            const isOwner = owner && owner === userId
            const mine = isOwner ? customers : customers.filter(c => normSalesName(c.assignedTo) === normSalesName(me?.name))
            reply = findCustomersText(mine, followups, cmd.q, todayBangkok())
          } catch { reply = '⚠️ ค้นหาไม่สำเร็จ ลองใหม่อีกครั้งครับ' }
        }
      } else otherMessage = true
    } else if (cmd.type === 'plan') {
      // นัดติดตามลูกค้าผ่าน LINE — สิทธิ์เดียวกับ "โทรแล้ว" (เซลส์: ลูกค้าของตัวเอง / เจ้าของ: ทุกคน) ต้องเจอรายเดียว
      const me = await readSalesTarget(env, accessToken, userId)
      const owner = env.LINE_TARGET_ID || await readLineTarget(env, accessToken)
      const isOwner = owner && owner === userId
      if (me?.name || isOwner) {
        const today = todayBangkok()
        const due = parseThaiDue(cmd.when, today)
        if (!due) reply = `⚠️ ไม่เข้าใจวันนัด "${cmd.when}" — ใช้ได้เช่น พรุ่งนี้ / มะรืน / 3วัน / 28/10 / 28/10/69`
        else if (due < today) reply = '⚠️ วันนัดผ่านไปแล้ว ลองใหม่อีกครั้งครับ'
        else {
          try {
            const customers = await runQuery(env, accessToken, 'customers', null, null, 5000, ['firstName', 'lastName', 'phone', 'lineId', 'assignedTo', 'interestedModel', 'companyId', 'isLost', 'deleted'])
            const mine = isOwner ? customers : customers.filter(c => normSalesName(c.assignedTo) === normSalesName(me?.name))
            const t = pickTouchTarget(mine, cmd.q)
            if (t.customer) {
              const fields = buildPlannedFollowupFields(t.customer, { dueDate: due, salesperson: String(t.customer.assignedTo || '').trim() || me?.name || '', now: new Date().toISOString() })
              const res = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/followups`, {
                method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
              }).catch(() => null)
              reply = res?.ok ? `📅 นัดติดตาม ${custFullName(t.customer)} วันที่ ${formatThaiDate(due)} แล้วครับ` : '⚠️ บันทึกนัดไม่สำเร็จ ลองใหม่อีกครั้งครับ'
            } else reply = t.reply.replace('"โทรแล้ว 0812345678"', '"นัด 0812345678 พรุ่งนี้"')
          } catch { reply = '⚠️ บันทึกนัดไม่สำเร็จ ลองใหม่อีกครั้งครับ' }
        }
      } else otherMessage = true
    } else if (cmd.type === 'touch') {
      // บันทึก "ติดต่อลูกค้าแล้ว" — เฉพาะเซลส์ที่ลงทะเบียน (ลูกค้าของตัวเอง) / เจ้าของ (ทุกคน) ต้องเจอลูกค้ารายเดียวเท่านั้น
      const me = await readSalesTarget(env, accessToken, userId)
      const owner = env.LINE_TARGET_ID || await readLineTarget(env, accessToken)
      const isOwner = owner && owner === userId
      if (me?.name || isOwner) {
        try {
          const customers = await runQuery(env, accessToken, 'customers', null, null, 5000, ['firstName', 'lastName', 'phone', 'lineId', 'assignedTo', 'isLost', 'firstContactAt', 'deleted'])
          const mine = isOwner ? customers : customers.filter(c => normSalesName(c.assignedTo) === normSalesName(me?.name))
          const t = pickTouchTarget(mine, cmd.q)
          if (t.customer) {
            const ok = await patchCustomerContact(env, accessToken, t.customer, new Date().toISOString())
            reply = ok ? `✅ บันทึกว่าติดต่อ ${custFullName(t.customer)} แล้วครับ` : '⚠️ บันทึกไม่สำเร็จ ลองใหม่อีกครั้งครับ'
          } else reply = t.reply
        } catch { reply = '⚠️ บันทึกไม่สำเร็จ ลองใหม่อีกครั้งครับ' }
      } else otherMessage = true
    } else if (cmd.type === 'mystats') {
      const me = await readSalesTarget(env, accessToken, userId)
      if (me?.name) {
        try {
          const { data, today } = await buildMorningData(env, accessToken)
          const goals = await readSalesGoals(env, accessToken, today.slice(0, 7))
          reply = myStatsText(data, me.name, today, sellerGoal(data, goals, me.name, today))
        } catch { reply = '⚠️ ดึงยอดไม่สำเร็จ ลองใหม่อีกครั้งครับ' }
      } else otherMessage = true
    } else if (cmd.type === 'tomorrow') {
      const me = await readSalesTarget(env, accessToken, userId)
      if (me?.name) {
        try {
          const { data, today } = await buildMorningData(env, accessToken)
          reply = clipLine(buildTomorrowText(data, me.name, today))
        } catch { reply = '⚠️ ดึงงานพรุ่งนี้ไม่สำเร็จ ลองใหม่อีกครั้งครับ' }
      } else otherMessage = true
    } else if (cmd.type === 'tasks') {
      // ตอบเฉพาะคนที่ลงทะเบียนเป็นเซลส์แล้ว — คนอื่น (เช่น ลูกค้าพิมพ์คำว่า "งาน") ไม่ตอบ ไม่ให้ข้อมูลภายในหลุด
      const me = await readSalesTarget(env, accessToken, userId)
      if (me?.name) reply = await buildTasksReply(env, accessToken, me.name)
      else otherMessage = true
    } else if (cmd.type === 'unregister') {
      await deleteSalesTarget(env, accessToken, userId)
      reply = '✅ ยกเลิกการรับเตือนงานค้างแล้วครับ'
    } else {
      otherMessage = true
    }
    // ข้อความทั่วไป หรือคำสั่งที่คนพิมพ์ไม่มีสิทธิ์ใช้ (เช่น ลูกค้าพิมพ์ "หา รถ") → ทำแบบข้อความปกติ (จับ Lead ได้ตามเดิม)
    if (otherMessage) {
      const owner = env.LINE_TARGET_ID || await readLineTarget(env, accessToken)
      if (!owner) {
        // ยังไม่มีปลายทางรายงานเจ้าของ → คนแรกที่ทักคือเจ้าของ (พฤติกรรมเดิม) — เดิมทุกข้อความที่เข้ามาจะเขียนทับ
        // ปลายทางเจ้าของทุกครั้ง พอเซลส์เริ่มทัก OA รายงานเจ้าของจะไปเข้า LINE เซลส์แทน จึงเขียนครั้งแรกครั้งเดียว
        await writeLineTarget(env, accessToken, userId)
        reply = '✅ ลงทะเบียนรับรายงานประจำวัน LAMOM ONE เรียบร้อยแล้วครับ'
      } else if (env.AUTO_LEAD_FROM_LINE === '1' && userId !== owner && ev.type === 'message') {
        // (เปิดเองด้วย var AUTO_LEAD_FROM_LINE="1") คนที่ไม่ใช่เจ้าของ/เซลส์ทักเข้ามา = ลูกค้าใหม่ → สร้าง Lead ให้
        await captureLineLead(env, accessToken, userId, ev.message?.type === 'text' ? ev.message.text : '').catch(() => {})
      }
    }
    // ข้อความอื่น (เช่น ลูกค้าทักมา) ไม่ตอบอะไร — OA นี้อาจเป็นช่องทางคุยกับลูกค้าด้วย
    if (reply && ev.replyToken && env.LINE_CHANNEL_ACCESS_TOKEN) {
      await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyToken: ev.replyToken, messages: [{ type: 'text', text: reply }] }),
      }).catch(() => {})
    }
  }
  return json({ ok: true }, 200, cors)
}

// "ลงทะเบียน สมชาย" / "ลงทะเบียนเซลส์: สมชาย" / "register Somchai" → { type:'register', name }, "ยกเลิก" → unregister
export function parseLineCommand(text) {
  const t = String(text || '').trim()
  const m = t.match(/^(?:ลงทะเบียน|register)\s*(?:เซลส์|เซลล์|sales)?\s*[:：]?\s*(.+)$/i)
  if (m && m[1].trim()) return { type: 'register', name: m[1].trim().slice(0, 60) }
  if (/^(?:ยกเลิก|unregister)$/i.test(t)) return { type: 'unregister' }
  // เจ้าของขอดูรายงานสรุปตอนนี้ (เนื้อหาเดียวกับรายงาน 18:00)
  if (/^(?:สรุป|รายงาน|สรุปวันนี้|report)$/i.test(t.replace(/\s+/g, ''))) return { type: 'report' }
  // ค้นหาลูกค้าจากเบอร์/ชื่อ: "หา 0812345678" / "ค้นหา สมชาย"
  const f = t.match(/^(?:หา|ค้นหา|find)\s+(.+)$/i)
  if (f && f[1].trim().length >= 2) return { type: 'find', q: f[1].trim().slice(0, 40) }
  // เซลส์นัดติดตามลูกค้าผ่าน LINE: "นัด 0812345678 พรุ่งนี้" / "นัด สมชาย 28/10" (คำสุดท้าย = วันนัด)
  const pl = t.match(/^นัด(?:ติดตาม)?\s+(.+?)\s+(\S+)$/)
  if (pl && pl[1].trim().length >= 2) return { type: 'plan', q: pl[1].trim().slice(0, 40), when: pl[2] }
  // เซลส์บันทึกว่าโทร/ทักลูกค้าแล้ว: "โทรแล้ว 0812345678" / "ติดต่อแล้ว สมชาย"
  const tc = t.match(/^(?:โทรแล้ว|ติดต่อแล้ว|ทักแล้ว|called)\s+(.+)$/i)
  if (tc && tc[1].trim().length >= 2) return { type: 'touch', q: tc[1].trim().slice(0, 40) }
  if (/^(?:ช่วยเหลือ|คำสั่ง|help|\?)$/i.test(t)) return { type: 'help' }
  // เซลส์ดูยอดของตัวเองเดือนนี้ (ส่งมอบ/รายได้/จอง/เป้า)
  if (/^(?:ยอด|ยอดฉัน|ยอดของฉัน|ยอดเดือนนี้|mystats)$/i.test(t.replace(/\s+/g, ''))) return { type: 'mystats' }
  // เซลส์ดูแผนพรุ่งนี้ของตัวเอง (นัดติดตาม/ส่งมอบ/ทดลองขับ)
  if (/^(?:พรุ่งนี้|งานพรุ่งนี้|tomorrow)$/i.test(t.replace(/\s+/g, ''))) return { type: 'tomorrow' }
  // เซลส์ขอดูงานค้างของตัวเองตอนไหนก็ได้ (ไม่ต้องรอ 9 โมง)
  if (/^(?:งาน|งานวันนี้|งานค้าง|งานของฉัน|tasks?|todo)$/i.test(t.replace(/\s+/g, ''))) return { type: 'tasks' }
  return { type: 'none' }
}

async function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!channelSecret || !signature) return false
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(channelSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
    let binary = ''
    new Uint8Array(sigBuf).forEach(b => { binary += String.fromCharCode(b) })
    return btoa(binary) === signature
  } catch { return false }
}

// ── เนื้อหารายงาน — ดึงเลขเดียวกับที่ Dashboard.js ใช้จริง (bookingDate/actualDeliveryDate/status ฯลฯ) ──
// ไม่ใช้ where()+orderBy() คนละฟิลด์ (ต้องมี composite index — ปัญหาที่เจอซ้ำหลายรอบในโปรเจกต์นี้) ดึงมา
// เรียงตาม field เดียวแล้วกรองวันที่ฝั่งนี้แทน เหมือน listDocs()/pattern ฝั่ง client ทั้งหมด
async function buildReportText(env, accessToken) {
  // select เฉพาะ field ที่รายงานใช้ — ใบจองหลายพันใบทั้งเอกสารใหญ่เกินจน parse JSON เกินโควตา CPU ของ cron
  const fuFields = ['dueDate', 'status', 'customerId', 'updatedAt', 'deleted']
  const [bookings, customers, fuPending, fuDone, testDrives, teamTargets] = await Promise.all([
    runQuery(env, accessToken, 'bookings', null, null, 5000, ['bookingDate', 'status', 'cutDate', 'actualDeliveryDate', 'cancelDate', 'salesName', 'totalIncome', 'deliveryDate', 'deliveryTime', 'custName', 'model', 'cancelReason', 'deleted']),
    runQuery(env, accessToken, 'customers', null, null, 5000, ['stage', 'createdAt', 'source', 'assignedTo', 'isLost', 'lastContactAt', 'deleted']),
    // แยกดึงนัดค้าง/นัดที่ทำแล้ว — ถ้าดึงรวมแบบจำกัดจำนวน พอนัดอัตโนมัติสะสมเยอะจะตกหล่นนัดของวันนี้
    runQuery(env, accessToken, 'followups', null, null, 5000, fuFields, ['status', 'pending']),
    runQuery(env, accessToken, 'followups', null, null, 5000, fuFields, ['status', 'done']),
    runQuery(env, accessToken, 'test_drives', null, null, 3000, ['date', 'deleted']),
    runQuery(env, accessToken, 'team_targets', null, null, 500, ['period', 'metric', 'target']),
  ])
  const followups = [...fuPending, ...fuDone]
  return buildReport({ bookings, customers, followups, testDrives, teamTargets }, {
    today: todayBangkok(),
    time: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }).format(new Date()),
    defaultTarget: parseInt(env.MONTHLY_DELIVERY_TARGET) || 0,
  })
}

// ── สร้างข้อความรายงานจากข้อมูลล้วนๆ (ไม่แตะเครือข่าย) — export ไว้เทสตรงๆ ──────────────
// นิยามตัวเลขทุกตัวตาม Dashboard.js: "ส่งมอบ" = ส่งมอบแล้ว/ตัดตัวเลขรอส่งมอบ นับตามวันตัดตัวเลข (cutDate),
// รายได้ = totalIncome (มาร์จิ้นคงเหลือ + คอม) ของคันที่ส่งมอบ, Lead = ลูกค้า stage lead/pp, เซลส์ = salesName
export function buildReport(data, { today, time, defaultTarget = 0 }) {
  const thisMonth = today.slice(0, 7)
  const thisYear = today.slice(0, 4)
  const alive = rows => (rows || []).filter(r => r && !r.deleted)
  const bookings = alive(data.bookings)
  const customers = alive(data.customers)
  const followups = alive(data.followups)
  const testDrives = alive(data.testDrives)

  const isCancelled = b => CANCELLED_STATUSES.includes(b.status)
  const bkDate = b => (b.bookingDate || '').slice(0, 10)
  const cutDate = b => (b.cutDate || b.actualDeliveryDate || '').slice(0, 10)
  const cancelDate = b => (b.cancelDate || b.bookingDate || '').slice(0, 10)

  // Lead
  const leads = customers.filter(c => c.stage === 'lead' || c.stage === 'pp')
  const newLeadsTodayList = leads.filter(c => toBangkokDate(c.createdAt) === today)
  const newLeadsToday = newLeadsTodayList.length
  const srcCount = {}
  newLeadsTodayList.forEach(c => { const k = SOURCE_LABELS[c.source] || SOURCE_LABELS.other; srcCount[k] = (srcCount[k] || 0) + 1 })
  // Lead ใหม่วันนี้ที่ติดต่อแล้ว: กด "ติดตามแล้ว" (lastContactAt) หรือบันทึกผล Follow-up ของลูกค้ารายนั้นแล้ววันนี้
  const touchedToday = new Set(followups.filter(f => f.status === 'done' && f.customerId && toBangkokDate(f.updatedAt) === today).map(f => f.customerId))
  const contactedToday = newLeadsTodayList.filter(c => toBangkokDate(c.lastContactAt) === today || touchedToday.has(c.id)).length
  const srcLine = Object.entries(srcCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')
  // ลูกค้าที่ยังไม่มีผู้ดูแล (เช่น ทัก LINE OA เข้ามาเอง) — ถ้าไม่มีใครรับ จะไม่มีใครโทรหา
  // นับเฉพาะที่เข้ามาใน 30 วันล่าสุด — ลูกค้าเก่าที่นำเข้าจาก Excel โดยไม่มีผู้ดูแลจะไม่ทำให้ตัวเลขนี้ล้น
  const [uy, um, ud] = today.split('-').map(Number)
  const since30 = new Date(Date.UTC(uy, um - 1, ud - 30)).toISOString().slice(0, 10)
  const unassigned = leads.filter(c => !c.isLost && !String(c.assignedTo || '').trim() && (toBangkokDate(c.createdAt) || '') >= since30).length
  // ลูกค้าที่ทีมติดต่อวันนี้ (ทุกสถานะ) — กด "ติดต่อแล้ว"/บันทึกการคุย/ทำนัดเสร็จ/พิมพ์ "โทรแล้ว" ใน LINE แยกตามผู้ดูแล
  const contactedAll = customers.filter(c => toBangkokDate(c.lastContactAt) === today || touchedToday.has(c.id))
  const contactBy = {}
  contactedAll.forEach(c => { const k = String(c.assignedTo || '').trim() || '(ไม่มีผู้ดูแล)'; contactBy[k] = (contactBy[k] || 0) + 1 })
  const contactLine = Object.entries(contactBy).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(' · ')
  const followUpToday = followups.filter(f => f.status === 'pending' && f.dueDate === today).length
  const followUpOverdue = followups.filter(f => f.status === 'pending' && f.dueDate && f.dueDate < today).length
  const testDriveToday = testDrives.filter(t => (t.date || '').slice(0, 10) === today).length

  // จอง
  const newBkToday = bookings.filter(b => bkDate(b) === today && !isCancelled(b)).length
  const newBkMonth = bookings.filter(b => bkDate(b).startsWith(thisMonth) && !isCancelled(b)).length
  const cnt = s => bookings.filter(b => b.status === s).length
  const totalPending = bookings.filter(b => PENDING_STATUSES.includes(b.status)).length

  // ส่งมอบ + รายได้
  const delivered = bookings.filter(b => DELIVERED_STATUSES.includes(b.status) && cutDate(b))
  const dlvToday = delivered.filter(b => cutDate(b) === today)
  const dlvMonth = delivered.filter(b => cutDate(b).startsWith(thisMonth))
  const dlvYear = delivered.filter(b => cutDate(b).startsWith(thisYear))
  const income = b => Number(b.totalIncome) || 0
  const revMonth = dlvMonth.reduce((s, b) => s + income(b), 0)
  const revYear = dlvYear.reduce((s, b) => s + income(b), 0)
  const noIncomeMonth = dlvMonth.filter(b => !income(b)).length
  // นัดส่งมอบพรุ่งนี้ (ใบจองที่ยังไม่ส่งมอบ/ไม่ถอน ที่ตั้งวันส่งมอบไว้ในปฏิทินส่งมอบ)
  const [ty, tm, td] = today.split('-').map(Number)
  const tomorrow = new Date(Date.UTC(ty, tm - 1, td + 1)).toISOString().slice(0, 10)
  const dlvTomorrow = bookings.filter(b => (b.deliveryDate || '').slice(0, 10) === tomorrow && b.status !== 'ส่งมอบแล้ว' && !isCancelled(b))

  // ถอนจอง
  const cancelled = bookings.filter(isCancelled)
  const cancelMonth = cancelled.filter(b => cancelDate(b).startsWith(thisMonth)).length
  const cancelYear = cancelled.filter(b => cancelDate(b).startsWith(thisYear)).length
  // ถอนจองวันนี้ พร้อมเหตุผล — ผู้จัดการเห็นทันทีว่าเสียเพราะอะไร (ใช้ cancelDate จริงเท่านั้น ไม่เดาจากวันจอง)
  const cancelTodayList = cancelled.filter(b => (b.cancelDate || '').slice(0, 10) === today)

  // เป้า: เป้าแบบ "ยอดขาย (คัน)" ของเดือนนี้จากหน้าเป้าหมายทีม รวมทุกทีม ถ้าไม่มีใช้ค่าตั้งต้นของ worker
  const unitTargets = (data.teamTargets || []).filter(t => t.period === thisMonth && t.metric === 'units')
  const target = unitTargets.reduce((s, t) => s + (Number(t.target) || 0), 0) || defaultTarget
  const [y, m, d] = today.split('-').map(Number)
  const daysLeft = new Date(Date.UTC(y, m, 0)).getUTCDate() - d

  // ทีมขาย
  const sellers = {}
  const seller = b => (b.salesName || '').trim() || '(ไม่ระบุ)'
  const bump = (k, f) => { (sellers[k] = sellers[k] || { bk: 0, dlv: 0 })[f]++ }
  bookings.forEach(b => { if (bkDate(b).startsWith(thisMonth) && !isCancelled(b)) bump(seller(b), 'bk') })
  dlvMonth.forEach(b => bump(seller(b), 'dlv'))
  const medals = ['🥇', '🥈', '🥉']
  const sellerLines = Object.entries(sellers)
    .sort(([, a], [, b]) => b.dlv - a.dlv || b.bk - a.bk)
    .map(([n, v], i) => `  ${medals[i] || '•'} ${n}: ส่งมอบ ${v.dlv} · จอง ${v.bk}`)

  const lines = [
    '📊 LAMOM ONE สรุปประจำวัน',
    `🗓 ${formatThaiDate(today)}${time ? ` เวลา ${time}` : ''}`,
    '─────────────────────',
    '',
    '👥 LEADS',
    `  • Lead ใหม่วันนี้: ${newLeadsToday} ราย`,
    srcLine ? `    มาจาก: ${srcLine}` : null,
    newLeadsToday ? `    ติดต่อแล้ว ${contactedToday}/${newLeadsToday} ราย${contactedToday < newLeadsToday ? ' ⚠️ ที่เหลือควรโทรก่อนพรุ่งนี้' : ' 👍'}` : null,
    `  • Lead ที่ดูแลอยู่: ${leads.length} ราย`,
    unassigned ? `  • ⚠️ ยังไม่มีผู้ดูแล: ${unassigned} ราย (มอบให้เซลส์ได้ที่หน้า "งานของฉันวันนี้")` : null,
    `  • ติดต่อลูกค้าวันนี้: ${contactedAll.length} ราย${contactLine ? ` (${contactLine})` : ''}`,
    `  • Follow-up วันนี้: ${followUpToday} ราย`,
    followUpOverdue ? `  • ⚠️ Follow-up เลยกำหนด: ${followUpOverdue} ราย` : null,
    `  • ทดลองขับวันนี้: ${testDriveToday} ราย`,
    '',
    '📋 การจอง',
    `  • จองใหม่วันนี้: ${newBkToday} คัน`,
    `  • จองใหม่เดือนนี้: ${newBkMonth} คัน`,
    '',
    '🚗 สถานะปัจจุบัน',
    ...PENDING_STATUSES.filter(s => cnt(s) > 0 || PENDING_ALWAYS_SHOWN.includes(s)).map(s => `  • ${s}: ${cnt(s)} คัน`),
    `  • รวมทั้งหมด: ${totalPending} คัน`,
    '',
    '✅ ส่งมอบ',
    `  • ส่งมอบวันนี้: ${dlvToday.length} คัน${dlvToday.length ? ' 🎉' : ''}`,
    `  • ส่งมอบเดือนนี้: ${dlvMonth.length} คัน`,
    `  • ส่งมอบปีนี้: ${dlvYear.length} คัน`,
  ]
  if (dlvTomorrow.length) {
    lines.push('', `📅 นัดส่งมอบพรุ่งนี้: ${dlvTomorrow.length} คัน`,
      ...dlvTomorrow.slice(0, 10).map(b => `  • ${b.deliveryTime ? b.deliveryTime + ' ' : ''}${b.custName || 'ลูกค้า'}${b.model ? ` (${b.model})` : ''} · ${(b.salesName || '').trim() || '(ไม่ระบุ)'}`),
      dlvTomorrow.length > 10 ? `  • …และอีก ${dlvTomorrow.length - 10} คัน` : null)
  }
  if (target > 0) {
    const pct = Math.round(dlvMonth.length / target * 100)
    const need = Math.max(0, target - dlvMonth.length)
    const filled = Math.round(Math.min(pct, 100) / 100 * 12)
    lines.push('', `🎯 เป้าเดือนนี้: ${target} คัน`,
      `  [${'█'.repeat(filled)}${'░'.repeat(12 - filled)}] ${dlvMonth.length}/${target} (${pct}%)`,
      need > 0
        ? `  ต้องทำอีก ${need} คัน ใน ${daysLeft} วัน${daysLeft > 0 ? ` (${(need / daysLeft).toFixed(1)} คัน/วัน)` : ''}`
        : '  ทำได้ครบเป้าแล้ว! 🎉')
  }
  lines.push('',
    `💰 รายได้เดือนนี้: ${fmtBaht(revMonth)}`,
    noIncomeMonth ? `  ⚠️ ยังไม่กรอกรายได้ ${noIncomeMonth} จาก ${dlvMonth.length} คันที่ส่งมอบเดือนนี้` : null,
    `💰 รายได้ปีนี้: ${fmtBaht(revYear)}`)
  if (sellerLines.length) lines.push('', '👤 ทีมขาย (เดือนนี้)', ...sellerLines)
  lines.push('', `❌ ถอนจองเดือนนี้: ${cancelMonth} คัน | ปีนี้: ${cancelYear} คัน`,
    ...(cancelTodayList.length ? [`  วันนี้ ${cancelTodayList.length} คัน:`, ...cancelTodayList.slice(0, 5).map(b => `  • ${b.custName || 'ลูกค้า'}${b.model ? ` (${b.model})` : ''} · ${(b.salesName || '').trim() || '(ไม่ระบุ)'}${b.cancelReason ? ` — ${String(b.cancelReason).trim().slice(0, 60)}` : ''}`)] : []),
    '', '─────────────────────', '🤖 LAMOM ONE Auto Report')
  return lines.filter(l => l !== null).join('\n')
}

// ── เตือนงานค้างตอนเช้า (09:00) — แยกรายเซลส์ ─────────────────────────────────
async function buildMorningData(env, accessToken) {
  const [bookings, customers, followups, testDrives] = await Promise.all([
    runQuery(env, accessToken, 'bookings', null, null, 5000, ['status', 'bookingDate', 'cutDate', 'actualDeliveryDate', 'cancelDate', 'deliveryDate', 'deliveryTime', 'salesName', 'custName', 'model', 'totalIncome', 'finStatus', 'submitDate', 'financeCo', 'deleted']),
    runQuery(env, accessToken, 'customers', null, null, 5000, ['stage', 'firstName', 'lastName', 'assignedTo', 'interestedModel', 'isLost', 'createdAt', 'updatedAt', 'stageChangedAt', 'lastContactAt', 'source', 'bookingId', 'deleted']),
    // เฉพาะนัดที่ยังไม่ทำ — นัดอัตโนมัติ (Lead/หลังส่งมอบ) สะสมเร็ว ถ้าดึงทั้งหมดแบบจำกัดจำนวนจะตกหล่นนัดของวันนี้
    runQuery(env, accessToken, 'followups', null, null, 5000, ['dueDate', 'status', 'salesperson', 'customerName', 'customerId', 'autoLead', 'deleted'], ['status', 'pending']),
    runQuery(env, accessToken, 'test_drives', null, null, 3000, ['date', 'time', 'status', 'staff', 'customerName', 'model', 'deleted']).catch(() => []),
  ])
  const today = todayBangkok()
  const data = { bookings, customers, followups, testDrives }
  return { today, data, text: buildMorningReminder(data, { today }), sections: buildMorningSections(data, { today }) }
}

// สร้างข้อความเตือนจากข้อมูลล้วนๆ (export ไว้เทส) — ต่อเซลส์ 1 คน มี 3 เรื่อง:
//   1) Lead/Prospect ที่ไม่มีใครแตะเกิน STALE_LEAD_DAYS วัน (ดูจาก lastContactAt/updatedAt/stageChangedAt/createdAt ล่าสุด
//      — แก้ข้อมูลหรือบันทึกการติดต่อในหน้าลูกค้าแล้ว updatedAt จะขยับเอง)
//   2) Follow-up ที่ครบกำหนดวันนี้หรือเลยมาแล้ว
//   3) คันที่ส่งมอบเดือนนี้แต่ยังไม่กรอกรายได้ (นิยามเดียวกับ buildReport)
// สรุปรวมทุกคนส่งเข้าแชทเจ้าของ (แชทเดียวกับรายงาน 18:00) ส่วนเซลส์ที่ลงทะเบียน LINE ไว้ได้เฉพาะส่วนของตัวเองด้วย
// คืน [{ name, text }] เรียงคนที่งานค้างมากสุดก่อน
export function buildMorningSections(data, { today, staleDays = STALE_LEAD_DAYS, maxNames = 5 }) {
  const thisMonth = today.slice(0, 7)
  const alive = rows => (rows || []).filter(r => r && !r.deleted)
  const dayNum = d => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd) / 86400000 }
  const people = {}
  const person = n => (people[(n || '').trim() || '(ยังไม่มีผู้ดูแล)'] ||= { deliver: [], unsched: [], td: [], fin: [], stale: [], fu: [], income: [], stuck: [] })

  alive(data.customers)
    .filter(c => (c.stage === 'lead' || c.stage === 'pp') && !c.isLost)
    .forEach(c => {
      const last = [c.lastContactAt, c.updatedAt, c.stageChangedAt, c.createdAt].map(toBangkokDate).filter(Boolean).sort().pop()
      if (!last) return
      const days = dayNum(today) - dayNum(last)
      if (days >= staleDays) person(c.assignedTo).stale.push({ name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'ไม่มีชื่อ', days, model: c.interestedModel })
    })
  // นัดติดตาม Lead อัตโนมัติ (autoLead) ของลูกค้าที่จองไปแล้ว/เสียดีลแล้ว ไม่ต้องเตือนต่อ
  const custById = new Map((data.customers || []).map(c => [c.id, c]))
  const autoDone = f => {
    if (!f.autoLead) return false
    const c = custById.get(f.customerId)
    return !!c && (c.deleted || c.isLost || !['lead', 'pp'].includes(c.stage))
  }
  alive(data.followups)
    .filter(f => f.status === 'pending' && f.dueDate && f.dueDate <= today && !autoDone(f))
    .forEach(f => person(f.salesperson).fu.push({ name: f.customerName || 'ลูกค้า', late: f.dueDate < today }))
  alive(data.bookings)
    .filter(b => DELIVERED_STATUSES.includes(b.status) && (b.cutDate || b.actualDeliveryDate || '').startsWith(thisMonth) && !(Number(b.totalIncome) || 0))
    .forEach(b => person(b.salesName).income.push({ name: b.custName || 'ลูกค้า', model: b.model }))
  // ใบจองที่ยังไม่ส่งมอบ/ไม่ถอน จองมาเกิน STUCK_BOOKING_DAYS วัน — เกณฑ์เดียวกับ Intelligence Center บน Dashboard
  alive(data.bookings)
    .filter(b => !DELIVERED_STATUSES.includes(b.status) && !CANCELLED_STATUSES.includes(b.status) && /^\d{4}-\d{2}-\d{2}/.test(b.bookingDate || ''))
    .forEach(b => {
      const days = dayNum(today) - dayNum(b.bookingDate.slice(0, 10))
      if (days >= STUCK_BOOKING_DAYS) person(b.salesName).stuck.push({ name: b.custName || 'ลูกค้า', status: b.status || '—', days })
    })

  // นัดส่งมอบวันนี้/พรุ่งนี้ — ขึ้นก่อนเรื่องอื่น เพราะต้องเตรียมรถ/เอกสาร
  // "ตัดตัวเลขรอส่งมอบ" ยังไม่ได้ส่งรถจริง ต้องเตือนด้วย — ตัดออกเฉพาะที่ส่งมอบแล้วจริง/ถอนจอง
  alive(data.bookings)
    .filter(b => b.status !== 'ส่งมอบแล้ว' && !CANCELLED_STATUSES.includes(b.status) && /^\d{4}-\d{2}-\d{2}/.test(b.deliveryDate || ''))
    .forEach(b => {
      const inDays = dayNum(b.deliveryDate.slice(0, 10)) - dayNum(today)
      if (inDays === 0 || inDays === 1) person(b.salesName).deliver.push({ name: b.custName || 'ลูกค้า', model: b.model, time: b.deliveryTime, inDays })
    })
  // รถพร้อมส่ง (รอส่งมอบ/ตัดตัวเลขแล้ว) แต่ยังไม่ได้นัดวันส่งมอบ หรือวันนัดผ่านไปแล้ว (เกณฑ์เดียวกับ src/utils/myDay.js)
  alive(data.bookings)
    .filter(b => ['รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ'].includes(b.status))
    .forEach(b => {
      const dd = (b.deliveryDate || '').slice(0, 10)
      const has = /^\d{4}-\d{2}-\d{2}$/.test(dd)
      if (!has || dd < today) person(b.salesName).unsched.push({ name: b.custName || 'ลูกค้า', model: b.model, missed: has })
    })

  // ไฟแนนซ์รอผลเกิน 3 วัน / ไม่ผ่านแต่ยังไม่ถอนจอง (เกณฑ์เดียวกับ src/utils/myDay.js)
  alive(data.bookings)
    .filter(b => !DELIVERED_STATUSES.includes(b.status) && !CANCELLED_STATUSES.includes(b.status))
    .forEach(b => {
      const sent = /^\d{4}-\d{2}-\d{2}/.test(b.submitDate || '') ? b.submitDate.slice(0, 10) : (b.bookingDate || '').slice(0, 10)
      const days = /^\d{4}-\d{2}-\d{2}$/.test(sent) ? dayNum(today) - dayNum(sent) : 0
      if (b.finStatus === 'ไม่ผ่าน') person(b.salesName).fin.push({ name: b.custName || 'ลูกค้า', co: b.financeCo, rejected: true, days })
      else if ((b.finStatus === 'รอผล' || b.status === 'รอผลไฟแนนซ์') && days >= 3) person(b.salesName).fin.push({ name: b.custName || 'ลูกค้า', co: b.financeCo, rejected: false, days })
    })

  // นัดทดลองขับวันนี้ที่ยังไม่จบ
  alive(data.testDrives)
    .filter(t => (t.date || '').slice(0, 10) === today && ['scheduled', 'confirmed', 'in_progress'].includes(t.status || 'scheduled'))
    .forEach(t => person(t.staff).td.push({ name: t.customerName || 'ลูกค้า', model: t.model, time: t.time }))

  const list = items => {
    const shown = items.slice(0, maxNames).map(i => `      - ${i}`)
    if (items.length > maxNames) shown.push(`      - …และอีก ${items.length - maxNames} ราย`)
    return shown
  }
  return Object.entries(people)
    .map(([n, p]) => ({ n, p, total: p.deliver.length + p.unsched.length + p.td.length + p.fin.length + p.stale.length + p.fu.length + p.income.length + p.stuck.length }))
    .filter(x => x.total)
    .sort((a, b) => b.total - a.total || a.n.localeCompare(b.n))
    .map(({ n, p }) => {
      const out = [`👤 ${n}`]
      if (p.deliver.length) {
        p.deliver.sort((a, b) => a.inDays - b.inDays || String(a.time || '').localeCompare(String(b.time || '')))
        out.push(`  🚗 นัดส่งมอบวันนี้/พรุ่งนี้: ${p.deliver.length} คัน`, ...list(p.deliver.map(d => `${d.inDays ? 'พรุ่งนี้' : 'วันนี้'}${d.time ? ' ' + d.time : ''} · ${d.name}${d.model ? ` (${d.model})` : ''}`)))
      }
      if (p.unsched.length) {
        out.push(`  📆 รถพร้อมส่งแต่ยังไม่นัดวันส่งมอบ: ${p.unsched.length} คัน`, ...list(p.unsched.map(d => `${d.name}${d.model ? ` (${d.model})` : ''}${d.missed ? ' · เลยวันนัดแล้ว' : ''}`)))
      }
      if (p.td.length) {
        p.td.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
        out.push(`  🚙 นัดทดลองขับวันนี้: ${p.td.length} ราย`, ...list(p.td.map(t => `${t.time ? t.time + ' · ' : ''}${t.name}${t.model ? ` (${t.model})` : ''}`)))
      }
      if (p.fin.length) {
        p.fin.sort((a, b) => Number(b.rejected) - Number(a.rejected) || b.days - a.days)
        out.push(`  🏦 ไฟแนนซ์รอผลนาน/ไม่ผ่าน: ${p.fin.length} ราย`, ...list(p.fin.map(f => `${f.name}${f.co ? ` (${f.co})` : ''} · ${f.rejected ? 'ไม่ผ่าน ❗' : `รอ ${f.days} วัน`}`)))
      }
      if (p.stale.length) {
        p.stale.sort((a, b) => b.days - a.days)
        out.push(`  🧲 Lead ไม่ได้ติดตามเกิน ${staleDays} วัน: ${p.stale.length} ราย`, ...list(p.stale.map(s => `${s.name}${s.model ? ` (${s.model})` : ''} · ${s.days} วัน`)))
      }
      if (p.fu.length) out.push(`  📞 Follow-up วันนี้/เลยกำหนด: ${p.fu.length} ราย`, ...list(p.fu.map(f => `${f.name}${f.late ? ' ⚠️ เลยกำหนด' : ''}`)))
      if (p.income.length) out.push(`  💰 ส่งมอบแล้วยังไม่กรอกรายได้: ${p.income.length} คัน`, ...list(p.income.map(i => `${i.name}${i.model ? ` (${i.model})` : ''}`)))
      if (p.stuck.length) {
        p.stuck.sort((a, b) => b.days - a.days)
        out.push(`  ⏳ ใบจองค้างเกิน ${STUCK_BOOKING_DAYS} วัน: ${p.stuck.length} ใบ`, ...list(p.stuck.map(b => `${b.name} · ${b.status} · ${b.days} วัน`)))
      }
      return { name: n, text: out.join('\n') }
    })
}

export function buildMorningReminder(data, opts) {
  const { today } = opts
  const sections = buildMorningSections(data, opts).map(s => s.text)

  const text = [
    '☀️ LAMOM ONE เตือนงานเช้านี้',
    `🗓 ${formatThaiDate(today)}`,
    '─────────────────────',
    '',
    ...(sections.length ? sections.flatMap((s, i) => i ? ['', s] : [s]) : ['✅ ไม่มีงานค้าง ขอให้ขายดีทั้งวันครับ 🎉']),
    '',
    '─────────────────────',
    '🤖 LAMOM ONE Auto Reminder',
  ].join('\n')
  return clipLine(text)
}

// LINE รับข้อความได้ไม่เกิน 5,000 ตัวอักษร — ตัดท้ายแทนที่จะส่งไม่ออกทั้งข้อความ
function clipLine(text) {
  return text.length > 4900 ? text.slice(0, 4850) + '\n…(ตัดข้อความ ดูต่อในแอป)' : text
}

// ข้อความส่วนตัวของเซลส์ 1 คน (ส่วนของตัวเองจาก buildMorningSections)
// appUrl = origin ของแอป (env.ALLOWED_ORIGIN) — ใส่ลิงก์เปิดหน้า "งานของฉันวันนี้" ที่กดทำงานได้ทันที
// goal = { done, target } เป้าส่งมอบเดือนนี้ของเซลส์คนนี้ (ตั้งที่หน้ารายได้รายเซลส์) — ไม่มีเป้าไม่แสดง
export function buildPersonalReminder(section, today, appUrl = '', goal = null) {
  return clipLine([
    '☀️ งานค้างของคุณเช้านี้',
    `🗓 ${formatThaiDate(today)}`,
    goal?.target ? `🎯 เป้าเดือนนี้: ส่งมอบแล้ว ${goal.done}/${goal.target} คัน${goal.done >= goal.target ? ' ถึงเป้าแล้ว! 🎉' : ` (เหลือ ${goal.target - goal.done} คัน)`}` : null,
    '',
    section.text,
    '',
    '💡 โทรเสร็จพิมพ์ "โทรแล้ว เบอร์" · นัดต่อพิมพ์ "นัด เบอร์ พรุ่งนี้"',
    appUrl ? `👉 กดทำงานได้ที่: ${String(appUrl).replace(/\/+$/, '')}/crm/my-day` : 'เปิดแอป LAMOM ONE เพื่อจัดการได้เลยครับ 💪',
  ].filter(l => l !== null).join('\n'))
}

// เป้ารายเซลส์: sales_targets/{YYYY-MM} = { targets: { ชื่อ: คัน } } (ดู src/utils/salesTargets.js)
async function readSalesGoals(env, accessToken, month) {
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/sales_targets/${month}`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) return {}
    const doc = await res.json()
    return doc.fields?.targets ? decodeFsValue(doc.fields.targets) || {} : {}
  } catch { return {} }
}
export function sellerGoal(data, goals, name, today) {
  const key = normSalesName(name)
  const entry = Object.entries(goals || {}).find(([n]) => normSalesName(n) === key)
  const target = entry ? Number(entry[1]) || 0 : 0
  if (!target) return null
  const month = today.slice(0, 7)
  const done = (data.bookings || []).filter(b => b && !b.deleted && DELIVERED_STATUSES.includes(b.status)
    && (b.cutDate || b.actualDeliveryDate || '').startsWith(month) && normSalesName(b.salesName) === key).length
  return { done, target }
}

// เทียบชื่อแบบไม่สนช่องว่าง/ตัวพิมพ์ คำนำหน้า "คุณ" — ชื่อที่ลงทะเบียนต้องตรงกับชื่อเซลส์/ผู้ดูแลในแอป
export function normSalesName(n) {
  return String(n || '').toLowerCase().replace(/^คุณ/, '').replace(/[\s.]/g, '')
}
export function matchSalesTargets(sections, targets) {
  const out = []
  ;(targets || []).forEach(t => {
    const key = normSalesName(t.name)
    const section = key && t.userId && (sections || []).find(s => normSalesName(s.name) === key)
    if (section) out.push({ name: section.name, userId: t.userId, section })
  })
  return out
}

export function isMonday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 1
}

// ── สรุปรายสัปดาห์ (ส่งเช้าวันจันทร์) — 7 วันก่อนหน้า (จันทร์–อาทิตย์) เทียบกับสัปดาห์ก่อนนั้น ──────
export function buildWeeklyReport(data, { today }) {
  const shift = (d, n) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10) }
  const weeks = [[shift(today, -7), shift(today, -1)], [shift(today, -14), shift(today, -8)]]
  const alive = rows => (rows || []).filter(r => r && !r.deleted)
  const bookings = alive(data.bookings)
  const customers = alive(data.customers)
  const inRange = (d, [a, b]) => !!d && d >= a && d <= b
  const isCancelled = b => CANCELLED_STATUSES.includes(b.status)
  const cut = b => (b.cutDate || b.actualDeliveryDate || '').slice(0, 10)

  const stats = range => {
    const delivered = bookings.filter(b => DELIVERED_STATUSES.includes(b.status) && inRange(cut(b), range))
    return {
      leads: customers.filter(c => inRange(toBangkokDate(c.createdAt), range)).length,
      booked: bookings.filter(b => inRange((b.bookingDate || '').slice(0, 10), range) && !isCancelled(b)).length,
      delivered: delivered.length,
      income: delivered.reduce((t, b) => t + (Number(b.totalIncome) || 0), 0),
      missing: delivered.filter(b => !(Number(b.totalIncome) || 0)).length,
      cancelled: bookings.filter(b => isCancelled(b) && inRange((b.cancelDate || b.bookingDate || '').slice(0, 10), range)).length,
      delivList: delivered,
    }
  }
  const [cur, prev] = weeks.map(stats)
  const diff = (a, b) => a === b ? '➖ เท่าเดิม' : a > b ? `🔺 +${a - b}` : `🔻 −${b - a}`
  const diffBaht = (a, b) => a === b ? '➖ เท่าเดิม' : a > b ? `🔺 +${fmtBaht(a - b)}` : `🔻 −${fmtBaht(b - a)}`

  const sellers = {}
  const seller = n => (sellers[(n || '').trim() || '(ไม่ระบุ)'] ||= { bk: 0, dlv: 0, inc: 0 })
  bookings.forEach(b => { if (inRange((b.bookingDate || '').slice(0, 10), weeks[0]) && !isCancelled(b)) seller(b.salesName).bk++ })
  cur.delivList.forEach(b => { const s = seller(b.salesName); s.dlv++; s.inc += Number(b.totalIncome) || 0 })
  const medals = ['🥇', '🥈', '🥉']
  const sellerLines = Object.entries(sellers)
    .sort(([, a], [, b]) => b.dlv - a.dlv || b.inc - a.inc || b.bk - a.bk)
    .map(([n, v], i) => `  ${medals[i] || '•'} ${n}: ส่งมอบ ${v.dlv} · จอง ${v.bk} · รายได้ ${fmtBaht(v.inc)}`)

  // ช่องทาง: Lead ใหม่สัปดาห์ที่แล้วมาจากไหน + 90 วันล่าสุดช่องทางไหนปิดเป็นใบจองได้ดีที่สุด (ต้องมีอย่างน้อย 3 ราย)
  const srcName = c => SOURCE_LABELS[c.source] || SOURCE_LABELS.other
  const weekSrc = {}
  customers.filter(c => inRange(toBangkokDate(c.createdAt), weeks[0])).forEach(c => { weekSrc[srcName(c)] = (weekSrc[srcName(c)] || 0) + 1 })
  const srcWeekLine = Object.entries(weekSrc).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')
  const conv = {}
  customers.filter(c => inRange(toBangkokDate(c.createdAt), [shift(today, -90), shift(today, -1)])).forEach(c => {
    const r = (conv[srcName(c)] ||= { n: 0, bk: 0 })
    r.n++
    if (['booking', 'delivered'].includes(c.stage) || c.bookingId) r.bk++
  })
  const convLines = Object.entries(conv).filter(([, v]) => v.n >= 3)
    .map(([k, v]) => ({ k, ...v, pct: Math.round(v.bk / v.n * 100) }))
    .sort((a, b) => b.pct - a.pct || b.n - a.n).slice(0, 5)
    .map(r => `  • ${r.k}: จอง ${r.bk}/${r.n} ราย (${r.pct}%)`)

  // การติดตามลูกค้า: นัดที่ครบกำหนดสัปดาห์ที่แล้ว ทำแล้วกี่ % (ต้องมีข้อมูลนัดที่ทำแล้วส่งมาด้วย) + ใครค้างมากสุด
  let fuLines = []
  if (Array.isArray(data.followupsDone)) {
    const inWeek = f => inRange(String(f.dueDate || '').slice(0, 10), weeks[0])
    const done = alive(data.followupsDone).filter(f => f.status === 'done' && inWeek(f))
    const late = alive(data.followups).filter(f => f.status === 'pending' && inWeek(f))
    if (done.length + late.length) {
      const pct = Math.round(done.length / (done.length + late.length) * 100)
      const bySeller = {}
      late.forEach(f => { const k = (f.salesperson || '').trim() || '(ไม่ระบุ)'; bySeller[k] = (bySeller[k] || 0) + 1 })
      const worst = Object.entries(bySeller).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(' · ')
      fuLines = ['', `📞 ติดตามลูกค้าตามนัด: ทำแล้ว ${done.length}/${done.length + late.length} นัด (${pct}%)`, worst ? `    ยังค้าง: ${worst}` : null]
    }
  }

  // Lead/Prospect ที่เงียบไป 7 วันขึ้นไป (ไม่มีการติดต่อ/แก้ไข/เปลี่ยนสถานะ) — เสี่ยงหลุด แยกตามผู้ดูแล
  const dayNum = d => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd) / 86400000 }
  const quietBy = {}
  let quietN = 0
  customers.filter(c => ['lead', 'pp'].includes(c.stage) && !c.isLost).forEach(c => {
    const last = [c.lastContactAt, c.updatedAt, c.stageChangedAt, c.createdAt].map(toBangkokDate).filter(Boolean).sort().pop()
    if (!last || dayNum(today) - dayNum(last) < 7) return
    quietN++
    const k = (c.assignedTo || '').trim() || '(ยังไม่มีผู้ดูแล)'
    quietBy[k] = (quietBy[k] || 0) + 1
  })
  const quietTop = Object.entries(quietBy).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(' · ')
  const quietLines = quietN ? ['', `💤 Lead/Prospect เงียบ 7 วัน+: ${quietN} ราย`, `    มากสุด: ${quietTop}`] : []

  return [
    '📅 LAMOM ONE สรุปสัปดาห์ที่แล้ว',
    `🗓 ${formatThaiDate(weeks[0][0])} – ${formatThaiDate(weeks[0][1])}`,
    '─────────────────────',
    '',
    `👥 Lead ใหม่: ${cur.leads} ราย (${diff(cur.leads, prev.leads)})`,
    srcWeekLine ? `    มาจาก: ${srcWeekLine}` : null,
    `📋 จองใหม่: ${cur.booked} คัน (${diff(cur.booked, prev.booked)})`,
    `✅ ส่งมอบ: ${cur.delivered} คัน (${diff(cur.delivered, prev.delivered)})`,
    `💰 รายได้: ${fmtBaht(cur.income)} (${diffBaht(cur.income, prev.income)})`,
    cur.missing ? `  ⚠️ ยังไม่กรอกรายได้ ${cur.missing} คัน — ตัวเลขจริงสูงกว่านี้` : null,
    `❌ ถอนจอง: ${cur.cancelled} คัน (${diff(cur.cancelled, prev.cancelled)})`,
    ...(sellerLines.length ? ['', '👤 ทีมขาย (สัปดาห์ที่แล้ว)', ...sellerLines] : []),
    ...fuLines,
    ...quietLines,
    ...(convLines.length ? ['', '🎯 ช่องทางที่ปิดจองได้ดี (Lead 90 วันล่าสุด)', ...convLines] : []),
    '',
    '─────────────────────',
    '🤖 LAMOM ONE Weekly Report',
  ].filter(l => l !== null).join('\n')
}

function fmtBaht(n) { return `${Math.round(n || 0).toLocaleString('en-US')} บาท` }

// createdAt เก็บเป็น timestamp (UTC) — ต้องแปลงเป็นวันที่ไทยก่อนเทียบกับ "วันนี้" ไม่งั้นช่วง 00:00–07:00 จะตกวันผิด
export function toBangkokDate(v) {
  if (!v || typeof v !== 'string') return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const t = Date.parse(v)
  if (Number.isNaN(t)) return v.slice(0, 10)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t))
}

// ── ส่ง Telegram ────────────────────────────────────────────────
async function sendTelegram(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return { configured: false, error: 'Telegram ยังไม่ได้ตั้งค่า (ต้องตั้ง secret TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)' }
  }
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  })
  if (res.ok) return { configured: true, sent: true }
  const data = await res.json().catch(() => ({}))
  return { configured: true, sent: false, error: data.description || `Telegram ${res.status}` }
}

// ── ส่ง LINE — push เจาะจงคนเดียว (ไม่ broadcast หาลูกค้า ตามที่เลือกไว้) ──────────
async function sendLineTarget(env, accessToken, text) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
    return { configured: false, error: 'LINE ยังไม่ได้ตั้งค่า (ต้องตั้ง secret LINE_CHANNEL_ACCESS_TOKEN)' }
  }
  const targetId = env.LINE_TARGET_ID || await readLineTarget(env, accessToken)
  if (!targetId) {
    return { configured: true, sent: false, error: 'ยังไม่มี LINE User ID ปลายทาง — ตั้ง webhook URL ของ worker นี้ (…/line/webhook) ไว้ใน LINE Console แล้วทัก LINE OA ครั้งแรก ระบบจะจับ userId ให้อัตโนมัติ' }
  }
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: targetId, messages: [{ type: 'text', text }] }),
  })
  if (res.ok) return { configured: true, sent: true }
  const data = await res.json().catch(() => ({}))
  return { configured: true, sent: false, error: data.message || `LINE ${res.status}` }
}

async function readLineTarget(env, accessToken) {
  if (!accessToken) return null
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/system_integrations/line_daily_report`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const doc = await res.json()
    return doc.fields?.userId?.stringValue || null
  } catch { return null }
}
async function writeLineTarget(env, accessToken, userId) {
  try {
    await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/system_integrations/line_daily_report`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { userId: { stringValue: userId }, capturedAt: { timestampValue: new Date().toISOString() } } }),
    })
  } catch { /* ครั้งหน้าทักมาใหม่ก็จับได้อีก ไม่ critical ถ้าครั้งนี้เขียนไม่สำเร็จ */ }
}
// LINE ของเซลส์แต่ละคน: collection line_sales_targets/{userId} = { name, userId }
async function writeSalesTarget(env, accessToken, userId, name) {
  await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/line_sales_targets/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { name: { stringValue: name }, userId: { stringValue: userId }, registeredAt: { timestampValue: new Date().toISOString() } } }),
  }).catch(() => {})
}
export const LINE_HELP_TEXT = [
  '📖 คำสั่งที่ใช้ได้ใน LINE นี้',
  '• งาน — ดูงานค้างของคุณตอนนี้',
  '• พรุ่งนี้ — ดูนัด/ส่งมอบ/ทดลองขับของพรุ่งนี้',
  '• ยอด — ดูยอดส่งมอบ/รายได้/จองของคุณเดือนนี้',
  '• หา 0812345678 / หา สมชาย — ค้นหาลูกค้า',
  '• โทรแล้ว 0812345678 / โทรแล้ว สมชาย — บันทึกว่าติดต่อลูกค้าแล้ว',
  '• นัด 0812345678 พรุ่งนี้ / นัด สมชาย 28/10 — นัดติดตามลูกค้า',
  '• สรุป — รายงานยอดวันนี้ (เฉพาะเจ้าของ)',
  '• ลงทะเบียน ชื่อเซลส์ — รับงานค้างทุก 9 โมงเช้า',
  '• ยกเลิก — หยุดรับ',
].join('\n')
const CUST_STAGE = { lead: 'Lead', pp: 'Prospect', booking: 'จองแล้ว', delivered: 'ส่งมอบแล้ว' }
// ค้นหาลูกค้า: ตัวเลข ≥ 4 หลัก = เทียบเบอร์ (เฉพาะตัวเลข) ไม่งั้นเทียบชื่อ/LINE ID แบบมีคำนี้อยู่ — ตอบสูงสุด 5 ราย
export function matchCustomers(customers, q) {
  const pkey = p => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('66') && d.length === 11 ? '0' + d.slice(2) : d } // +66 = 0
  const digits = pkey(q)
  const needle = String(q).trim().toLowerCase()
  const byPhone = digits.length >= 4 && /^\+?[\d\s\-]+$/.test(String(q).trim())
  return (customers || []).filter(c => c && !c.deleted).filter(c => byPhone
    ? pkey(c.phone).includes(digits)
    : `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().includes(needle) || String(c.lineId || '').toLowerCase().includes(needle))
}
const custFullName = c => [c.firstName, c.lastName].filter(Boolean).join(' ') || 'ไม่มีชื่อ'
// คำสั่ง "โทรแล้ว ..." ต้องเจอลูกค้ารายเดียว — เจอหลายรายให้พิมพ์เจาะจงขึ้น (กันบันทึกผิดคน)
export function pickTouchTarget(customers, q) {
  const list = matchCustomers(customers, q)
  if (list.length === 1) return { customer: list[0] }
  if (!list.length) return { reply: `🔍 ไม่พบลูกค้า "${q}" (ค้นเฉพาะลูกค้าที่คุณดูแล)` }
  return { reply: [`พบ ${list.length} ราย — พิมพ์ให้เจาะจงขึ้น เช่น "โทรแล้ว 0812345678"`, ...list.slice(0, 5).map(c => `• ${custFullName(c)} · 📱 ${c.phone || '-'}`)].join('\n') }
}
// แก้เฉพาะ field ที่ระบุ (updateMask) และต้องมีเอกสารอยู่แล้ว (currentDocument.exists) — ห้าม PATCH ทั้งเอกสาร
// เพราะจะลบ field อื่นของลูกค้าทิ้งหมด / firstContactAt ใส่เฉพาะครั้งแรก (ใช้วัดความเร็วติดต่อ Lead ในแอป)
export function customerContactPatch(customer, nowIso) {
  const fields = { lastContactAt: { stringValue: nowIso }, updatedAt: { timestampValue: nowIso } }
  if (!customer.firstContactAt) fields.firstContactAt = { stringValue: nowIso }
  const mask = Object.keys(fields).map(f => `updateMask.fieldPaths=${f}`).join('&')
  return { query: `${mask}&currentDocument.exists=true`, body: { fields } }
}
async function patchCustomerContact(env, accessToken, customer, nowIso) {
  const { query, body } = customerContactPatch(customer, nowIso)
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/customers/${encodeURIComponent(customer.id)}?${query}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok
  } catch { return false }
}
// วันนัดจากคำที่เซลส์พิมพ์ → 'YYYY-MM-DD' (null = ไม่เข้าใจ): วันนี้/พรุ่งนี้/มะรืน, "3วัน"/"+3", "28/10", "28/10/69" (พ.ศ. 2 หลัก),
// "28/10/2569" หรือ "28/10/2026" — วัน/เดือนที่ไม่ระบุปีและผ่านไปแล้วปีนี้ = ปีหน้า
export function parseThaiDue(token, today) {
  const t = String(token || '').trim()
  const [ty, tm, td] = today.split('-').map(Number)
  const plus = n => new Date(Date.UTC(ty, tm - 1, td + n)).toISOString().slice(0, 10)
  if (t === 'วันนี้') return today
  if (t === 'พรุ่งนี้') return plus(1)
  if (/^มะรืน(?:นี้)?$/.test(t)) return plus(2)
  const n = t.match(/^\+?(\d{1,3})\s*วัน$/) || t.match(/^\+(\d{1,3})$/)
  if (n) return plus(Number(n[1]))
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/)
  if (!m) return null
  const d = Number(m[1]), mo = Number(m[2])
  let y = ty
  if (m[3]) {
    y = Number(m[3])
    if (m[3].length === 2) y = y >= 50 ? 2500 + y - 543 : 2000 + y
    else if (y > 2400) y -= 543
  }
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null // เช่น 31/02
  let out = dt.toISOString().slice(0, 10)
  if (!m[3] && out < today) out = new Date(Date.UTC(y + 1, mo - 1, d)).toISOString().slice(0, 10)
  return out
}
export function buildPlannedFollowupFields(customer, { dueDate, salesperson, now }) {
  const str = v => ({ stringValue: String(v ?? '') })
  return {
    customerId: str(customer.id), customerName: str(custFullName(customer)), phone: str(customer.phone), vehicleModel: str(customer.interestedModel),
    salesperson: str(salesperson), type: str('call'), purpose: str('ทั่วไป'), note: str('นัดผ่าน LINE'),
    dueDate: str(dueDate), status: str('pending'), result: str(''),
    companyId: customer.companyId ? str(customer.companyId) : { nullValue: null },
    createdAt: { timestampValue: now }, updatedAt: { timestampValue: now },
  }
}
export function findCustomersText(customers, followups, q, today) {
  const list = matchCustomers(customers, q)
  if (!list.length) return `🔍 ไม่พบลูกค้า "${q}"`
  const next = id => (followups || []).filter(f => f && !f.deleted && f.status === 'pending' && f.customerId === id && f.dueDate)
    .map(f => String(f.dueDate).slice(0, 10)).sort()[0]
  const lines = list.slice(0, 5).map(c => {
    const n = next(c.id)
    return [`👤 ${[c.firstName, c.lastName].filter(Boolean).join(' ') || 'ไม่มีชื่อ'}${c.isLost ? ' (เสียดีล)' : ''} · ${CUST_STAGE[c.stage] || c.stage || '-'}`,
      `   📱 ${c.phone || '-'}${c.interestedModel ? ` · 🚗 ${c.interestedModel}` : ''}`,
      `   ผู้ดูแล: ${String(c.assignedTo || '').trim() || '⚠️ ยังไม่มี'}${n ? ` · นัดถัดไป ${n < today ? `⚠️ เลยกำหนด (${formatThaiDate(n)})` : formatThaiDate(n)}` : ''}`].join('\n')
  })
  return [`🔍 พบ ${list.length} ราย${list.length > 5 ? ' (แสดง 5 รายแรก)' : ''}`, ...lines].join('\n')
}
async function readSalesTarget(env, accessToken, userId) {
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/line_sales_targets/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) return null
    const doc = await res.json()
    return { name: doc.fields?.name?.stringValue || '' }
  } catch { return null }
}
// ตอบคำสั่ง "งาน" — งานค้างของเซลส์คนนี้ ณ ตอนนี้ (เนื้อหาเดียวกับข้อความ 9 โมงเช้า)
async function buildTasksReply(env, accessToken, name) {
  try {
    const { sections, today, data } = await buildMorningData(env, accessToken)
    const goals = await readSalesGoals(env, accessToken, today.slice(0, 7))
    return tasksReplyText(sections, name, today, env.ALLOWED_ORIGIN, sellerGoal(data, goals, name, today))
  } catch { return '⚠️ ดึงงานค้างไม่สำเร็จ ลองใหม่อีกครั้งครับ' }
}
// คำสั่ง "ยอด" — ตัวเลขเดือนนี้ของเซลส์คนนี้ (นิยามเดียวกับรายงาน 18:00/หน้ารายได้รายเซลส์: ส่งมอบนับตามวันตัดตัวเลข)
export function myStatsText(data, name, today, goal = null) {
  const TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
  const month = today.slice(0, 7)
  const [y, m] = month.split('-').map(Number)
  const me = normSalesName(name)
  const mine = (data.bookings || []).filter(b => b && !b.deleted && normSalesName(b.salesName) === me)
  const dlv = mine.filter(b => DELIVERED_STATUSES.includes(b.status) && (b.cutDate || b.actualDeliveryDate || '').startsWith(month))
  const income = dlv.reduce((t, b) => t + (Number(b.totalIncome) || 0), 0)
  const missing = dlv.filter(b => !(Number(b.totalIncome) || 0)).length
  const booked = mine.filter(b => (b.bookingDate || '').startsWith(month) && !CANCELLED_STATUSES.includes(b.status)).length
  const cancelled = mine.filter(b => CANCELLED_STATUSES.includes(b.status) && (b.cancelDate || b.bookingDate || '').startsWith(month)).length
  const pending = mine.filter(b => PENDING_STATUSES.includes(b.status) && b.status !== 'ตัดตัวเลขรอส่งมอบ').length
  return [
    `📊 ยอดของคุณ${TH[m - 1]} ${y + 543}`,
    goal?.target ? `🎯 เป้าส่งมอบ: ${goal.done}/${goal.target} คัน (${Math.round(goal.done / goal.target * 100)}%)${goal.done >= goal.target ? ' ถึงเป้าแล้ว! 🎉' : ''}` : null,
    `✅ ส่งมอบ: ${dlv.length} คัน · 💰 รายได้ ${fmtBaht(income)}${missing ? ` (ยังไม่กรอกรายได้ ${missing} คัน)` : ''}`,
    `📋 จองใหม่: ${booked} คัน${cancelled ? ` · ❌ ถอนจอง ${cancelled} คัน` : ''}`,
    `🚗 ใบจองที่ยังไม่ส่งมอบ: ${pending} คัน`,
  ].filter(Boolean).join('\n')
}
// คำสั่ง "พรุ่งนี้" — นัดติดตาม/ส่งมอบ/ทดลองขับของเซลส์คนนี้ในวันพรุ่งนี้ (เทียบชื่อแบบเดียวกับเตือน 9 โมง)
export function buildTomorrowText(data, name, today) {
  const [y, m, d] = today.split('-').map(Number)
  const tmr = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
  const me = normSalesName(name)
  const isMe = n => normSalesName(n) === me
  const alive = rows => (rows || []).filter(r => r && !r.deleted)
  const fus = alive(data.followups).filter(f => f.status === 'pending' && String(f.dueDate || '').slice(0, 10) === tmr && isMe(f.salesperson))
  const dlv = alive(data.bookings).filter(b => (b.deliveryDate || '').slice(0, 10) === tmr && b.status !== 'ส่งมอบแล้ว' && !CANCELLED_STATUSES.includes(b.status) && isMe(b.salesName))
    .sort((a, b) => String(a.deliveryTime || '').localeCompare(String(b.deliveryTime || '')))
  const tds = alive(data.testDrives).filter(t => (t.date || '').slice(0, 10) === tmr && ['scheduled', 'confirmed'].includes(t.status || 'scheduled') && isMe(t.staff))
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
  if (!fus.length && !dlv.length && !tds.length) return `📅 พรุ่งนี้ (${formatThaiDate(tmr)}) ยังไม่มีนัดของ "${name}" ครับ\nพิมพ์ "นัด เบอร์ พรุ่งนี้" เพื่อนัดลูกค้าได้เลย`
  const cap = (arr, f) => [...arr.slice(0, 10).map(f), ...(arr.length > 10 ? [`  - …และอีก ${arr.length - 10} ราย`] : [])]
  return [
    `📅 งานพรุ่งนี้ของคุณ (${formatThaiDate(tmr)})`,
    ...(dlv.length ? ['', `🚗 ส่งมอบรถ ${dlv.length} คัน`, ...cap(dlv, b => `  - ${b.deliveryTime ? b.deliveryTime + ' ' : ''}${b.custName || 'ลูกค้า'}${b.model ? ` (${b.model})` : ''}`)] : []),
    ...(tds.length ? ['', `🔑 ทดลองขับ ${tds.length} ราย`, ...cap(tds, t => `  - ${t.time ? t.time + ' ' : ''}${t.customerName || 'ลูกค้า'}${t.model ? ` (${t.model})` : ''}`)] : []),
    ...(fus.length ? ['', `📞 นัดติดตาม ${fus.length} ราย`, ...cap(fus, f => `  - ${f.customerName || 'ลูกค้า'}`)] : []),
  ].join('\n')
}
export function tasksReplyText(sections, name, today, appUrl = '', goal = null) {
  const m = matchSalesTargets(sections, [{ name, userId: '-' }])[0]
  if (m) return buildPersonalReminder(m.section, today, appUrl, goal).replace('☀️ งานค้างของคุณเช้านี้', '📋 งานค้างของคุณตอนนี้')
  return [`✅ ตอนนี้ไม่มีงานค้างของ "${name}" ครับ`,
    goal?.target ? `🎯 เป้าเดือนนี้: ส่งมอบแล้ว ${goal.done}/${goal.target} คัน` : null,
    '(ถ้าคิดว่ามีงาน ตรวจว่าชื่อที่ลงทะเบียนตรงกับชื่อเซลส์/ผู้ดูแลในแอป)'].filter(Boolean).join('\n')
}
async function deleteSalesTarget(env, accessToken, userId) {
  await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/line_sales_targets/${encodeURIComponent(userId)}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {})
}
// ลูกค้าทัก LINE OA → สร้างลูกค้าใหม่ (ที่มา LINE) ครั้งแรกครั้งเดียวต่อ LINE userId ไม่สร้างให้เซลส์ที่ลงทะเบียนไว้
// ถ้าเปิด AUTO_ASSIGN_LINE_LEADS="1" ด้วย: แจกให้เซลส์ที่ลงทะเบียน LINE ไว้แบบวนคิว (คนละรายเรียงตามชื่อ)
// สร้างนัดติดตามวันที่ 1/3/7 (แผนเดียวกับ src/utils/leadFollowups.js) และส่ง LINE บอกเซลส์คนนั้นทันที
async function captureLineLead(env, accessToken, userId, firstText) {
  const base = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
  const sales = await fetch(`${base}/line_sales_targets/${encodeURIComponent(userId)}`, { headers })
  if (sales.ok) return null
  const q = await fetch(`${base}:runQuery`, {
    method: 'POST', headers,
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'customers' }], where: { fieldFilter: { field: { fieldPath: 'lineUserId' }, op: 'EQUAL', value: { stringValue: userId } } }, limit: 1 } }),
  })
  const found = q.ok ? await q.json() : []
  if (!q.ok || (Array.isArray(found) && found.some(r => r.document))) return null
  let displayName = ''
  try {
    const p = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` } })
    if (p.ok) displayName = (await p.json()).displayName || ''
  } catch { /* ไม่มีชื่อก็สร้างได้ */ }

  let assignee = null
  let companyId = env.LINE_LEAD_COMPANY_ID || null
  if (env.AUTO_ASSIGN_LINE_LEADS === '1') {
    const targets = await runQuery(env, accessToken, 'line_sales_targets', null, null, 500, ['name', 'userId']).catch(() => [])
    const rr = await fetch(`${base}/system_integrations/line_lead_rr`, { headers }).then(r => (r.ok ? r.json() : {})).catch(() => ({}))
    assignee = pickNextSales(targets, rr.fields?.lastName?.stringValue || '')
    if (assignee) {
      await fetch(`${base}/system_integrations/line_lead_rr`, {
        method: 'PATCH', headers, body: JSON.stringify({ fields: { lastName: { stringValue: assignee.name }, at: { timestampValue: new Date().toISOString() } } }),
      }).catch(() => {})
      // ใส่บริษัทของเซลส์คนนั้นให้ลูกค้า (ไม่งั้นกฎความปลอดภัยของฐานข้อมูลจะซ่อนลูกค้าจากเซลส์)
      if (!companyId) {
        const staff = await runQuery(env, accessToken, 'staff', null, null, 1000, ['firstName', 'lastName', 'nickname', 'companyId', 'companyIds']).catch(() => [])
        companyId = staffCompanyFor(staff, assignee.name)
      }
    }
  }

  const now = new Date().toISOString()
  const fields = buildLineLeadFields({ userId, displayName, firstText, now, companyId, assignedTo: assignee?.name || '' })
  // id ตายตัวต่อ LINE userId — ลูกค้าพิมพ์รัวหลายข้อความพร้อมกัน webhook มาหลายครั้งพร้อมกันก็สร้างได้คนเดียว (ซ้ำ = 409)
  const res = await fetch(`${base}/customers?documentId=${encodeURIComponent(lineLeadDocId(userId))}`, { method: 'POST', headers, body: JSON.stringify({ fields }) })
  if (!res.ok) return false
  if (!assignee) return true
  const created = await res.json().catch(() => ({}))
  const customerId = String(created.name || '').split('/').pop()
  const customerName = fields.firstName.stringValue + (fields.lastName.stringValue ? ' ' + fields.lastName.stringValue : '')
  for (const f of buildLineFollowupFields({ customerId, customerName, salesperson: assignee.name, companyId, today: todayBangkok(), now })) {
    await fetch(`${base}/followups`, { method: 'POST', headers, body: JSON.stringify({ fields: f }) }).catch(() => {})
  }
  await pushLine(env, assignee.userId, buildNewLineLeadNotice({ customerName, firstText, customerId, appUrl: env.ALLOWED_ORIGIN }))
  return true
}

export const lineLeadDocId = userId => `line_${String(userId).replace(/[^A-Za-z0-9_-]/g, '')}`

// วนคิวเซลส์: เรียงตามชื่อ (ตัดชื่อซ้ำ) แล้วเลือกคนถัดจากคนที่ได้ล่าสุด — export ไว้เทส
export function pickNextSales(targets, lastName) {
  const seen = new Set()
  const list = (targets || [])
    .filter(t => t && t.userId && String(t.name || '').trim())
    .filter(t => { const k = normSalesName(t.name); if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a, b) => normSalesName(a.name).localeCompare(normSalesName(b.name)))
  if (!list.length) return null
  const i = list.findIndex(t => normSalesName(t.name) === normSalesName(lastName))
  return list[(i + 1) % list.length]
}

// หา companyId ของพนักงานจากชื่อ (ชื่อ-นามสกุล หรือชื่อเล่น) — ไม่เจอคืน null
export function staffCompanyFor(staff, name) {
  const key = normSalesName(name)
  const s = (staff || []).find(x => [`${x.firstName || ''}${x.lastName || ''}`, x.firstName, x.nickname].some(n => n && normSalesName(n) === key))
  if (!s) return null
  return (Array.isArray(s.companyIds) && s.companyIds[0]) || s.companyId || null
}

// นัดติดตาม 3 ครั้ง (+1, +3, +7 วัน) ในรูป Firestore REST fields — ต้องตรงกับ LEAD_FOLLOWUP_PLAN ใน src/utils/leadFollowups.js
const LINE_FOLLOWUP_PLAN = [
  { days: 1, type: 'call', note: 'ครั้งที่ 1: โทรแนะนำตัว ถามความต้องการ งบ และรุ่นที่สนใจ' },
  { days: 3, type: 'line', note: 'ครั้งที่ 2: ส่งรูป สเปก และโปรโมชันรุ่นที่สนใจทาง LINE' },
  { days: 7, type: 'call', note: 'ครั้งที่ 3: ชวนทดลองขับ หรือนัดเข้าโชว์รูม' },
]
export function buildLineFollowupFields({ customerId, customerName, salesperson, companyId = null, today, now }) {
  const str = v => ({ stringValue: String(v ?? '') })
  const [y, m, d] = today.split('-').map(Number)
  return LINE_FOLLOWUP_PLAN.map(p => ({
    customerId: str(customerId), customerName: str(customerName), phone: str(''), vehicleModel: str(''),
    salesperson: str(salesperson), type: str(p.type), purpose: str('ติดตาม Lead ใหม่'), note: str(p.note),
    dueDate: str(new Date(Date.UTC(y, m - 1, d + p.days)).toISOString().slice(0, 10)), status: str('pending'), result: str(''),
    autoLead: { booleanValue: true }, companyId: companyId ? str(companyId) : { nullValue: null },
    createdAt: { timestampValue: now }, updatedAt: { timestampValue: now },
  }))
}

export function buildNewLineLeadNotice({ customerName, firstText, customerId, appUrl = '' }) {
  return clipLine([
    '🧲 ลูกค้าใหม่จาก LINE OA มอบให้คุณดูแล',
    `👤 ${customerName}`,
    firstText ? `💬 "${String(firstText).slice(0, 300)}"` : '',
    '📞 นัดติดตามให้แล้ว: พรุ่งนี้, อีก 3 วัน, อีก 7 วัน',
    'ตอบลูกค้าได้ในแอป LINE Official Account',
    appUrl && customerId ? `👉 ${String(appUrl).replace(/\/+$/, '')}/crm/customers?id=${encodeURIComponent(customerId)}` : '',
  ].filter(Boolean).join('\n'))
}

// เอกสารลูกค้าแบบเดียวกับที่แอปสร้าง (ดู src/utils/quickLead.js) ในรูป Firestore REST fields — export ไว้เทส
// companyId ว่าง = เห็นเฉพาะเจ้าของโปรแกรม/ผู้ดูทั้งกลุ่ม (ตาม firestore.rules) — ตั้ง var LINE_LEAD_COMPANY_ID ให้เซลส์บริษัทนั้นเห็นด้วย
export function buildLineLeadFields({ userId, displayName, firstText, now, companyId = null, assignedTo = '' }) {
  const str = v => ({ stringValue: String(v ?? '') })
  const parts = String(displayName || '').trim().split(/\s+/).filter(Boolean)
  const note = firstText ? `ทักมาทาง LINE OA: "${String(firstText).slice(0, 200)}"` : 'ทักมาทาง LINE OA'
  return {
    firstName: str(parts[0] || 'ลูกค้า LINE'), lastName: str(parts.slice(1).join(' ')),
    phone: str(''), lineId: str(displayName ? `LINE: ${displayName}` : 'LINE OA'), lineUserId: str(userId), email: str(''),
    interestedModel: str(''), source: str('line'), temperature: { nullValue: null }, assignedTo: str(assignedTo),
    vip: { booleanValue: false }, notes: str(note), budget: { integerValue: '0' }, occupation: str(''), monthlyIncome: { integerValue: '0' },
    stage: str('pp'), isLost: { booleanValue: false }, lostReason: str(''), lostAt: { nullValue: null }, bookingId: { nullValue: null },
    tags: { arrayValue: { values: [str('LINE OA')] } }, companyId: companyId ? str(companyId) : { nullValue: null },
    stageChangedAt: str(now), createdAt: { timestampValue: now }, updatedAt: { timestampValue: now },
  }
}

async function pushLine(env, to, text) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  }).catch(() => null)
  if (res?.ok) return { sent: true }
  const data = res ? await res.json().catch(() => ({})) : {}
  return { sent: false, error: data.message || `LINE ${res?.status || 'network error'}` }
}

// ── Firestore REST — runQuery (ไม่มี where — กัน composite index) ──
// equal = [field, 'ค่า string'] — กรองเท่ากับ 1 field (ใช้ index ฟิลด์เดียวที่ Firestore สร้างให้อัตโนมัติ ไม่ต้องเพิ่ม composite index)
// after = ชื่อเอกสารเต็มตัวสุดท้ายของหน้าก่อน (ดึงหน้าถัดไปเรียงตาม __name__ — ค่าเริ่มต้นของ Firestore อยู่แล้ว
// จึงไม่ต้องมี index เพิ่ม)
export function buildStructuredQuery(collectionId, orderField, direction, limit, fields, equal, after = null) {
  const structuredQuery = { from: [{ collectionId }], limit }
  // orderBy ตัดเอกสารที่ไม่มี field นั้นทิ้งเงียบๆ — ส่ง null เมื่อต้องการทุกเอกสารจริง
  if (orderField) structuredQuery.orderBy = [{ field: { fieldPath: orderField }, direction }]
  if (fields) structuredQuery.select = { fields: fields.map(fieldPath => ({ fieldPath })) }
  if (equal) structuredQuery.where = { fieldFilter: { field: { fieldPath: equal[0] }, op: 'EQUAL', value: { stringValue: String(equal[1]) } } }
  if (after && !orderField) {
    structuredQuery.orderBy = [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }]
    structuredQuery.startAt = { values: [{ referenceValue: after }], before: false }
  }
  return structuredQuery
}
// ไม่ได้เรียงตาม field (orderField = null) แล้วได้ครบ limit พอดี = อาจมีมากกว่านั้น → ดึงหน้าถัดไปต่อ (สูงสุด MAX_QUERY_PAGES หน้า)
// เดิมดึงแค่ limit แรก ข้อมูลเกินนั้นหายเงียบๆ จากรายงาน (ใบจอง/ลูกค้าเกิน 5,000)
export const MAX_QUERY_PAGES = 4
export async function runQuery(env, accessToken, collectionId, orderField, direction, limit, fields, equal) {
  const out = []
  let after = null
  for (let page = 0; page < (orderField ? 1 : MAX_QUERY_PAGES); page++) {
    const structuredQuery = buildStructuredQuery(collectionId, orderField, direction, limit, fields, equal, after)
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery }),
    })
    if (!res.ok) throw new Error(`Firestore runQuery(${collectionId}) ${res.status}`)
    const rows = await res.json()
    const docs = (Array.isArray(rows) ? rows : []).filter(r => r.document).map(r => r.document)
    docs.forEach(d => out.push(docToObject(d)))
    if (docs.length < limit || !docs[docs.length - 1]?.name) break
    after = docs[docs.length - 1].name
  }
  return out
}
function docToObject(doc) {
  const obj = { id: doc.name.split('/').pop() }
  for (const [k, v] of Object.entries(doc.fields || {})) obj[k] = decodeFsValue(v)
  return obj
}
export function decodeFsValue(v) {
  if (v.stringValue !== undefined) return v.stringValue
  if (v.integerValue !== undefined) return Number(v.integerValue)
  if (v.doubleValue !== undefined) return v.doubleValue
  if (v.booleanValue !== undefined) return v.booleanValue
  if (v.timestampValue !== undefined) return v.timestampValue
  if (v.nullValue !== undefined) return null
  if (v.mapValue !== undefined) {
    const o = {}
    for (const [k, vv] of Object.entries(v.mapValue.fields || {})) o[k] = decodeFsValue(vv)
    return o
  }
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(decodeFsValue)
  return null
}

// ── Firebase Service Account → Firestore access token (เหมือน getFcmAccessToken() ใน comms-send.js) ──
async function getFirestoreAccessToken(env) {
  let sa
  try { sa = JSON.parse(env.FIRESTORE_SERVICE_ACCOUNT_JSON) } catch { return null }
  if (!sa.client_email || !sa.private_key) return null

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = { iss: sa.client_email, scope: FIRESTORE_SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`

  let signature
  try {
    const key = await importPkcs8(sa.private_key)
    const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
    signature = b64urlFromBuffer(sigBuf)
  } catch { return null }

  const jwt = `${unsigned}.${signature}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.access_token || null
}
async function importPkcs8(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return crypto.subtle.importKey('pkcs8', bytes.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
}
function b64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlFromBuffer(buf) {
  let binary = ''
  new Uint8Array(buf).forEach(b => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ── Firebase ID token auth (เหมือน comms-send.js — ใช้กับ /test-send และ /preview เท่านั้น) ──
async function requireStaff(request, env) {
  const authHeader = request.headers.get('Authorization') || ''
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!idToken) return { error: 'Unauthorized — missing token', status: 401 }
  const verified = await verifyFirebaseToken(idToken, env.FIREBASE_API_KEY)
  if (!verified) return { error: 'Unauthorized — invalid token', status: 401 }
  if (!(await isAuthorizedStaff(idToken, verified.localId, env))) {
    return { error: 'Unauthorized — บัญชีนี้ยังไม่ได้รับอนุมัติให้เป็นพนักงาน', status: 403 }
  }
  return { uid: verified.localId }
}
async function verifyFirebaseToken(idToken, apiKey) {
  if (!apiKey) return null
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.users?.[0] || null
  } catch { return null }
}
async function isAuthorizedStaff(idToken, uid, env) {
  const projectId = env.FIREBASE_PROJECT_ID
  if (!projectId || !uid) return false
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
    if (!res.ok) return false
    const doc = await res.json()
    const f = doc.fields || {}
    const role = f.role?.stringValue || 'viewer'
    const expiresAt = f.accessExpiresAt?.timestampValue || null
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return false
    return STAFF_ROLES.includes(role)
  } catch { return false }
}

// ── วันที่ตามเวลาไทยจริง (Cloudflare Workers รันเป็น UTC เสมอ) — export ไว้เพื่อเทสตรงๆ ─────────
export function todayBangkok() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
export function daysSinceBangkok(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const then = Date.UTC(y, m - 1, d)
  const [ty, tm, td] = todayBangkok().split('-').map(Number)
  const now = Date.UTC(ty, tm - 1, td)
  return Math.floor((now - then) / 86400000)
}
export function formatThaiDate(dateStr) {
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d} ${months[m - 1]} ${y + 543}`
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}
