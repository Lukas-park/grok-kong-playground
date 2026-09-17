import { MOODS, type Mood } from "@/lib/themes";

export function drawBean(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  mood: Mood,
  opts?: { squash?: number; tilt?: number; blush?: boolean },
) {
  const spec = MOODS.find((m) => m.id === mood) ?? MOODS[1];
  const squash = opts?.squash ?? 1;
  const tilt = opts?.tilt ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(Math.max(0.7, 1 / squash), squash);

  ctx.beginPath();
  ctx.ellipse(0, 2, r * 0.92, r * 1.08, -0.18, 0, Math.PI * 2);
  ctx.fillStyle = spec.fill;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.28, r * 0.32, r * 0.22, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.fill();

  ctx.fillStyle = spec.face;
  const eyeY = -r * 0.06;
  const eyeR = Math.max(1.6, r * 0.12);
  ctx.beginPath();
  ctx.arc(-r * 0.22, eyeY, eyeR, 0, Math.PI * 2);
  ctx.arc(r * 0.24, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = spec.face;
  ctx.lineWidth = Math.max(1.4, r * 0.08);
  ctx.lineCap = "round";
  ctx.beginPath();
  if (mood === "best") {
    ctx.arc(0, r * 0.18, r * 0.32, 0.15, Math.PI - 0.15);
  } else if (mood === "good") {
    ctx.arc(0, r * 0.2, r * 0.26, 0.2, Math.PI - 0.2);
  } else if (mood === "ok") {
    ctx.moveTo(-r * 0.16, r * 0.28);
    ctx.lineTo(r * 0.16, r * 0.28);
  } else if (mood === "bad") {
    ctx.arc(0, r * 0.42, r * 0.22, Math.PI + 0.3, -0.3);
  } else {
    ctx.arc(0, r * 0.46, r * 0.2, Math.PI + 0.4, -0.4);
    ctx.moveTo(-r * 0.34, r * 0.08);
    ctx.lineTo(-r * 0.12, r * 0.18);
    ctx.moveTo(r * 0.34, r * 0.08);
    ctx.lineTo(r * 0.12, r * 0.18);
  }
  ctx.stroke();

  if (opts?.blush) {
    ctx.fillStyle = "rgba(255,140,140,0.35)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.42, r * 0.12, r * 0.12, r * 0.08, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.44, r * 0.12, r * 0.12, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawClover(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#4f9a5c";
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.42, s * 0.28, s * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#3f8a52";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(s * 0.12, s * 0.4, 0, s * 0.7);
  ctx.stroke();
  ctx.restore();
}
