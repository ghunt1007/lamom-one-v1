/**
 * User Manual — คู่มือการใช้งานโปรแกรม LAMOM ONE
 * Route: /help
 */
function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const GETTING_STARTED = {
  icon: '🚀', title: 'เริ่มต้นใช้งาน',
  intro: 'พื้นฐานการใช้งานระบบที่ควรรู้ก่อนเริ่มต้น',
  items: [
    { q: 'เข้าสู่ระบบอย่างไร?', a: 'กรอกอีเมลและรหัสผ่านที่หน้า Login หรือกดปุ่ม "🎮 ทดลองใช้ Demo" เพื่อเข้าใช้งานแบบทดลองโดยไม่ต้องสมัครสมาชิก — ข้อมูลในโหมด Demo จะถูกเก็บไว้ชั่วคราวในเครื่องของคุณเท่านั้น (หายเมื่อปิด/รีเฟรชเบราว์เซอร์บางกรณี) เหมาะสำหรับทดลองใช้งานฟีเจอร์ต่างๆ ก่อนตัดสินใจสมัครใช้งานจริง' },
    { q: 'เมนู Sidebar ใช้งานอย่างไร?', a: 'เมนูด้านซ้ายแบ่งเป็นกลุ่มตามหมวดงาน (เช่น การขาย, โชว์รูม, บริการ, การเงิน) กดที่ชื่อกลุ่มเพื่อขยาย/ย่อรายการเมนูย่อย กดไอคอน "◀" มุมบนซ้ายเพื่อย่อ Sidebar ทั้งแถบให้เหลือแค่ไอคอน ประหยัดพื้นที่หน้าจอ' },
    { q: 'ทำไมบางเมนูถึงไม่ขึ้น?', a: 'ระบบมีการจำกัดสิทธิ์การเข้าถึงตามบทบาท (Role) ของผู้ใช้แต่ละคน หากไม่เห็นเมนูบางกลุ่ม แปลว่าบัญชีของคุณไม่ได้รับสิทธิ์เข้าถึงโมดูลนั้น ให้ติดต่อผู้ดูแลระบบ (Admin/Owner) เพื่อขอปรับสิทธิ์ที่หน้า Role & Permissions' },
    { q: 'รูปแบบการทำงานทั่วไปในแต่ละหน้าเป็นอย่างไร?', a: 'เกือบทุกหน้าจะมีรูปแบบคล้ายกัน: การ์ดสรุปตัวเลขสำคัญ (KPI) ด้านบน ปุ่ม "+ สร้าง..." มุมขวาบนสำหรับเพิ่มรายการใหม่ ตัวกรอง/แท็บสถานะสำหรับกรองรายการ และตารางหรือรายการ์ดแสดงข้อมูล กดที่แถวหรือปุ่ม "ดู" เพื่อดูรายละเอียดเพิ่มเติม' },
    { q: 'ข้อมูลที่กรอกจะหายไหมถ้าไม่กดบันทึก?', a: 'ทุกฟอร์มในระบบต้องกดปุ่ม "บันทึก" (หรือปุ่มยืนยันที่มีชื่อคล้ายกัน) ก่อนปิดหน้าต่างเสมอ มิฉะนั้นข้อมูลที่กรอกจะไม่ถูกบันทึก — ระบบจะบันทึกข้อมูลลง Firestore ทันทีเมื่อกดยืนยัน ไม่ต้องกด Save ซ้ำที่อื่น' },
    { q: 'สลับธีมสี/โหมดมืด-สว่างได้ที่ไหน?', a: 'ไปที่ Settings → ตั้งค่า เพื่อเลือกธีมสีที่ต้องการ ระบบรองรับหลายธีมและโหมดมืด/สว่าง' },
  ]
}

