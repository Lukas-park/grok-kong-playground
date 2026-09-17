let ctx: AudioContext | null = null;

function ac() {
  if (typeof window === "undefined") return null;
  ctx ??= new AudioContext();
  return ctx;
}

export function unlockAudio() {
  const audio = ac();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.08,
  slide = 0,
) {
  const audio = ac();
  if (!audio) return;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), audio.currentTime + duration);
  g.gain.setValueAtTime(gain, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration);
}

export const sfx = {
  tap: () => tone(520, 0.08, "sine", 0.05),
  jump: () => tone(340, 0.12, "triangle", 0.06, 180),
  land: () => tone(180, 0.1, "sine", 0.05, -40),
  collect: () => {
    tone(660, 0.08, "sine", 0.05);
    tone(880, 0.12, "sine", 0.04);
  },
  fall: () => tone(220, 0.35, "triangle", 0.06, -140),
  strike: () => {
    tone(140, 0.2, "square", 0.04);
    tone(420, 0.18, "triangle", 0.05);
    tone(680, 0.22, "sine", 0.04);
  },
  pin: () => tone(240 + Math.random() * 80, 0.09, "triangle", 0.05),
  roll: () => tone(90, 0.28, "sawtooth", 0.03, -20),
  unlock: () => {
    tone(523, 0.12, "sine", 0.05);
    tone(659, 0.16, "sine", 0.05);
    tone(784, 0.22, "sine", 0.05);
  },
  water: () => tone(480, 0.14, "sine", 0.05, 80),
};
