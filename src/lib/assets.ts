import { THEME_LIST, type Mood, type ThemeId } from "@/lib/themes";

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
  return `/themes/${theme}.jpg`;
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
  img.decoding = "async";
  img.src = src;
  cache.set(src, img);
  return img;
}

export function preloadTheme(theme: ThemeId) {
  getImage(themeBg(theme));
  getImage(CLOVER_ICON);
  (["best", "good", "ok", "bad", "worst"] as Mood[]).forEach((m) => getImage(beanSrc(theme, m)));
}

export function climbBootAssets() {
  return [
    LARVA_SPRITE,
    FLY_SPRITE,
    CLOVER_ICON,
    CLOVER_SPARK,
    beanSrc("sprout", 1),
    beanSrc("sprout", 2),
    beanSrc("sprout", 3),
    beanSrc("sprout", 4),
    beanSrc("sprout", 5),
  ];
}

export function climbAssetList() {
  const srcs = climbBootAssets();
  for (const t of THEME_LIST) {
    if (t.id === "sprout") continue;
    for (let n = 1; n <= 5; n++) srcs.push(beanSrc(t.id, n));
  }
  return srcs;
}

export function bowlAssetList() {
  return [BEAN_BALL, CLOVER_ICON];
}

export function waitForImages(srcs: string[], timeoutMs = 6000) {
  const imgs = srcs.map(getImage);
  return new Promise<void>((resolve) => {
    const start = performance.now();
    const tick = () => {
      const ready = imgs.every((img) => img.complete);
      if (ready || performance.now() - start > timeoutMs) resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  });
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