const MODULES = [
  { icon:'👥', title:'การขาย (CRM)', intro:'จัดการลูกค้า ลีด และกระบวนการขายตั้งแต่ต้นจนจบ',
    items:[
      { q:'ลูกค้า / Lead / Pipeline ต่างกันอย่างไร?', a:'"ลูกค้า" คือฐานข้อมูลลูกค้าทั้งหมดที่เคยติดต่อ "Lead" คือผู้สนใจที่ยังไม่ปิดการขาย ต้องติดตาม "Pipeline" คือมุมมองแบบ Kanban แสดงว่าดีลแต่ละดีลอยู่ขั้นตอนไหน (เช่น ติดต่อแล้ว → นัดชม → เสนอราคา → ปิดการขาย)' },
      { q:'สร้างใบจองรถอย่างไร?', a:'ไปที่เมนู "จองรถ" กด "+ สร้างใบจอง" กรอกข้อมูลลูกค้า รุ่นรถ ราคา และเงื่อนไขการชำระ ระบบจะออกเลขที่ใบจองให้อัตโนมัติและสามารถพิมพ์เอกสารได้ทันที' },
      { q:'ติดตามลูกค้าที่ยังไม่ปิดการขายอย่างไร?', a:'ใช้เมนู Follow-up หรือ Action Plan เพื่อดูรายการลูกค้าที่ต้องติดต่อวันนี้ ระบบจะจัดลำดับความสำคัญให้อัตโนมัติตามวันนัดหมาย' },
    ] },
  { icon:'🚗', title:'โชว์รูม (DMS)', intro:'บริหารสต็อกรถ การสั่งรถใหม่ และงานเตรียมรถก่อนส่งมอบ',
    items:[
      { q:'ดูสต็อกรถคงเหลือได้ที่ไหน?', a:'เมนู "สต็อกรถ" แสดงรายการรถทั้งหมดพร้อมสถานะ (พร้อมขาย/จองแล้ว/ส่งมอบแล้ว) กรองตามรุ่น สี หรือสาขาได้' },
      { q:'สั่งแต่งรถให้ลูกค้าอย่างไร?', a:'ใช้เมนู "สั่งแต่งรถ" เพื่อสร้างคำสั่งแต่งพร้อมระบุอุปกรณ์ ส่วนลด ของแถม จากนั้นระบบจะช่วยติดตามทุกขั้นตอน: ส่งต่อแผนกที่เกี่ยวข้อง → ออก PO ส่งซัพพลายเออร์ → นัดวันติดตั้ง → ตรวจสอบคุณภาพ → พร้อมส่งมอบ พร้อมออกเอกสารที่เกี่ยวข้องได้ครบในหน้าเดียว' },
      { q:'PDI คืออะไร?', a:'PDI (Pre-Delivery Inspection) คือการตรวจสภาพรถก่อนส่งมอบให้ลูกค้า ใช้ Checklist ในเมนู PDI เพื่อบันทึกผลตรวจให้ครบทุกจุดก่อนนัดส่งมอบ' },
    ] },
  { icon:'🔧', title:'บริการ (Service)', intro:'จัดการงานซ่อม นัดหมายเข้าศูนย์บริการ และคลังอะไหล่',
    items:[
      { q:'ลูกค้านัดเข้าซ่อมอย่างไร?', a:'ใช้เมนู Service Appointment เพื่อสร้างนัดหมาย ระบุอาการเบื้องต้น และมอบหมายช่างผู้รับผิดชอบ' },
      { q:'สั่งอะไหล่จากซัพพลายเออร์อย่างไร?', a:'เมนู "สั่งอะไหล่" (Parts Order) ให้สร้าง PO ระบุรายการอะไหล่ที่ต้องการ ระบบจะติดตามสถานะตั้งแต่รออนุมัติ สั่งซื้อแล้ว จนถึงรับสินค้าครบ' },
      { q:'ติดตามผลงานช่างอย่างไร?', a:'เมนู Technician KPI สรุปผลงานช่างแต่ละคนตามจำนวนงาน คะแนนความพึงพอใจลูกค้า และงานเคลม แล้วคำนวณโบนัสให้อัตโนมัติ' },
    ] },
  { icon:'💰', title:'การเงิน (Finance)', intro:'บัญชี ภาษี การรับ-จ่ายเงิน และปิดงบประจำเดือน',
    items:[
      { q:'ออกใบเสร็จ/ใบกำกับภาษีอย่างไร?', a:'เมนู Invoice & Documents ใช้สร้างใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จ และใบกำกับภาษี ระบบคำนวณ VAT ให้อัตโนมัติและพิมพ์เอกสารรูปแบบ A4 ได้ทันที' },
      { q:'ออกหนังสือรับรองหัก ณ ที่จ่าย (ใบ 50 ทวิ) อย่างไร?', a:'เมนู "หัก ณ ที่จ่าย" เลือกประเภทเงินได้ (ตามมาตรา 40) กรอกจำนวนเงินที่จ่าย ระบบจะคำนวณอัตราภาษีที่ต้องหักให้อัตโนมัติและออกเอกสารพร้อมพิมพ์' },
      { q:'วางบิลเก็บเงินลูกค้าองค์กรอย่างไร?', a:'เมนู "ระบบวางบิล" ใช้รวมใบแจ้งหนี้ที่ค้างชำระของลูกค้ารายเดียวกันเป็นรอบวางบิล กำหนดวันครบกำหนดชำระ แล้วติดตามจนกว่าจะเก็บเงินได้ครบ' },
      { q:'เบิกเงินสดย่อยอย่างไร?', a:'เมนู Petty Cash กด "+ ขอเบิกเงิน" ระบุรายการและจำนวนเงิน คำขอจะเข้าสู่สถานะรออนุมัติก่อน เมื่อผู้มีสิทธิ์อนุมัติแล้วจึงจะตัดยอดเงินสดย่อยจริง' },
      { q:'ปิดงบประจำเดือนอย่างไร?', a:'เมนู Monthly Close แสดงรายการรายรับ-รายจ่ายที่ต้องยืนยันให้ครบก่อน เมื่อทำครบทุกรายการแล้วปุ่ม "ปิดงบเดือนนี้" จะกดได้ — เมื่อปิดแล้วเดือนนั้นจะถูกล็อกถาวร ไม่สามารถแก้ไขย้อนหลังได้' },
    ] },
  { icon:'🛡', title:'ประกัน (Insurance)', intro:'บริหารกรมธรรม์ เคลมประกัน และค่าคอมมิชชั่น',
    items:[
      { q:'ต่อประกันให้ลูกค้าอย่างไร?', a:'เมนู Insurance Renewal แสดงรายชื่อลูกค้าที่กรมธรรม์ใกล้หมดอายุ ให้ติดต่อและบันทึกผลการต่อประกันได้ในหน้าเดียว' },
    ] },
  { icon:'📢', title:'การตลาด (Marketing)', intro:'แคมเปญ โปรโมชั่น และช่องทางการสื่อสารกับลูกค้า',
    items:[
      { q:'สร้างแคมเปญการตลาดอย่างไร?', a:'เมนู Campaign Builder ใช้วางแผนแคมเปญ กำหนดกลุ่มเป้าหมาย งบประมาณ และช่วงเวลา พร้อมติดตามผลลัพธ์เทียบเป้าหมาย' },
    ] },
  { icon:'🏢', title:'องค์กร (HR & Training)', intro:'พนักงาน เงินเดือน การลา อบรม และการประเมินผล KPI',
    items:[
      { q:'มอบหมายเป้าหมาย KPI ให้ทีม/ฝ่ายอย่างไร?', a:'เมนู "เป้าหมายทีม/ฝ่าย" กด "+ มอบหมายเป้าหมาย" เลือกฝ่าย (และระบุชื่อทีมย่อยได้ถ้าต้องการ) เลือกตัวชี้วัดและเป้าหมายรายเดือน ระบบจะคำนวณ KPI ความสำเร็จให้อัตโนมัติเมื่อมีการอัปเดตผลจริง' },
      { q:'พนักงานลาหยุดต้องทำอย่างไร?', a:'เมนู "ลาพนักงาน" (Leave) ให้กรอกประเภทการลาและช่วงวันที่ ส่งคำขอให้หัวหน้างานอนุมัติในระบบ' },
      { q:'ดูโครงสร้างเงินเดือนและสลิปเงินเดือนได้ที่ไหน?', a:'เมนู Payroll / Payroll Detail สำหรับฝ่ายบัญชี และเมนู "บัญชีของฉัน" สำหรับพนักงานดูสลิปเงินเดือนของตนเอง' },
    ] },
  { icon:'📄', title:'เอกสาร (Documents)', intro:'แม่แบบเอกสาร สัญญา และระบบสร้างเอกสารอัตโนมัติ',
    items:[
      { q:'ใช้แม่แบบเอกสารสร้างเอกสารเร็วๆ อย่างไร?', a:'เมนู Document Templates เลือกแม่แบบที่ต้องการ กรอกข้อมูลตามช่องว่างที่กำหนดไว้ ระบบจะสร้างเอกสารพร้อมพิมพ์ได้ทันทีโดยไม่ต้องพิมพ์ใหม่ทุกครั้ง' },
    ] },
  { icon:'🤖', title:'AI & งาน', intro:'ผู้ช่วย AI สำหรับตอบคำถามธุรกิจ และการจัดการงานส่วนตัว',
    items:[
      { q:'ถาม AI เรื่องข้อมูลธุรกิจอย่างไร?', a:'เมนู "Ask LAMI" หรือ "LAMI Brain" พิมพ์คำถามเกี่ยวกับยอดขาย สต็อก ลูกค้า หรือข้อมูลธุรกิจอื่นๆ AI จะตอบจากข้อมูลจริงในระบบ ประวัติการสนทนาจะถูกบันทึกไว้ให้อัตโนมัติ' },
      { q:'ผู้ช่วยส่วนตัว (Personal AI) ใช้งานอย่างไร?', a:'เมนู "ผู้ช่วยส่วนตัว" เป็นโหมดสนทนาแบบเต็มจอ พิมพ์หรือพูดคุยกับ AI ได้ รองรับการจดจำข้อมูลสำคัญ (Memory) ที่คุณบอกให้จำไว้ใช้ในการสนทนาครั้งถัดไป' },
    ] },
  { icon:'💬', title:'สื่อสาร (Comms)', intro:'ส่งข้อความและแจ้งเตือนถึงลูกค้าและทีมงาน',
    items:[
      { q:'ส่งข้อความแจ้งลูกค้าเป็นกลุ่มอย่างไร?', a:'เมนู Broadcast เลือกกลุ่มลูกค้าเป้าหมายและข้อความที่ต้องการส่ง' },
    ] },
  { icon:'✅', title:'คุณภาพ (Quality)', intro:'มาตรฐานการทำงาน การตรวจสอบ และการปฏิบัติตามกฎหมาย',
    items:[
      { q:'ตรวจสอบว่าธุรกิจปฏิบัติตามกฎหมายครบไหม?', a:'เมนู "กฎหมายที่เกี่ยวข้อง" รวบรวมกฎหมายธุรกิจยานยนต์และกฎหมายแรงงานที่สำคัญ พร้อมสรุปประเด็นที่ต้องปฏิบัติและบทลงโทษหากไม่ปฏิบัติตาม ใช้เมนู Compliance Check คู่กันเพื่อตรวจสอบสถานะการปฏิบัติตามจริงของกิจการ' },
    ] },
  { icon:'🤝', title:'B2B & Partner', intro:'ลูกค้าองค์กร ฟลีท และพันธมิตรธุรกิจ',
    items:[
      { q:'เสนอราคาขายแบบฟลีท (จำนวนมาก) อย่างไร?', a:'เมนู Fleet Quote ใช้สร้างใบเสนอราคาสำหรับลูกค้าองค์กรที่ซื้อรถจำนวนมาก พร้อมคำนวณส่วนลดตามปริมาณ' },
    ] },
  { icon:'⚙️', title:'ระบบ (Settings)', intro:'ตั้งค่าระบบ ผู้ใช้งาน สิทธิ์การเข้าถึง และความปลอดภัย',
    items:[
      { q:'เพิ่มผู้ใช้งานใหม่อย่างไร?', a:'เมนู User Management สำหรับสร้างบัญชีพนักงานใหม่ กำหนดบทบาท (Role) และหัวหน้างานที่ดูแล' },
      { q:'กำหนดว่าแต่ละตำแหน่งเข้าถึงเมนูไหนได้บ้างอย่างไร?', a:'เมนู Role & Permissions เลือก Role ที่ต้องการแก้ไข กดปุ่ม "แก้ไข" แล้วติ๊กเลือกโมดูลที่ต้องการให้ Role นั้นเข้าถึงได้ (หรือเลือก Full Access เพื่อให้เข้าถึงได้ทุกอย่าง) การเปลี่ยนแปลงมีผลทันทีกับผู้ใช้ที่มี Role นั้น' },
      { q:'สำรองข้อมูลระบบอย่างไร?', a:'เมนู Backup & Restore สำหรับสร้างและกู้คืนข้อมูลสำรองของระบบ' },
    ] },
]

