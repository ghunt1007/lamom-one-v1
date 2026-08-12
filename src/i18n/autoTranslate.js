// autoTranslate — แปล "คำศัพท์ที่ใช้ซ้ำทั่วทั้งระบบ" (ปุ่ม/label/หัวตาราง/สถานะที่ใช้คำเดียวกันซ้ำในหลายร้อยหน้า)
// โดยไม่ต้องแก้โค้ดทีละ 400+ หน้า — ใช้แพทเทิร์นเดียวกับ tableTools.js (MutationObserver เสริมของที่ render
// ใหม่อัตโนมัติ) จับคู่ข้อความ "ตรงทั้งหมด" (exact match หลัง trim) กับ dictionary เท่านั้น จึงปลอดภัย ไม่ไป
// แปลเนื้อหาที่ผู้ใช้พิมพ์เอง/ชื่อลูกค้า/เลขที่เอกสาร ฯลฯ เพราะสิ่งเหล่านั้นไม่ตรงกับคำในดิกชันนารีเป๊ะๆ
//
// ข้อจำกัดที่ตั้งใจ (บอกตรงๆ ไม่ใช่ "แปลครบทุกหน้า" จริง): เนื้อหาเฉพาะของแต่ละหน้า (คำอธิบายยาว ข้อความ
// แจ้งเตือนเฉพาะเหตุการณ์ ชื่อฟิลด์ที่สะกดไม่ตรงกับคำในนี้เป๊ะๆ) จะยังเป็นภาษาไทยต่อไป — การแปลแบบ contextual
// ทีละหน้าจริงๆ (คำอธิบาย/ประโยคยาว) เป็นงานคนละสเกล ต้องแก้ทีละไฟล์ 400+ ไฟล์ ไม่ใช่สิ่งที่ mechanical
// pattern แบบนี้ทำให้ถูกต้อง 100% ได้ — แต่คำศัพท์ที่ใช้ซ้ำ (ปุ่ม/หัวตาราง/สถานะ) ครอบคลุมสัดส่วนใหญ่ของ UI จริง

