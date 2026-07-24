// Thai National ID (13-digit) and Tax ID validation

export function validateThaiId(id) {
  if (!id) return { valid: false, error: 'กรุณากรอกเลขบัตรประชาชน' }
  const digits = id.replace(/[-\s]/g, '')
  if (!/^\d{13}$/.test(digits)) return { valid: false, error: 'ต้องมี 13 หลัก (ตัวเลขเท่านั้น)' }
  if (digits[0] === '0') return { valid: false, error: 'หลักแรกต้องไม่เป็น 0' }

  let sum = 0
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * (13 - i)
  const checkDigit = (11 - (sum % 11)) % 10
  if (checkDigit !== parseInt(digits[12])) return { valid: false, error: 'เลขบัตรประชาชนไม่ถูกต้อง' }
  return { valid: true }
}

export function formatThaiId(id) {
  const d = (id || '').replace(/\D/g, '').slice(0, 13)
  if (d.length <= 1) return d
  if (d.length <= 5) return `${d[0]}-${d.slice(1)}`
  if (d.length <= 10) return `${d[0]}-${d.slice(1,5)}-${d.slice(5)}`
  if (d.length <= 12) return `${d[0]}-${d.slice(1,5)}-${d.slice(5,10)}-${d.slice(10)}`
  return `${d[0]}-${d.slice(1,5)}-${d.slice(5,10)}-${d.slice(10,12)}-${d[12]}`
}

// Thai Tax ID (เลขประจำตัวผู้เสียภาษีอากร) — same MOD-11 checksum as the national ID,
// but unlike a personal ID card, this routinely starts with 0 for juristic persons
// (it's the same 13-digit number as the DBD company registration number).
export function validateTaxId(id) {
  if (!id) return { valid: false, error: 'กรุณากรอกเลขประจำตัวผู้เสียภาษี' }
  const digits = id.replace(/[-\s]/g, '')
  if (!/^\d{13}$/.test(digits)) return { valid: false, error: 'ต้องมี 13 หลัก' }

  let sum = 0
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * (13 - i)
  const checkDigit = (11 - (sum % 11)) % 10
  if (checkDigit !== parseInt(digits[12])) return { valid: false, error: 'เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง' }
  return { valid: true }
}
