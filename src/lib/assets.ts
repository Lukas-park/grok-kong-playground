import type { Mood, ThemeId } from "@/lib/themes";

export const MOOD_INDEX: Record<Mood, number> = {
  best: 1,
  good: 2,
  ok: 3,
  bad: 4,
  worst: 5,
};

export function beanSrc(theme: ThemeId, mood: Mood | number) {
  const n = typeof mood === "number" ? mood : MOOD_INDEX[mood];
  return `/beans/${theme}-${n}.png`;
}

export function themeBg(theme: ThemeId) {
  return `/themes/${theme}.png`;
}

export const CLOVER_ICON = "/icons/clover.png";

const cache = new Map<string, HTMLImageElement>();

export function getImage(src: string) {
  let img = cache.get(src);
  if (img) return img;
  img = new Image();
  img.src = src;
  cache.set(src, img);
  return img;
}

export function preloadTheme(theme: ThemeId) {
  getImage(themeBg(theme));
  getImage(CLOVER_ICON);
  (["best", "good", "ok", "bad", "worst"] as Mood[]).forEach((m) => getImage(beanSrc(theme, m)));
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  src: string,
  x: number,
  y: number,
  size: number,
  opts?: { squash?: number; tilt?: number; alpha?: number },
) {
  const img = getImage(src);
  if (!img.complete || !img.naturalWidth) return false;
  const squash = opts?.squash ?? 1;
  ctx.save();
  ctx.globalAlpha = opts?.alpha ?? 1;
  ctx.translate(x, y);
  ctx.rotate(opts?.tilt ?? 0);
  ctx.scale(Math.max(0.65, 1 / squash), squash);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
  return true;
}