const TERMS = {
  // ปุ่ม/การกระทำหลัก
  'บันทึก': ['Save', '保存'], '💾 บันทึก': ['💾 Save', '💾 保存'], '✅ บันทึก': ['✅ Save', '✅ 保存'],
  'ยกเลิก': ['Cancel', '取消'], 'แก้ไข': ['Edit', '编辑'], '✏️ แก้ไข': ['✏️ Edit', '✏️ 编辑'], '✏️': ['✏️', '✏️'],
  'ลบ': ['Delete', '删除'], '🗑 ลบ': ['🗑 Delete', '🗑 删除'], '🗑️ ลบ': ['🗑️ Delete', '🗑️ 删除'], '🗑': ['🗑', '🗑'], '🗑️': ['🗑️', '🗑️'],
  'เพิ่ม': ['Add', '添加'], '➕ เพิ่ม': ['➕ Add', '➕ 添加'], 'ดู': ['View', '查看'], 'ดูรายละเอียด': ['View details', '查看详情'],
  'รายละเอียด': ['Details', '详情'], 'ปิด': ['Close', '关闭'], 'เปิด': ['Open', '打开'], 'ส่ง': ['Send', '发送'], '📤 ส่ง': ['📤 Send', '📤 发送'],
  'ยืนยัน': ['Confirm', '确认'], '✅ ยืนยัน': ['✅ Confirm', '✅ 确认'], '✓ ยืนยัน': ['✓ Confirm', '✓ 确认'],
  'อนุมัติ': ['Approve', '批准'], '✅ อนุมัติ': ['✅ Approve', '✅ 批准'], '✓ อนุมัติ': ['✓ Approve', '✓ 批准'],
  'ปฏิเสธ': ['Reject', '拒绝'], '❌ ปฏิเสธ': ['❌ Reject', '❌ 拒绝'], '✗ ปฏิเสธ': ['✗ Reject', '✗ 拒绝'], '✕ ปฏิเสธ': ['✕ Reject', '✕ 拒绝'],
  'เสร็จ': ['Done', '完成'], '✅ เสร็จ': ['✅ Done', '✅ 完成'], '✓ เสร็จ': ['✓ Done', '✓ 完成'], 'ทำเสร็จ': ['Mark done', '标记完成'],
  'รีเฟรช': ['Refresh', '刷新'], '🔄 รีเฟรช': ['🔄 Refresh', '🔄 刷新'], '🔄 Refresh': ['🔄 Refresh', '🔄 刷新'],
  'พิมพ์': ['Print', '打印'], '🖨 พิมพ์': ['🖨 Print', '🖨 打印'], 'พิมพ์เอกสาร': ['Print document', '打印文件'],
  'ค้นหา': ['Search', '搜索'], '🔍 ค้นหา': ['🔍 Search', '🔍 搜索'], 'ล้าง': ['Clear', '清除'],
  'คัดลอก': ['Copy', '复制'], '📋 คัดลอก': ['📋 Copy', '📋 复制'], '📋': ['📋', '📋'],
  'จ่าย': ['Pay', '支付'], '💸 จ่าย': ['💸 Pay', '💸 支付'], '💳 จ่าย': ['💳 Pay', '💳 支付'],
  'กลับ': ['Back', '返回'], '← กลับ': ['← Back', '← 返回'], '◀': ['◀', '◀'], '▶': ['▶', '▶'], '✕': ['✕', '✕'], '❌': ['❌', '❌'], '✅': ['✅', '✅'],
  'ตกลง': ['OK', '确定'], 'ตรวจเช็คระยะ': ['Scheduled maintenance', '定期保养'], 'มอบหมายให้': ['Assign to', '分配给'],
  'จัดการ': ['Manage', '管理'], 'การจัดการ': ['Management', '管理'],
  'เพิ่มรถ': ['Add vehicle', '添加车辆'], '➕ เพิ่มรถ': ['➕ Add vehicle', '➕ 添加车辆'],
  'ล้าง Filter': ['Clear filter', '清除筛选'], 'นัด': ['Schedule', '预约'], '📅 นัด': ['📅 Schedule', '📅 预约'],
  'รายงาน': ['Report', '报告'], '📊 รายงาน': ['📊 Report', '📊 报告'], 'ส่งออก': ['Export', '导出'],

  // สถานะทั่วไป
  'ทั้งหมด': ['All', '全部'], 'ทุกประเภท': ['All types', '所有类型'], 'ทุกสถานะ': ['All statuses', '所有状态'],
  'ทุกแบรนด์': ['All brands', '所有品牌'], 'ทุกยี่ห้อ': ['All brands', '所有品牌'], 'ทุกรุ่น': ['All models', '所有型号'],
  'ทุกแผนก': ['All departments', '所有部门'], 'ทุกเซลส์': ['All sales staff', '所有销售'],
  'สถานะทั้งหมด': ['All statuses', '所有状态'], 'สถานะ': ['Status', '状态'],
  'ใช้งาน': ['Active', '使用中'], 'เปิดใช้งาน': ['Enabled', '已启用'], 'ไม่ได้ใช้งาน': ['Inactive', '未启用'],
  'ปกติ': ['Normal', '正常'], 'สูง': ['High', '高'], 'ต่ำ': ['Low', '低'], 'ปานกลาง': ['Medium', '中'],
  'สิ้นสุด': ['Ended', '已结束'], 'หมดอายุ': ['Expired', '已过期'], 'วันหมดอายุ': ['Expiry date', '到期日'], 'ครบกำหนด': ['Due', '到期'],
  'เกินกำหนด': ['Overdue', '逾期'], 'มาตรฐาน': ['Standard', '标准'], 'ยังไม่มีข้อมูล': ['No data yet', '暂无数据'],
  'ไม่มีข้อมูล': ['No data', '无数据'], 'ไม่พบข้อมูล': ['No data found', '未找到数据'], 'ไม่พบรายการ': ['No items found', '未找到项目'],
  'ไม่มีรายการ': ['No items', '没有项目'], 'ไม่มี': ['None', '无'], 'ใช่': ['Yes', '是'], 'ไม่ปรากฏ': ['Not shown', '未显示'],
  'ใช้กับ': ['Applies to', '适用于'],

  // ฟิลด์ทั่วไป
  'วันที่': ['Date', '日期'], 'เวลา': ['Time', '时间'], 'ช่วงเวลา': ['Period', '时间段'], 'ระยะเวลา': ['Duration', '期限'],
  'วันเริ่ม': ['Start date', '开始日期'], 'วันเริ่มต้น': ['Start date', '开始日期'], 'วันสิ้นสุด': ['End date', '结束日期'],
  'วันนี้': ['Today', '今天'], 'เดือนนี้': ['This month', '本月'], 'ปี': ['Year', '年'], 'เดือน': ['Month', '月'],
  'จำนวน': ['Quantity', '数量'], 'จำนวนเงิน': ['Amount', '金额'], 'จำนวนคัน': ['Number of vehicles', '车辆数量'],
  'จำนวนสูงสุด': ['Maximum', '最大数量'], 'รวม': ['Total', '合计'], 'รวมทั้งหมด': ['Grand total', '总计'],
  'รวมทั้งสิ้น': ['Grand total', '总计'], 'ยอดรวม': ['Total', '合计'], 'ยอดขาย': ['Sales', '销售额'],
  'รายได้': ['Revenue', '收入'], 'รายได้รวม': ['Total revenue', '总收入'], 'รายรับ': ['Income', '收入'], 'รายจ่าย': ['Expense', '支出'],
  'กำไร': ['Profit', '利润'], 'กำไรรวม': ['Total profit', '总利润'], 'ต้นทุน': ['Cost', '成本'], 'ราคาทุน': ['Cost price', '成本价'],
  'ราคา': ['Price', '价格'], 'ราคาขาย': ['Selling price', '销售价'], 'ราคาสุทธิ': ['Net price', '净价'], 'ราคารถ': ['Vehicle price', '车价'],
  'มูลค่า': ['Value', '价值'], 'มูลค่ารวม': ['Total value', '总价值'], 'สุทธิ': ['Net', '净额'], 'ส่วนลด': ['Discount', '折扣'],
  'ค่าใช้จ่าย': ['Expense', '费用'], 'ค่าคอม': ['Commission', '佣金'], 'ค่าแรง': ['Labor cost', '工时费'], 'งบ': ['Budget', '预算'],
  'เงินสด': ['Cash', '现金'], 'เงินต้น': ['Principal', '本金'], 'เงินดาวน์': ['Down payment', '首付'],
  'ระยะผ่อน': ['Installment period', '分期期数'], 'วงเงินเครดิต': ['Credit limit', '信用额度'],
  'ลูกค้า': ['Customer', '客户'], 'ชื่อลูกค้า': ['Customer name', '客户姓名'], 'ชื่อ': ['Name', '姓名'],
  'พนักงาน': ['Staff', '员工'], 'พนักงานขาย': ['Sales staff', '销售员'], 'เซลส์': ['Sales', '销售'],
  'ผู้ใช้': ['User', '用户'], 'ผู้ดูแล': ['Admin', '管理员'], 'เจ้าของ': ['Owner', '所有者'],
  'ผู้รับผิดชอบ': ['Responsible person', '负责人'], 'ผู้ติดต่อ': ['Contact person', '联系人'], 'ชื่อผู้ติดต่อ': ['Contact name', '联系人姓名'],
  'ช่าง': ['Technician', '技师'], 'ช่างผู้รับผิดชอบ': ['Assigned technician', '负责技师'], 'ช่างตรวจ': ['Inspecting technician', '检查技师'],
  'อาชีพ': ['Occupation', '职业'], 'ตำแหน่ง': ['Position', '职位'], 'ตำแหน่งที่สมัคร': ['Position applied', '申请职位'],
  'แผนก': ['Department', '部门'], 'ฝ่ายขาย': ['Sales department', '销售部'], 'หน่วยงาน': ['Unit', '单位'],
  'สาขา': ['Branch', '分店'], 'ศูนย์บริการ': ['Service center', '服务中心'], 'สมาชิก': ['Member', '会员'],
  'เบอร์โทร': ['Phone', '电话'], 'โทรศัพท์': ['Phone', '电话'], 'โทร': ['Call', '电话'], 'อีเมล': ['Email', '电子邮件'],
  'ที่อยู่': ['Address', '地址'], 'ที่ตั้ง': ['Location', '位置'], 'สถานที่': ['Location', '地点'],
  'รถ': ['Vehicle', '车辆'], 'รุ่นรถ': ['Model', '车型'], 'รุ่น': ['Model', '型号'], 'ยี่ห้อ': ['Brand', '品牌'], 'แบรนด์': ['Brand', '品牌'],
  'สี': ['Color', '颜色'], 'ทะเบียน': ['License plate', '车牌'], 'ทะเบียนรถ': ['License plate', '车牌'],
  'ปีรุ่น': ['Model year', '车型年份'], 'ปีรถ': ['Vehicle year', '车辆年份'], 'รถที่สนใจ': ['Vehicle of interest', '感兴趣车型'],
  'รถที่ขาย': ['Vehicle sold', '已售车辆'], 'รุ่นที่สนใจ': ['Model of interest', '感兴趣型号'],
  'สต็อก': ['Stock', '库存'], 'วันในสต็อก': ['Days in stock', '库存天数'], 'อุปกรณ์เสริม': ['Accessories', '配件'],
  'ประเภท': ['Type', '类型'], 'ประเภทงาน': ['Job type', '工作类型'], 'ประเภทประกัน': ['Insurance type', '保险类型'],
  'ประเภทเอกสาร': ['Document type', '文件类型'], 'ประเภทเหตุ': ['Incident type', '事件类型'], 'ประเภทเงินได้': ['Income type', '收入类型'],
  'หมวดหมู่': ['Category', '类别'], 'หมวด': ['Category', '类别'], 'รูปแบบ': ['Format', '格式'],
  'ช่องทาง': ['Channel', '渠道'], 'ช่องทางส่ง': ['Send channel', '发送渠道'], 'แหล่งที่มา': ['Source', '来源'], 'ที่มา': ['Source', '来源'],
  'แพลตฟอร์ม': ['Platform', '平台'], 'กลุ่มเป้าหมาย': ['Target group', '目标群体'], 'แคมเปญ': ['Campaign', '活动'],
  'เงื่อนไข': ['Conditions', '条件'], 'เงื่อนไขแคมเปญ': ['Campaign conditions', '活动条件'],
  'ตัวอย่างข้อความ': ['Message preview', '消息预览'], 'ข้อความ': ['Message', '消息'],
  'หมายเหตุ': ['Notes', '备注'], 'เหตุผล': ['Reason', '原因'], 'สาเหตุ': ['Cause', '原因'], 'คำอธิบาย': ['Description', '说明'],
  'หัวข้อ': ['Topic', '标题'], 'วัตถุประสงค์': ['Purpose', '目的'], 'ประวัติ': ['History', '历史记录'],
  'รายการ': ['List', '列表'], 'รายการอะไหล่': ['Parts list', '配件清单'], 'รายการตรวจสอบ': ['Checklist', '检查清单'],
  'อะไหล่': ['Parts', '配件'], 'ชื่ออะไหล่': ['Part name', '配件名称'], 'ซัพพลายเออร์': ['Supplier', '供应商'],
  'บริการ': ['Service', '服务'], 'งานบริการ': ['Service job', '服务工单'], 'เลขไมล์': ['Mileage', '里程数'],
  'สภาพ': ['Condition', '状况'], 'ความเสียหาย': ['Damage', '损坏'], 'ความสำคัญ': ['Priority', '优先级'],
  'ความเสี่ยง': ['Risk', '风险'], 'ระดับ': ['Level', '级别'], 'สัดส่วน': ['Ratio', '比例'], 'ผลลัพธ์': ['Result', '结果'],
  'พิสัย': ['Range', '范围'], 'ตัวชี้วัด': ['KPI', '指标'], 'ตลาด': ['Market', '市场'],
  'เชื้อเพลิง': ['Fuel', '燃料'], 'แบตเตอรี่': ['Battery', '电池'], 'อุณหภูมิ': ['Temperature', '温度'],
  'หัวชาร์จ': ['Charging port', '充电口'], 'เบย์': ['Bay', '工位'],
  'ประกัน': ['Insurance', '保险'], 'บริษัทประกัน': ['Insurance company', '保险公司'], 'เบี้ยประกัน': ['Premium', '保费'],
  'เลขกรมธรรม์': ['Policy number', '保单号'], 'ใบรับรอง': ['Certificate', '证书'],
  'เคลม': ['Claim', '理赔'], 'ต่ออายุ': ['Renew', '续期'], 'สิทธิ์': ['Rights', '权利'],
  'ระยะเวลาสิทธิ์': ['Validity period', '有效期'], 'ธนาคาร': ['Bank', '银行'], 'เงินเดือน': ['Salary', '工资'],
  'เบี้ยเลี้ยง': ['Allowance', '津贴'], 'อายุงาน': ['Years of service', '工作年限'], 'เข้างาน': ['Clock in', '上班'],
  'ออกงาน': ['Clock out', '下班'], 'วันเริ่มงาน': ['Start date', '入职日期'], 'มาถึง': ['Arrived', '已到达'],
  'ปลายทาง': ['Destination', '目的地'], 'ต้นทาง': ['Origin', '出发地'], 'ถึง': ['To', '至'],
  'เลขที่': ['Number', '编号'], 'เลขที่คำสั่ง': ['Order number', '订单号'], 'เลขที่ผู้เสียภาษี': ['Tax ID', '税号'],
  'จอง': ['Book', '预订'], 'ใบจอง': ['Booking', '订车单'], 'ยังไม่มีใบจอง': ['No bookings yet', '暂无订车单'],
  'ไม่พบโปรโมชั่น': ['No promotion found', '未找到促销活动'], 'ไม่พบกรมธรรม์': ['No policy found', '未找到保单'],
  'ไม่มีกรมธรรม์': ['No policy', '无保单'], 'ไม่มีข้อมูลเดือนนี้': ['No data this month', '本月暂无数据'],
  'วันส่งมอบ': ['Delivery date', '交车日期'], 'วันที่รับรถ': ['Vehicle pickup date', '取车日期'], 'กำหนดส่งมอบ': ['Delivery due', '交车期限'],
  'วันที่นัด': ['Appointment date', '预约日期'], 'วันที่ต้องการ': ['Requested date', '要求日期'], 'วันที่ตรวจ': ['Inspection date', '检查日期'],
  'วันรับคาด': ['Expected receipt date', '预计收货日期'], 'วันออก': ['Issue date', '开出日期'], 'ตรวจถัดไป': ['Next inspection', '下次检查'],
  'ชื่อไฟล์': ['File name', '文件名'], 'ที่เก็บ': ['Storage', '存储位置'], 'ยอดจริง': ['Actual amount', '实际金额'],
  'ยอดคงเหลือ': ['Remaining balance', '剩余余额'], 'รวมทั้งปี': ['Annual total', '全年合计'],
  'คะแนน': ['Score', '分数'], 'คะแนนสะสม': ['Points', '积分'], 'คะแนนรวม': ['Total score', '总分'],
  'สภาพเดิม': ['Original condition', '原始状况'], 'วิทยากร': ['Instructor', '讲师'],
  'หัก': ['Deduction', '扣除'], 'ส่งทาง': ['Send via', '发送方式'], 'ส่งคืน': ['Return', '退回'],
  'เกี่ยวข้อง': ['Related', '相关'], 'เปลี่ยนแปลง': ['Change', '变更'], 'แถมฟรี': ['Free gift', '免费赠品'],
  'ใช้กับรุ่น': ['Applies to model', '适用车型'], 'ค่าเริ่มต้น': ['Default value', '默认值'],
  'กำลัง': ['In progress', '进行中'], 'อื่นๆ': ['Other', '其他'],

  // วันในสัปดาห์ (ตัวย่อในตารางเวร)
  'จ': ['Mon', '周一'], 'อ': ['Tue', '周二'], 'พ': ['Wed', '周三'], 'พฤ': ['Thu', '周四'], 'ศ': ['Fri', '周五'], 'ส': ['Sat', '周六'], 'อา': ['Sun', '周日'],
}