export default async function UserManualPage(container) {
  let search = ''
  let openSections = new Set(['getting-started'])

  function matchesSearch(item) {
    if (!search) return true
    const s = search.toLowerCase()
    return item.q.toLowerCase().includes(s) || item.a.toLowerCase().includes(s)
  }

  function sectionBlock(section, id) {
    const filteredItems = section.items.filter(matchesSearch)
    if (search && !filteredItems.length) return ''
    const isOpen = openSections.has(id) || !!search
    return `
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:10px">
        <div class="manual-sec-toggle" data-id="${id}" style="padding:14px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:var(--surface-2)">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:1.3rem">${section.icon}</span>
            <div>
              <div style="font-weight:700;font-size:0.88rem">${esc(section.title)}</div>
              <div style="font-size:0.72rem;color:var(--text-muted)">${esc(section.intro)}</div>
            </div>
          </div>
          <span style="font-size:0.9rem;color:var(--text-muted)">${isOpen ? '▾' : '▸'}</span>
        </div>
        ${isOpen ? `<div style="padding:6px 16px 14px">
          ${filteredItems.map(item => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border-subtle)">
              <div style="font-weight:600;font-size:0.83rem;margin-bottom:4px">❓ ${esc(item.q)}</div>
              <div style="font-size:0.8rem;color:var(--text-muted);line-height:1.7">${esc(item.a)}</div>
            </div>
          `).join('')}
        </div>` : ''}
      </div>
    `
  }

  function render() {
    const allSections = [{ ...GETTING_STARTED, id: 'getting-started' }, ...MODULES.map((m, i) => ({ ...m, id: 'mod-' + i }))]
    const totalItems = allSections.reduce((a, s) => a + s.items.length, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div style="max-width:820px;margin:0 auto">
          <div class="page-header">
            <div>
              <div class="page-title">📖 คู่มือการใช้งาน</div>
              <div class="page-subtitle">คำถามที่พบบ่อยและวิธีใช้งานแต่ละโมดูล — รวม ${totalItems} หัวข้อ</div>
            </div>
          </div>

          <div style="margin-bottom:16px">
            <input class="input" id="manual-search" placeholder="🔍 ค้นหาคำถาม เช่น 'วางบิล' หรือ 'ปิดงบ'..." value="${esc(search)}" style="width:100%;padding:10px 14px;font-size:0.88rem">
          </div>

          ${allSections.map(s => sectionBlock(s, s.id)).join('')}
          ${search && !allSections.some(s => s.items.some(matchesSearch)) ? '<div class="card" style="padding:30px;text-align:center;color:var(--text-muted)">🔍 ไม่พบหัวข้อที่ค้นหา ลองคำค้นอื่น</div>' : ''}

          <div class="card" style="padding:14px 16px;margin-top:16px;font-size:0.78rem;color:var(--text-muted);text-align:center">
            ℹ️ หากไม่พบคำตอบที่ต้องการ ติดต่อผู้ดูแลระบบ หรือดูข้อมูลเวอร์ชันเพิ่มเติมที่หน้า <a href="/settings/about" class="manual-about-link" style="color:var(--primary)">About</a>
          </div>
        </div>
      </div>
    `

    const searchInput = document.getElementById('manual-search')
    searchInput?.addEventListener('input', e => { search = e.target.value; render(); document.getElementById('manual-search')?.focus() })
    // keep cursor at end after re-render
    if (searchInput && document.activeElement !== searchInput && search) {
      searchInput.focus()
      searchInput.setSelectionRange(search.length, search.length)
    }
    container.querySelectorAll('.manual-sec-toggle').forEach(t => t.addEventListener('click', () => {
      const id = t.dataset.id
      if (openSections.has(id)) openSections.delete(id); else openSections.add(id)
      render()
    }))
    document.querySelector('.manual-about-link')?.addEventListener('click', e => {
      e.preventDefault()
      history.pushState({}, '', '/settings/about')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
  }

  render()
}
