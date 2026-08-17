// Thai Voice — STT (Speech-to-Text) + TTS (Text-to-Speech)
import { ttsCloud } from './ai.js'

export function createSTT({ onInterim, onFinal, onEnd, onError } = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) return null
  const rec = new SR()
  rec.lang = 'th-TH'
  rec.continuous = false
  rec.interimResults = true
  rec.onresult = e => {
    let interim = '', final = ''
    for (const r of e.results) {
      if (r.isFinal) final += r[0].transcript
      else interim += r[0].transcript
    }
    if (final) onFinal?.(final.trim())
    else onInterim?.(interim.trim())
  }
  rec.onend = () => onEnd?.()
  rec.onerror = e => onError?.(e.error)
  return rec
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripEmoji(text) {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[◈★☆•·▌]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function splitText(text, maxLen = 150) {
  const chunks = []
  const parts = text.split(/(?<=[.!?।。\n])\s*/)
  let cur = ''
  for (const p of parts) {
    if ((cur + p).length > maxLen && cur) {
      chunks.push(cur.trim())
      cur = p
    } else {
      cur += (cur ? ' ' : '') + p
    }
  }
  if (cur.trim()) chunks.push(cur.trim())
  return chunks.length ? chunks : [text]
}

// ── TTS — Cloud (Gemini TTS) พร้อม fallback Web Speech API ──────────────────────
// (v1.0.444) currentAudio เก็บ <audio> ที่กำลังเล่นอยู่ (ถ้ามี) ให้ stopSpeaking() หยุดได้ทั้ง 2 ทาง
let currentAudio = null

// Gemini TTS ส่ง raw PCM กลับมา (24kHz, mono, 16-bit) ไม่มี header — ต้องห่อเป็น WAV เองก่อนเล่นผ่าน <audio>
function pcmBase64ToWavBlob(base64, sampleRate = 24000) {
  const binary = atob(base64)
  const pcm = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) pcm[i] = binary.charCodeAt(i)
  const buf = new ArrayBuffer(44 + pcm.length)
  const dv = new DataView(buf)
  const wStr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)) }
  wStr(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length, true); wStr(8, 'WAVE')
  wStr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true) // PCM
  dv.setUint16(22, 1, true); dv.setUint32(24, sampleRate, true)           // mono
  dv.setUint32(28, sampleRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
  wStr(36, 'data'); dv.setUint32(40, pcm.length, true)
  new Uint8Array(buf, 44).set(pcm)
  return new Blob([buf], { type: 'audio/wav' })
}

function playCloudAudio(base64Pcm, onEnd) {
  const url = URL.createObjectURL(pcmBase64ToWavBlob(base64Pcm))
  const audio = new Audio(url)
  currentAudio = audio
  const cleanup = () => { URL.revokeObjectURL(url); if (currentAudio === audio) currentAudio = null }
  audio.onended = () => { cleanup(); onEnd?.() }
  audio.onerror = () => { cleanup(); onEnd?.() }
  audio.play().catch(() => { cleanup(); onEnd?.() })
}

// ── TTS — Web Speech API (fallback เมื่อ cloud ใช้ไม่ได้ เช่น ยังไม่ได้ล็อกอิน/เน็ตหลุด) ──────────
// speechSynthesis.speak() does NOT require fresh user-gesture context like Audio.play()
// Chrome picks the best available Thai voice when lang='th-TH' is set without forcing a voice

function doSpeak(text, onEnd) {
  const synth = window.speechSynthesis
  synth.cancel()
  const chunks = splitText(text, 150)
  let idx = 0
  const sayNext = () => {
    if (idx >= chunks.length) { onEnd?.(); return }
    const chunk = chunks[idx++]
    if (!chunk.trim()) { sayNext(); return }
    const utt = new SpeechSynthesisUtterance(chunk)
    utt.lang  = 'th-TH'   // let browser auto-select best Thai voice (online or local)
    utt.rate  = 0.92
    utt.pitch = 1.0
    utt.onend  = sayNext
    utt.onerror = () => sayNext()
    synth.speak(utt)
  }
  sayNext()
}

// (v1.0.444) speak() เดิมใช้ Web Speech API อย่างเดียว ซึ่งพึ่งเสียงพูดที่ติดตั้งในเครื่อง — บางอุปกรณ์ไม่มี
// เสียงไทยเลย (พบจริง getVoices()===0) ทำให้ AI "เงียบ" ผู้ใช้ขอเปลี่ยนเป็นระบบคลาวด์ทั้งหมด ("ทุกอย่างต้อง
// ออนไลน์ 100%") ตอนนี้ลองเรียก Gemini TTS ผ่าน proxy ก่อนเสมอ (ได้เสียงจริง ไม่พึ่งเสียงในเครื่องเลย) แล้ว
// fallback ไป Web Speech API เฉพาะตอนเรียกคลาวด์ไม่สำเร็จ (ยังไม่ได้ล็อกอิน/เน็ตหลุด/โควต้าเกิน) — onNoVoice
// จะ fire เฉพาะตอน fallback แล้วเครื่องนี้ไม่มีเสียงติดตั้งจริงๆด้วย (เงียบทั้ง 2 ทาง ต้องแจ้งผู้ใช้)
export function speak(text, { onEnd, onNoVoice } = {}) {
  if (!text) { onEnd?.(); return }
  const clean = stripEmoji(text)
  if (!clean) { onEnd?.(); return }

  stopSpeaking()

  ttsCloud(clean)
    .then(base64Pcm => {
      if (!base64Pcm) throw new Error('no cloud audio')
      playCloudAudio(base64Pcm, onEnd)
    })
    .catch(() => speakLocal(clean, onEnd, onNoVoice))
}

function speakLocal(clean, onEnd, onNoVoice) {
  const synth = window.speechSynthesis
  if (!synth) { onNoVoice?.(); onEnd?.(); return }

  // Trigger voice list load (Chrome lazy-loads voices on first getVoices() call)
  synth.getVoices()

  let fired = false
  const fire = () => {
    if (fired) return
    fired = true
    synth.onvoiceschanged = null
    if (synth.getVoices().length === 0) onNoVoice?.()
    doSpeak(clean, onEnd)
  }

  if (synth.getVoices().length > 0) {
    fire()
  } else {
    // Wait for voices to load, fall back after 1.2s
    synth.onvoiceschanged = fire
    setTimeout(fire, 1200)
  }
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel()
  if (currentAudio) { currentAudio.pause(); currentAudio = null }
}

export const canSTT = !!(window.SpeechRecognition || window.webkitSpeechRecognition)
export const canTTS = typeof window !== 'undefined' && !!window.speechSynthesis