// สร้าง reverse index ทั้ง 3 ทาง (th→[en,zh], en→th, zh→th) ให้สลับภาษาไปมาได้โดยไม่ต้องเก็บ state ต่อ node
const EN_TO_TH = {}
const ZH_TO_TH = {}
for (const [th, [en, zh]] of Object.entries(TERMS)) {
  if (en && !(en in EN_TO_TH)) EN_TO_TH[en] = th
  if (zh && !(zh in ZH_TO_TH)) ZH_TO_TH[zh] = th
}

export function translateTrimmed(trimmed, lang) {
  let th = null
  if (trimmed in TERMS) th = trimmed
  else if (trimmed in EN_TO_TH) th = EN_TO_TH[trimmed]
  else if (trimmed in ZH_TO_TH) th = ZH_TO_TH[trimmed]
  if (th == null) return null
  if (lang === 'th') return th
  const pair = TERMS[th]
  return pair ? (lang === 'en' ? pair[0] : pair[1]) || th : th
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA'])

function translateTextNode(node, lang) {
  const parentTag = node.parentElement?.tagName
  if (parentTag && SKIP_TAGS.has(parentTag)) return
  if (node.parentElement?.closest('[data-no-i18n="1"]')) return
  const raw = node.textContent
  const trimmed = raw.trim()
  if (!trimmed) return
  const translated = translateTrimmed(trimmed, lang)
  if (translated == null || translated === trimmed) return
  const lead = raw.slice(0, raw.indexOf(trimmed))
  const trail = raw.slice(raw.indexOf(trimmed) + trimmed.length)
  node.textContent = lead + translated + trail
}

function walkAndTranslate(root, lang) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes = []
  let n
  while ((n = walker.nextNode())) nodes.push(n)
  nodes.forEach(node => translateTextNode(node, lang))
}

let currentLang = 'th'

export function initAutoI18n(getLang) {
  currentLang = getLang() || 'th'
  walkAndTranslate(document.body, currentLang)

  let pending = false
  const pendingNodes = []
  const observer = new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes && m.addedNodes.forEach(n => { if (n.nodeType === 1 || n.nodeType === 3) pendingNodes.push(n) }))
    if (pending) return
    pending = true
    requestAnimationFrame(() => {
      pending = false
      const lang = currentLang
      if (lang === 'th') { pendingNodes.length = 0; return }
      pendingNodes.splice(0).forEach(n => {
        if (n.nodeType === 3) translateTextNode(n, lang)
        else walkAndTranslate(n, lang)
      })
    })
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: false })

  return function onLanguageChange(lang) {
    currentLang = lang || 'th'
    walkAndTranslate(document.body, currentLang)
  }
}
