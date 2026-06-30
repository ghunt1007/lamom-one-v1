// Thai Voice — STT (Speech-to-Text) + TTS (Text-to-Speech)

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

// ── TTS — Web Speech API ──────────────────────────────────────────────────────
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

export function speak(text, { onEnd } = {}) {
  if (!text) { onEnd?.(); return }
  const clean = stripEmoji(text)
  if (!clean) { onEnd?.(); return }

  const synth = window.speechSynthesis
  if (!synth) { onEnd?.(); return }

  // Trigger voice list load (Chrome lazy-loads voices on first getVoices() call)
  synth.getVoices()

  let fired = false
  const fire = () => {
    if (fired) return
    fired = true
    synth.onvoiceschanged = null
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
}

export const canSTT = !!(window.SpeechRecognition || window.webkitSpeechRecognition)
export const canTTS = typeof window !== 'undefined' && !!window.speechSynthesis
