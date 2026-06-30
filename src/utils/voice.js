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

// ── TTS helpers ──────────────────────────────────────────────────────────────

function getThaiVoice() {
  const voices = window.speechSynthesis?.getVoices() || []
  return voices.find(v =>
    v.lang === 'th-TH' || v.lang === 'th' ||
    v.name.toLowerCase().includes('thai') ||
    v.name.includes('Pattara') || v.name.includes('Niwat') || v.name.includes('Premwadee')
  ) || null
}

// Split text at natural boundaries, max chunkSize chars each
function splitText(text, chunkSize = 180) {
  const chunks = []
  const parts = text.split(/(?<=[.!?।。\n])\s*/)
  let current = ''
  for (const p of parts) {
    if ((current + p).length > chunkSize && current) {
      chunks.push(current.trim())
      current = p
    } else {
      current += (current ? ' ' : '') + p
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.length ? chunks : [text]
}

// Strip emojis / special symbols that confuse TTS engines
function stripEmoji(text) {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')   // emoji blocks
    .replace(/[\u{2600}-\u{27BF}]/gu, '')       // misc symbols
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[◈✕]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Google Translate TTS — free, works without OS Thai voice installed
// client=tw-ob is more reliable than gtx for Thai language output
async function speakGoogleTTS(text, onEnd) {
  const clean = stripEmoji(text)
  if (!clean) { onEnd?.(); return }
  const chunks = splitText(clean, 100)
  for (const chunk of chunks) {
    if (!chunk.trim()) continue
    const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk.trim())}&tl=th&client=tw-ob&total=1&idx=0&prev=input`
    await new Promise((resolve) => {
      const audio = new Audio(url)
      audio.onended = resolve
      audio.onerror = resolve // skip on error, don't hang
      audio.play().catch(resolve)
    })
  }
  onEnd?.()
}

// Native Web Speech TTS with specific voice
function speakNative(text, voice, onEnd) {
  const synth = window.speechSynthesis
  synth.cancel()
  const chunks = splitText(text, 200)
  let idx = 0
  const sayNext = () => {
    if (idx >= chunks.length) { onEnd?.(); return }
    const utt = new SpeechSynthesisUtterance(chunks[idx++])
    utt.lang = 'th-TH'
    utt.rate = 1.0
    utt.pitch = 1.0
    if (voice) utt.voice = voice
    utt.onend = sayNext
    utt.onerror = sayNext
    synth.speak(utt)
  }
  sayNext()
}

// Main speak — tries native Thai voice first, falls back to Google TTS
export function speak(text, { onEnd } = {}) {
  if (!text) { onEnd?.(); return }

  const synth = window.speechSynthesis

  const trySpeak = () => {
    const thVoice = getThaiVoice()
    if (thVoice) {
      speakNative(text, thVoice, onEnd)
    } else {
      if (synth) synth.cancel()
      speakGoogleTTS(text, onEnd)
    }
  }

  // Wait for voice list to load (async in some browsers)
  if (synth && synth.getVoices().length === 0) {
    synth.onvoiceschanged = () => { synth.onvoiceschanged = null; trySpeak() }
    setTimeout(() => { if (synth.onvoiceschanged) { synth.onvoiceschanged = null; trySpeak() } }, 500)
  } else {
    trySpeak()
  }
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel()
}

export const canSTT = !!(window.SpeechRecognition || window.webkitSpeechRecognition)
export const canTTS = true // Google TTS always available as fallback
