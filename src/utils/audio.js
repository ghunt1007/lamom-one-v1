// LAMOM ONE — Audio Recording & Conversion Utility (Voice-to-CRM)
//
// MediaRecorder ในเบราว์เซอร์บันทึกได้แค่ audio/webm (Chrome/Firefox) หรือ audio/mp4 (Safari)
// แต่ Gemini API รับเฉพาะ inlineData mimeType: audio/wav, mp3, aiff, aac, ogg, flac เท่านั้น
// (ไม่รองรับ audio/webm) — จึงต้องแปลงเป็น WAV ผ่าน Web Audio API ก่อนส่งให้ AI วิเคราะห์เสมอ
// ไฟล์ต้นฉบับ (webm/mp4/mp3 ฯลฯ) ยังอัปโหลดขึ้น R2 แบบเดิมไว้เล่นย้อนหลัง ไม่ต้องแปลง
//
// Gemini inline request จำกัดรวมไม่เกิน 20MB — ถ้าเสียงยาวมากจนแปลงเป็น WAV (แม้ลดเป็น mono
// 16kHz หรือต่ำกว่า) แล้วยังเกินงบ จะคืน tooLarge:true ให้ผู้เรียกข้ามการวิเคราะห์ AI ไป
// (ไฟล์เสียงจริงยังอัปโหลด+เล่นได้ปกติ แค่ไม่มีสรุปอัตโนมัติ)

const RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus', 'audio/webm',
  'audio/mp4;codecs=mp4a.40.2', 'audio/mp4',
  'audio/ogg;codecs=opus',
]

export function extFromMime(mime) {
  const m = String(mime || '')
  if (m.includes('webm')) return 'webm'
  if (m.includes('mp4')) return 'm4a'
  if (m.includes('ogg')) return 'ogg'
  if (m.includes('wav')) return 'wav'
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3'
  return 'audio'
}

// ขอสิทธิ์ไมค์จริงผ่าน getUserMedia แล้วเริ่มอัด — โยน error ถ้าเบราว์เซอร์ไม่รองรับหรือผู้ใช้ปฏิเสธสิทธิ์
export async function startMicRecording() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('เบราว์เซอร์นี้ไม่รองรับการอัดเสียง')
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mimeType = RECORDER_MIME_CANDIDATES.find(t => window.MediaRecorder?.isTypeSupported?.(t))
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
  const chunks = []
  recorder.addEventListener('dataavailable', e => { if (e.data.size) chunks.push(e.data) })
  recorder.start()
  return { stream, recorder, chunks }
}

// หยุดอัด รอ MediaRecorder ประกอบ Blob จริงให้เสร็จ แล้วปิดไมค์ (ปิดไฟไมค์ในเบราว์เซอร์)
export function stopMicRecording(session) {
  return new Promise(resolve => {
    if (!session?.recorder) { resolve(null); return }
    const { stream, recorder, chunks } = session
    recorder.addEventListener('stop', () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
      stream.getTracks().forEach(t => t.stop())
      resolve(blob)
    }, { once: true })
    recorder.stop()
  })
}

function encodePcm16Wav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)) }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate (mono, 16-bit)
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buffer
}

function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

// แปลง Blob/File เสียง (webm/mp4/mp3/wav/ogg ฯลฯ) → mono WAV base64 ที่ Gemini รับได้แน่นอน
// ลดอัตราสุ่ม (sample rate) อัตโนมัติถ้าไฟล์ยาวจนเกินงบ 20MB inline ของ Gemini
export async function blobToWavBase64(blob) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return { unsupported: true }

  const arrayBuffer = await blob.arrayBuffer()
  const ctx = new AudioCtx()
  let audioBuffer
  try {
    audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  } catch (e) {
    ctx.close()
    return { unsupported: true }
  }

  const duration = audioBuffer.duration
  const MAX_BYTES = 14 * 1024 * 1024 // เผื่อ base64 overhead (~33%) + prompt ให้ request รวมไม่เกิน 20MB
  let sampleRate = Math.min(16000, Math.floor(MAX_BYTES / (duration * 2)) || 16000)
  sampleRate = Math.max(6000, sampleRate)
  if (duration * sampleRate * 2 > MAX_BYTES) {
    ctx.close()
    return { tooLarge: true, durationSec: duration }
  }

  const offline = new OfflineAudioContext(1, Math.ceil(duration * sampleRate), sampleRate)
  const src = offline.createBufferSource()
  src.buffer = audioBuffer
  src.connect(offline.destination)
  src.start(0)
  const rendered = await offline.startRendering()
  ctx.close()

  const samples = rendered.getChannelData(0)
  const wavBuffer = encodePcm16Wav(samples, sampleRate)
  return { base64: arrayBufferToBase64(wavBuffer), mimeType: 'audio/wav', durationSec: duration }
}
