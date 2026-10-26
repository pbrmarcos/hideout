import type { SoundId } from '@shared/types'

/** Short notification sounds synthesized with Web Audio: no audio files, nothing to license. */
let ctx: AudioContext | null = null

function audio(): AudioContext {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface Note {
  freq: number
  at: number
  dur: number
  type?: OscillatorType
  gain?: number
}

function play(notes: Note[], volume: number): void {
  const a = audio()
  const master = a.createGain()
  master.gain.value = Math.max(0, Math.min(1, volume)) * 0.5
  master.connect(a.destination)
  const t0 = a.currentTime + 0.02
  for (const n of notes) {
    const osc = a.createOscillator()
    const env = a.createGain()
    osc.type = n.type ?? 'sine'
    osc.frequency.value = n.freq
    const peak = n.gain ?? 0.8
    env.gain.setValueAtTime(0.0001, t0 + n.at)
    env.gain.exponentialRampToValueAtTime(peak, t0 + n.at + 0.012)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur)
    osc.connect(env).connect(master)
    osc.start(t0 + n.at)
    osc.stop(t0 + n.at + n.dur + 0.05)
  }
}

/** Partials for a bell-like tone. */
const bellTone = (freq: number, at: number, dur: number): Note[] => [
  { freq, at, dur },
  { freq: freq * 2.76, at, dur: dur * 0.5, gain: 0.25 },
  { freq: freq * 5.4, at, dur: dur * 0.25, gain: 0.1 }
]

const SOUNDS: Record<Exclude<SoundId, 'windows' | 'none'>, Note[]> = {
  chime: [...bellTone(880, 0, 0.9), ...bellTone(1318.5, 0.16, 1.1)],
  bell: [...bellTone(659.3, 0, 1.6), ...bellTone(659.3, 0.55, 1.6)],
  soft: [{ freq: 523.3, at: 0, dur: 0.5, gain: 0.5 }, { freq: 659.3, at: 0.12, dur: 0.6, gain: 0.45 }],
  pop: [{ freq: 1200, at: 0, dur: 0.09, type: 'triangle' }, { freq: 1600, at: 0.08, dur: 0.12, type: 'triangle', gain: 0.6 }],
  marimba: [
    { freq: 523.3, at: 0, dur: 0.35, type: 'triangle' },
    { freq: 659.3, at: 0.11, dur: 0.35, type: 'triangle' },
    { freq: 784, at: 0.22, dur: 0.5, type: 'triangle' }
  ],
  digital: [0, 0.16, 0.32].map((at) => ({ freq: 1046.5, at, dur: 0.1, type: 'square' as OscillatorType, gain: 0.25 }))
}

export const SOUND_IDS: SoundId[] = ['chime', 'bell', 'soft', 'pop', 'marimba', 'digital', 'windows', 'none']

/** Names shown in Settings (Portuguese keys, translated at render time). */
export const SOUND_LABEL: Record<SoundId, string> = {
  chime: 'Carrilhão',
  bell: 'Sino',
  soft: 'Suave',
  pop: 'Pop',
  marimba: 'Marimba',
  digital: 'Digital',
  windows: 'Som do Windows',
  none: 'Sem som'
}

export function playSound(id: SoundId, volume = 0.7): void {
  if (id === 'none' || id === 'windows') return
  play(SOUNDS[id], volume)
}
