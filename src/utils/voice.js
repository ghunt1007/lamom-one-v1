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

export function speak(text, { onEnd } = {}) {
  const synth = window.speechSynthesis
  if (!synth || !text) return
  synth.cancel()
  // Split long text into chunks to avoid browser cutoff bug
  const chunks = text.match(/.{1,200}[.!?。\s]|.{1,200}/g) || [text]
  let idx = 0
  const sayNext = () => {
    if (idx >= chunks.length) { onEnd?.(); return }
    const utt = new SpeechSynthesisUtterance(chunks[idx++])
    utt.lang = 'th-TH'
    utt.rate = 1.05
    utt.pitch = 1.0
    const voices = synth.getVoices()
    const thVoice = voices.find(v => v.lang.startsWith('th'))
    if (thVoice) utt.voice = thVoice
    utt.onend = sayNext
    synth.speak(utt)
  }
  // Ensure voices loaded
  if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.onvoiceschanged = () => { speechSynthesis.onvoiceschanged = null; sayNext() }
  } else {
    sayNext()
  }
}

export const stopSpeaking = () => window.speechSynthesis?.cancel()
export const canSTT = !!(window.SpeechRecognition || window.webkitSpeechRecognition)
export const canTTS = !!window.speechSynthesis
