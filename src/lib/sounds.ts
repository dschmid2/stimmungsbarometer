/**
 * Buzzer-Sounds, im Browser erzeugt (Web Audio, keine Audiodateien).
 * Jeder Druck klingt etwas anders, aber die Richtung ist immer klar:
 *   negativ = fällt, tief, weich (freundlich, nie hämisch)
 *   neutral = bleibt auf einer Tonhöhe
 *   positiv = steigt, hell, Dur
 */

type ToneOpts = { type?: OscillatorType; vol?: number; to?: number; vib?: number; lp?: number };
type Sound = (t: number, k: number) => void;

let actx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = 0.6;

export function setVolume(v: number) {
  volume = v;
  if (master) master.gain.value = v;
}

/** Muss einmal durch eine Nutzeraktion ausgelöst werden (Browser-Regel). */
export function unlockAudio() {
  try {
    if (!actx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      actx = new AC();
      master = actx.createGain();
      master.connect(actx.destination);
    }
    master!.gain.value = volume;
    if (actx.state === 'suspended') actx.resume().catch(() => {});
  } catch {
    actx = null;
  }
}

function tone(f: number, t0: number, d: number, o: ToneOpts = {}) {
  const ctx = actx!, out = master!;
  const { type = 'square', vol = 0.3, to, vib = 0, lp } = o;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + d);
  if (vib) {
    const l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = vib; lg.gain.value = f * 0.035;
    l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + d + 0.05);
  }
  let node: AudioNode = osc;
  if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; osc.connect(fl); node = fl; }
  node.connect(g); g.connect(out);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  osc.start(t0); osc.stop(t0 + d + 0.05);
}

const st = (f: number, n: number) => f * Math.pow(2, n / 12);

const SOUNDS: Sound[][] = [
  [ // negativ
    (t, k) => { [0, -1, -2].forEach((n, i) => tone(st(233 * k, n), t + i * 0.3, 0.28, { type: 'sawtooth', vol: 0.14, lp: 900 })); tone(st(233 * k, -3), t + 0.9, 0.7, { type: 'sawtooth', vol: 0.14, lp: 900, vib: 6 }); },
    (t, k) => tone(520 * k, t, 0.6, { type: 'sine', vol: 0.32, to: 160 * k }),
    (t, k) => { tone(190 * k, t, 0.22, { type: 'triangle', vol: 0.45, to: 70 * k }); tone(130 * k, t + 0.2, 0.3, { type: 'triangle', vol: 0.4, to: 50 * k }); },
    (t, k) => tone(420 * k, t, 0.85, { type: 'square', vol: 0.1, to: 90 * k, vib: 9, lp: 700 }),
  ],
  [ // neutral
    (t, k) => tone(440 * k, t, 0.28, { type: 'sine', vol: 0.38 }),
    (t, k) => { tone(660 * k, t, 0.09, { type: 'triangle', vol: 0.4 }); tone(660 * k, t + 0.16, 0.09, { type: 'triangle', vol: 0.4 }); },
    (t, k) => { tone(330 * k, t, 0.38, { type: 'triangle', vol: 0.32, vib: 5 }); tone(330 * k, t + 0.45, 0.2, { type: 'triangle', vol: 0.28 }); },
    (t, k) => { tone(523 * k, t, 0.07, { type: 'square', vol: 0.12, lp: 2000 }); tone(523 * k, t + 0.12, 0.07, { type: 'square', vol: 0.12, lp: 2000 }); },
  ],
  [ // positiv
    (t, k) => [0, 4, 7, 12].forEach((n, i) => tone(st(523 * k, n), t + i * 0.08, i === 3 ? 0.35 : 0.1, { vol: 0.13, lp: 3500 })),
    (t, k) => { tone(988 * k, t, 0.08, { vol: 0.12, lp: 4000 }); tone(1319 * k, t + 0.08, 0.4, { vol: 0.12, lp: 4000 }); },
    (t, k) => { tone(300 * k, t, 0.42, { type: 'sine', vol: 0.3, to: 1200 * k }); tone(1200 * k, t + 0.42, 0.15, { type: 'sine', vol: 0.25, vib: 8 }); },
    (t, k) => { [0, 4, 7].forEach((n) => tone(st(392 * k, n), t, 0.12, { type: 'triangle', vol: 0.14 })); [0, 4, 7, 12].forEach((n) => tone(st(523 * k, n), t + 0.16, 0.65, { type: 'triangle', vol: 0.12 })); },
    (t, k) => { tone(200 * k, t, 0.18, { type: 'sine', vol: 0.35, to: 800 * k }); tone(800 * k, t + 0.18, 0.25, { type: 'sine', vol: 0.28, vib: 12 }); },
  ],
];

const last = [-1, -1, -1];

/** Spielt einen zufälligen Sound der Kategorie (0 negativ, 1 neutral, 2 positiv). */
export function playBuzzer(v: 0 | 1 | 2) {
  unlockAudio();
  if (!actx) return;
  try {
    const list = SOUNDS[v];
    let i: number;
    do { i = Math.floor(Math.random() * list.length); } while (i === last[v] && list.length > 1);
    last[v] = i;
    const k = Math.pow(2, (Math.floor(Math.random() * 7) - 3) / 12);
    list[i](actx.currentTime + 0.02, k);
  } catch { /* Ton ist Zugabe, kein Muss */ }
}
