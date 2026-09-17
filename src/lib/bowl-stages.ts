export type Rng = () => number;

export type PinSpot = { x: number; y: number; scale?: number };
export type PadSpot = { x: number; y: number; w: number; h: number; kind: "slow" | "fast" };

export type Lane = { w: number; h: number; left: number; right: number };

export const BOWL_STAGES = [
  { id: "triangle", name: "기본 삼각", hint: "정석 볼링" },
  { id: "split", name: "두 덩이", hint: "좌우를 나눠 공략" },
  { id: "scatter", name: "흩어진 핀", hint: "빈 틈을 노려요" },
  { id: "walls", name: "벽 앵글", hint: "벽에 튕기면 들어가요" },
  { id: "zigzag", name: "지그재그", hint: "각도를 꺾어야 해요" },
  { id: "diamond", name: "다이아", hint: "가운데를 비웠어요" },
  { id: "guards", name: "앞막이", hint: "앞에 세 개가 길을 막아요" },
  { id: "tunnel", name: "터널", hint: "좁은 길로 FAST를 타요" },
  { id: "islands", name: "세 섬", hint: "덩어리 세 곳을 이어요" },
  { id: "chaos", name: "난장판", hint: "판도 핀도 제멋대로" },
] as const;

export type StageId = (typeof BOWL_STAGES)[number]["id"];

export const FIRST_STAGE: StageId = "triangle";

export function stageById(id: string) {
  return BOWL_STAGES.find((s) => s.id === id) ?? BOWL_STAGES[0]!;
}

export function nextLockedStage(unlocked: string[]): StageId | null {
  return BOWL_STAGES.find((s) => !unlocked.includes(s.id))?.id ?? null;
}

export function mulberry(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jitter(n: number, amt: number, rng: Rng) {
  return n + (rng() - 0.5) * amt;
}

export function buildStage(id: StageId, lane: Lane, rng: Rng) {
  const { w, h, left, right } = lane;
  const L = left + 28;
  const R = right - 28;
  const top = h * 0.15;
  const mid = h * 0.26;
  const low = h * 0.38;
  const pins: PinSpot[] = [];
  const pads: PadSpot[] = [];
  const add = (x: number, y: number, scale = 1) => pins.push({ x, y, scale });

  if (id === "triangle") {
    const rows = [4, 3, 2, 1];
    const gapY = Math.min(48, h * 0.055);
    const gapX = Math.min(42, w * 0.09);
    rows.forEach((count, row) => {
      const y = top + row * gapY;
      const rowW = (count - 1) * gapX;
      for (let c = 0; c < count; c++) add(w / 2 - rowW / 2 + c * gapX, y, 0.86 + row * 0.05);
    });
  } else if (id === "split") {
    for (let i = 0; i < 4; i++) add(L + 8 + (i % 2) * 30, top + Math.floor(i / 2) * 42, 0.95);
    for (let i = 0; i < 6; i++) add(R - 8 - (i % 3) * 28, top + Math.floor(i / 3) * 40, 0.95);
    pads.push({ x: w * 0.38, y: h * 0.55, w: w * 0.24, h: 28, kind: "slow" });
  } else if (id === "scatter") {
    let guard = 0;
    while (pins.length < 10 && guard++ < 220) {
      const x = L + rng() * (R - L);
      const y = top + rng() * (low - top);
      if (pins.every((q) => Math.hypot(q.x - x, q.y - y) > 34)) add(x, y, 0.92 + rng() * 0.1);
    }
    pads.push({ x: w * 0.48, y: h * 0.58, w: w * 0.2, h: 28, kind: "fast" });
  } else if (id === "walls") {
    for (let i = 0; i < 5; i++) add(L + 4, top + i * 38, 0.96);
    for (let i = 0; i < 5; i++) add(R - 4, top + 16 + i * 38, 0.96);
    pads.push({ x: w * 0.3, y: h * 0.5, w: w * 0.18, h: 26, kind: "fast" });
  } else if (id === "zigzag") {
    for (let i = 0; i < 10; i++) add(i % 2 === 0 ? L + 16 : R - 16, top + i * 22, 0.94);
    pads.push({ x: w * 0.28, y: h * 0.62, w: w * 0.2, h: 26, kind: "slow" });
    pads.push({ x: w * 0.52, y: h * 0.48, w: w * 0.18, h: 26, kind: "fast" });
  } else if (id === "diamond") {
    add(w / 2, top, 1);
    add(w / 2 - 36, top + 36);
    add(w / 2 + 36, top + 36);
    add(w / 2 - 58, mid);
    add(w / 2 + 58, mid);
    add(w / 2 - 36, mid + 40);
    add(w / 2 + 36, mid + 40);
    add(w / 2, low);
    add(w / 2 - 20, low - 18, 0.9);
    add(w / 2 + 20, low - 18, 0.9);
  } else if (id === "guards") {
    add(w / 2 - 34, low + 8, 1.05);
    add(w / 2, low + 18, 1.08);
    add(w / 2 + 34, low + 8, 1.05);
    add(w / 2 - 50, top + 10);
    add(w / 2 - 18, top);
    add(w / 2 + 18, top);
    add(w / 2 + 50, top + 10);
    add(w / 2 - 32, top + 48);
    add(w / 2, top + 42);
    add(w / 2 + 32, top + 48);
    pads.push({ x: w * 0.4, y: h * 0.52, w: w * 0.2, h: 24, kind: "slow" });
  } else if (id === "tunnel") {
    for (let i = 0; i < 4; i++) add(L + 10, top + 12 + i * 36);
    for (let i = 0; i < 4; i++) add(R - 10, top + 12 + i * 36);
    add(w / 2, top + 8);
    add(w / 2, low);
    pads.push({ x: w * 0.36, y: h * 0.46, w: w * 0.28, h: 36, kind: "fast" });
    pads.push({ x: w * 0.24, y: h * 0.64, w: w * 0.18, h: 24, kind: "slow" });
  } else if (id === "islands") {
    const clusters = [
      { x: L + 24, y: top + 20 },
      { x: R - 24, y: top + 28 },
      { x: w / 2, y: low - 10 },
    ];
    clusters.forEach((c, i) => {
      const n = i === 2 ? 4 : 3;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        add(c.x + Math.cos(a) * 22, c.y + Math.sin(a) * 16, 0.95);
      }
    });
    pads.push({ x: w * 0.42, y: h * 0.5, w: w * 0.16, h: 28, kind: "fast" });
  } else {
    let guard = 0;
    while (pins.length < 10 && guard++ < 240) {
      const x = L + rng() * (R - L);
      const y = top + rng() * (h * 0.48 - top);
      if (pins.every((q) => Math.hypot(q.x - x, q.y - y) > 32)) add(x, y, 0.9 + rng() * 0.14);
    }
    pads.push({ x: w * (0.22 + rng() * 0.12), y: h * 0.5, w: w * 0.2, h: 30, kind: "slow" });
    pads.push({ x: w * (0.5 + rng() * 0.1), y: h * 0.62, w: w * 0.2, h: 28, kind: "fast" });
    if (rng() > 0.4) pads.push({ x: w * 0.34, y: h * 0.42, w: w * 0.16, h: 22, kind: rng() > 0.5 ? "fast" : "slow" });
  }

  for (const p of pins) {
    p.x = jitter(p.x, 10, rng);
    p.y = jitter(p.y, 8, rng);
  }
  for (const pad of pads) {
    pad.x = jitter(pad.x, 16, rng);
    pad.y = jitter(pad.y, 12, rng);
  }
  return { pins, pads };
}
