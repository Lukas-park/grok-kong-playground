import { useEffect, useRef, useState } from "react";
import { AdModal } from "@/components/ad-modal";
import { Button } from "@/components/ui/button";
import { beanSrc, CLOVER_ICON, drawSprite, preloadTheme } from "@/lib/assets";
import { sfx, unlockAudio } from "@/lib/audio";
import { drawBean, drawClover } from "@/lib/draw-bean";
import { usePlayground } from "@/lib/store";
import { THEMES, type Mood, type ThemeId } from "@/lib/themes";

type Plat = {
  x: number;
  y: number;
  w: number;
  kind: "leaf" | "spring" | "clover" | "pod" | "giant";
  taken?: boolean;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

const JUMP = 620;
const SPRING = 920;
const GRAVITY = 1480;

export function ClimbGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"ready" | "play" | "over">("ready");
  const [height, setHeight] = useState(0);
  const [runClovers, setRunClovers] = useState(0);
  const [podOffer, setPodOffer] = useState(false);
  const [run, setRun] = useState(0);
  const equipped = usePlayground((s) => s.equippedTheme);
  const climbBest = usePlayground((s) => s.climbBest);
  const recordClimb = usePlayground((s) => s.recordClimb);
  const unlockTheme = usePlayground((s) => s.unlockTheme);
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    preloadTheme(equipped);

    const pointer = { x: 0, active: false };
    let w = 390;
    let h = 700;
    let dpr = 1;
    let acc = 0;
    let last = performance.now();
    let raf = 0;
    let trauma = 0;
    let cameraY = 0;
    let maxY = 0;
    let earned = 0;
    let podFound = false;
    const particles: Particle[] = [];
    const plats: Plat[] = [];

    const player = {
      x: 195,
      y: 80,
      vx: 0,
      vy: 0,
      squash: 1,
      mood: "good" as Mood,
    };

    function resize() {
      const parent = canvas!.parentElement;
      w = parent?.clientWidth || 390;
      h = parent?.clientHeight || 700;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    function resetWorld() {
      plats.length = 0;
      particles.length = 0;
      player.x = w / 2;
      player.y = 90;
      player.vx = 0;
      player.vy = 0;
      player.squash = 1;
      cameraY = 0;
      maxY = 0;
      earned = 0;
      podFound = false;
      trauma = 0;
      plats.push({ x: w / 2, y: 40, w: 88, kind: "leaf" });
      let y = 140;
      while (y < 4200) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = w / 2 + side * (40 + Math.random() * Math.min(110, w * 0.28));
        let kind: Plat["kind"] = "leaf";
        const roll = Math.random();
        if (y > 900 && y < 1100 && !plats.some((p) => p.kind === "giant")) kind = "giant";
        else if (roll < 0.08) kind = "clover";
        else if (roll < 0.14) kind = "spring";
        else if (roll < 0.18 && y > 500) kind = "pod";
        plats.push({ x, y, w: kind === "giant" ? 150 : 74 + Math.random() * 18, kind });
        y += 78 + Math.random() * 42;
      }
    }
    resetWorld();

    function toScreen(y: number) {
      return h - (y - cameraY);
    }

    function spawnBurst(x: number, y: number, color: string, n = 10) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 40 + Math.random() * 120;
        particles.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 0.45 + Math.random() * 0.3,
          color,
        });
      }
    }

    function step(dt: number) {
      if (phaseRef.current !== "play") return;
      const theme = THEMES[usePlayground.getState().equippedTheme];

      if (pointer.active) {
        const target = pointer.x;
        player.x += (target - player.x) * (1 - Math.exp(-10 * dt));
      }
      player.x = Math.max(28, Math.min(w - 28, player.x));
      player.vy -= GRAVITY * dt;
      player.y += player.vy * dt;
      player.squash += (1 - player.squash) * (1 - Math.exp(-12 * dt));

      if (player.vy < 0) {
        for (const p of plats) {
          if (p.taken) continue;
          const py = p.y;
          const half = p.w / 2;
          if (Math.abs(player.x - p.x) > half + 8) continue;
          if (player.y > py + 18 || player.y < py - 10) continue;
          player.y = py + 16;
          player.vy = p.kind === "spring" || p.kind === "giant" ? SPRING : JUMP;
          player.squash = 0.72;
          trauma = Math.min(1, trauma + (p.kind === "giant" ? 0.45 : 0.12));
          sfx.land();
          spawnBurst(player.x, player.y, theme.leaf, 8);
          if (p.kind === "clover") {
            p.taken = true;
            earned += 2;
            sfx.collect();
            setRunClovers(earned);
          }
          if (p.kind === "pod" && !podFound) {
            p.taken = true;
            podFound = true;
            sfx.collect();
            setPodOffer(true);
          }
          if (p.kind === "giant") sfx.strike();
        }
      }

      maxY = Math.max(maxY, player.y);
      const desired = Math.max(0, player.y - h * 0.38);
      cameraY += (desired - cameraY) * (1 - Math.exp(-6 * dt));
      trauma = Math.max(0, trauma - dt * 1.8);

      for (const pt of particles) {
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy -= 40 * dt;
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i]!.life <= 0) particles.splice(i, 1);
      }

      const meters = Math.floor(maxY / 10);
      setHeight(meters);

      if (player.y < cameraY - 40) {
        sfx.fall();
        recordClimb(meters, earned);
        setPhase("over");
      }
    }

    function draw() {
      const theme = THEMES[usePlayground.getState().equippedTheme];
      const shake = trauma * trauma;
      const ox = (Math.random() - 0.5) * 12 * shake;
      const oy = (Math.random() - 0.5) * 12 * shake;
      ctx!.save();
      ctx!.translate(ox, oy);

      const g = ctx!.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, theme.sky[0]);
      g.addColorStop(1, theme.sky[1]);
      ctx!.fillStyle = g;
      ctx!.fillRect(-20, -20, w + 40, h + 40);

      ctx!.strokeStyle = theme.stalk;
      ctx!.lineWidth = 22;
      ctx!.lineCap = "round";
      ctx!.beginPath();
      const stalkX = w / 2;
      for (let y = cameraY - 40; y < cameraY + h + 80; y += 18) {
        const sx = stalkX + Math.sin(y / 70) * 10;
        const sy = toScreen(y);
        if (y === cameraY - 40) ctx!.moveTo(sx, sy);
        else ctx!.lineTo(sx, sy);
      }
      ctx!.stroke();
      ctx!.strokeStyle = theme.leaf;
      ctx!.lineWidth = 8;
      ctx!.stroke();

      for (const p of plats) {
        const sy = toScreen(p.y);
        if (sy < -80 || sy > h + 80) continue;
        if (p.kind === "giant") {
          const tId = usePlayground.getState().equippedTheme;
          const ok = drawSprite(ctx!, beanSrc(tId, "ok"), p.x, sy - 40, 110, { squash: 0.9 });
          if (!ok) drawBean(ctx!, p.x, sy - 48, 56, "ok", { blush: true, squash: 0.9 });
          ctx!.fillStyle = theme.leaf;
          ctx!.beginPath();
          ctx!.ellipse(p.x, sy + 8, p.w / 2, 14, 0, 0, Math.PI * 2);
          ctx!.fill();
          continue;
        }
        ctx!.fillStyle = theme.leaf;
        ctx!.beginPath();
        ctx!.ellipse(p.x, sy, p.w / 2, 13, 0.2, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.strokeStyle = "rgba(255,255,255,0.25)";
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        ctx!.moveTo(p.x - p.w / 3, sy);
        ctx!.quadraticCurveTo(p.x, sy + 6, p.x + p.w / 3, sy);
        ctx!.stroke();
        if (p.kind === "spring") {
          ctx!.fillStyle = theme.accent;
          ctx!.fillRect(p.x - 8, sy - 10, 16, 8);
        }
        if (p.kind === "clover" && !p.taken) {
          if (!drawSprite(ctx!, CLOVER_ICON, p.x, sy - 22, 26)) drawClover(ctx!, p.x, sy - 22, 12);
        }
        if (p.kind === "pod" && !p.taken) {
          ctx!.fillStyle = theme.bean;
          ctx!.beginPath();
          ctx!.ellipse(p.x, sy - 26, 12, 16, 0, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      for (const pt of particles) {
        ctx!.globalAlpha = Math.max(0, pt.life * 2);
        ctx!.fillStyle = pt.color;
        ctx!.beginPath();
        ctx!.arc(pt.x, toScreen(pt.y), 3, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.globalAlpha = 1;
      }

      const tilt = Math.max(-0.35, Math.min(0.35, (pointer.x - player.x) / 180));
      const tId = usePlayground.getState().equippedTheme;
      const drawn = drawSprite(ctx!, beanSrc(tId, player.mood), player.x, toScreen(player.y), 48, {
        squash: player.squash,
        tilt,
      });
      if (!drawn) {
        drawBean(ctx!, player.x, toScreen(player.y), 22, player.mood, {
          squash: player.squash,
          tilt,
        });
      }

      ctx!.restore();
    }

    function loop(now: number) {
      const raw = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += raw;
      const stepDt = 1 / 60;
      while (acc >= stepDt) {
        step(stepDt);
        acc -= stepDt;
      }
      draw();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    function setPointer(e: PointerEvent, active: boolean) {
      const rect = canvas!.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.active = active;
    }
    const onDown = (e: PointerEvent) => {
      canvas!.setPointerCapture(e.pointerId);
      setPointer(e, true);
      if (phaseRef.current === "play") sfx.jump();
    };
    const onMove = (e: PointerEvent) => setPointer(e, pointer.active);
    const onUp = (e: PointerEvent) => setPointer(e, false);
    const onKey = (e: KeyboardEvent) => {
      if (phaseRef.current !== "play") return;
      if (e.code === "ArrowLeft" || e.code === "KeyA") player.x -= 24;
      if (e.code === "ArrowRight" || e.code === "KeyD") player.x += 24;
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [recordClimb, run, equipped]);

  const locked = Object.keys(THEMES).find(
    (id) => !usePlayground.getState().unlockedThemes.includes(id as ThemeId),
  ) as ThemeId | undefined;

  return (
    <div className="relative h-full min-h-0">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        style={{ touchAction: "none" }}
      />
      {phase === "play" ? (
        <div className="pointer-events-none absolute left-0 right-0 top-2 flex justify-center">
          <div className="rounded-full bg-card/90 px-4 py-1.5 text-xs font-medium tabular-nums shadow-soft">
            {height} m · 클로버 +{runClovers}
          </div>
        </div>
      ) : null}
      {phase !== "play" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/25 px-6 text-center">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-lift">
            {phase === "ready" ? (
              <>
                <p className="text-sm text-muted-foreground">손가락을 좌우로 밀어 콩을 옮겨요</p>
                <h2 className="mt-1 text-2xl font-semibold">잎을 밟고 올라가요</h2>
                <p className="mt-2 text-sm text-muted-foreground">최고 {climbBest} m</p>
                <Button
                  className="mt-5 w-full"
                  onClick={() => {
                    unlockAudio();
                    setRun((n) => n + 1);
                    setRunClovers(0);
                    setHeight(0);
                    setPhase("play");
                  }}
                >
                  올라가기
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">이번 높이</p>
                <h2 className="mt-1 text-3xl font-semibold tabular-nums">{height} m</h2>
                <p className="mt-2 text-sm text-muted-foreground">클로버 +{runClovers}</p>
                <Button className="mt-5 w-full" onClick={() => { setRun((n) => n + 1); setPhase("play"); }}>
                  다시 오르기
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
      <AdModal
        open={podOffer}
        title="테마 열매를 땄어요"
        reward={locked ? `${THEMES[locked].name} 테마를 받을 수 있어요` : "클로버 20개를 받아요"}
        onClose={() => setPodOffer(false)}
        onComplete={() => {
          if (locked) unlockTheme(locked, "ad");
          else usePlayground.getState().addClovers(20);
          setPodOffer(false);
        }}
      />
    </div>
  );
}
