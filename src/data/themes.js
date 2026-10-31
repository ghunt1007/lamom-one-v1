// รายชื่อธีมสีทั้งหมด (สีจริงอยู่ใน src/styles/themes.css) — ใช้ในหน้าต่าง "ปรับหน้าตา" (components/ThemeStudio.js)
// v1.0.365 — ขยายจาก 7 เป็น 31 ธีม เพิ่ม 24 ธีมใหม่ตามที่เจ้าของระบบขอ (ตั้งค่าสี/คอนทราสต์เองผ่าน
// src/styles/themes.css แล้ว — ผ่าน WCAG AA ครบทุกธีมเหมือน 7 ธีมเดิม) จัดกลุ่มเป็นหมวดให้เลือกง่ายขึ้น
// เพราะรายการยาวเกินจะแสดงแบบ flat list เดียวได้อีกต่อไป — เพิ่ม scroll ให้ panel ด้วย
export const THEME_GROUPS = [
  { group: 'แนะนำ · ดีไซน์ใหม่', themes: [
    { id: 'aurora',   label: 'Aurora', color: '#6366F1', icon: '✨' },
    { id: 'graphite', label: 'Graphite', color: '#EA580C', icon: '🖤' },
    { id: 'lagoon',   label: 'Lagoon', color: '#0D9488', icon: '🏝️' },
    { id: 'rose',     label: 'Rose', color: '#DB2777', icon: '🌸' },
  ]},
  { group: 'คลาสสิก', themes: [
    { id: 'midnight', label: 'Midnight', color: '#3B82F6', icon: '🌑' },
    { id: 'neon',     label: 'Neon',     color: '#00F5FF', icon: '⚡' },
    { id: 'ocean',    label: 'Ocean',    color: '#29B6F6', icon: '🌊' },
    { id: 'forest',   label: 'Forest',   color: '#4CAF50', icon: '🌿' },
    { id: 'fire',     label: 'Fire',     color: '#FF6D00', icon: '🔥' },
    { id: 'galaxy',   label: 'Galaxy',   color: '#AA00FF', icon: '🌌' },
    { id: 'scifi',    label: 'Sci-Fi HUD', color: '#00E5FF', icon: '🛸' },
  ]},
  { group: 'ซูเปอร์ฮีโร่', themes: [
    { id: 'avengers',  label: 'Avengers', color: '#ED1D24', icon: '🛡️' },
    { id: 'spiderman', label: 'Spider-Man', color: '#E31B23', icon: '🕸️' },
    { id: 'ironman',   label: 'Iron Man', color: '#C8102E', icon: '🦾' },
    { id: 'guardians', label: 'Guardians of the Galaxy', color: '#FF8A00', icon: '🌌' },
  ]},
  { group: 'น่ารัก', themes: [
    { id: 'kuromi',   label: 'คุโรมิ', color: '#8E24AA', icon: '🎀' },
    { id: 'cutecat',  label: 'แมวน่ารักๆ', color: '#FF7EB6', icon: '🐱' },
    { id: 'cutekid',  label: 'เด็กน้อยน่ารัก', color: '#4FC3F7', icon: '🧸' },
    { id: 'cutegirl', label: 'น่ารักๆเอาใจสาวๆ', color: '#F48FB1', icon: '💗' },
  ]},
  { group: 'มงคล / ฮวงจุ้ย', themes: [
    { id: 'dragon',     label: 'มังกร', color: '#C62828', icon: '🐉' },
    { id: 'luckysales', label: 'เสริมดวงการขาย', color: '#D4AF37', icon: '🧧' },
    { id: 'fengshui',   label: 'เสริมฮวงจุ้ย', color: '#2E7D32', icon: '☯️' },
  ]},
  { group: 'ธุรกิจ / มืออาชีพ', themes: [
    { id: 'spy',         label: 'สายลับ', color: '#3E7CB1', icon: '🕵️' },
    { id: 'prosales',    label: 'นักขายมืออาชีพ', color: '#1976D2', icon: '💼' },
    { id: 'executive',   label: 'ผู้บริหาร', color: '#D4AF37', icon: '🎩' },
    { id: 'darkintense', label: 'ดุเข้ม', color: '#B71C1C', icon: '⚔️' },
  ]},
  { group: 'ธรรมชาติ', themes: [
    { id: 'space',     label: 'อวกาศ', color: '#7C4DFF', icon: '🪐' },
    { id: 'sky',       label: 'ท้องฟ้า', color: '#42A5F5', icon: '☁️' },
    { id: 'sea',       label: 'ทะเล', color: '#00897B', icon: '🌊' },
    { id: 'mountain',  label: 'ภูเขา', color: '#78909C', icon: '⛰️' },
    { id: 'waterfall', label: 'น้ำตก', color: '#26C6DA', icon: '💧' },
  ]},
  { group: 'การบิน / อวกาศ', themes: [
    { id: 'spaceship',  label: 'ยานอวกาศ', color: '#29B6F6', icon: '🚀' },
    { id: 'fighterjet', label: 'เครื่องบินรบ', color: '#00FF41', icon: '✈️' },
  ]},
  { group: 'รถยนต์', themes: [
    { id: 'automotive', label: 'รถยนต์', color: '#E53935', icon: '🏎️' },
    { id: 'deepal',      label: 'DEEPAL', color: '#00D9A6', icon: '🚙' },
  ]},
  { group: 'อื่นๆ', themes: [
    { id: 'easyeyes', label: 'สบายตา', color: '#A1887F', icon: '🌤️' },
    { id: 'horror',   label: 'สยองขวัญ', color: '#8B0000', icon: '🩸' },
  ]},
]

