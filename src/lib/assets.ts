import type { Mood, ThemeId } from "@/lib/themes";

export const MOOD_INDEX: Record<Mood, number> = {
  worst: 1,
  bad: 2,
  ok: 3,
  good: 4,
  best: 5,
};

export function beanSrc(theme: ThemeId, mood: Mood | number) {
  const n = typeof mood === "number" ? mood : MOOD_INDEX[mood];
  return `/beans/${theme}-${n}.png`;
}

export function themeBg(theme: ThemeId) {
  return `/themes/${theme}.png`;
}

export const CLOVER_ICON = "/icons/clover.png";
export const CLOVER_SPARK = "/icons/clover-spark.png";
export const BEAN_BALL = "/games/bean-ball.png";
export const LARVA_SPRITE = "/games/larva.png";
export const FLY_SPRITE = "/games/fly.png";

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
  getImage(CLOVER_SPARK);
  getImage(BEAN_BALL);
  getImage(LARVA_SPRITE);
  getImage(FLY_SPRITE);
  (["best", "good", "ok", "bad", "worst"] as Mood[]).forEach((m) => getImage(beanSrc(theme, m)));
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  src: string,
  x: number,
  y: number,
  size: number,
  opts?: { squash?: number; tilt?: number; alpha?: number; flipX?: boolean; width?: number; height?: number },
) {
  const img = getImage(src);
  if (!img.complete || !img.naturalWidth) return false;
  const squash = opts?.squash ?? 1;
  const dw = opts?.width ?? size;
  const dh = opts?.height ?? size;
  ctx.save();
  ctx.globalAlpha = opts?.alpha ?? 1;
  ctx.translate(x, y);
  ctx.rotate(opts?.tilt ?? 0);
  ctx.scale(opts?.flipX ? -1 : 1, 1);
  ctx.scale(Math.max(0.65, 1 / squash), squash);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
  return true;
}
