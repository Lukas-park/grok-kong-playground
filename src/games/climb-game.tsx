import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { beanSrc, CLOVER_ICON, CLOVER_SPARK, drawSprite, preloadTheme } from "@/lib/assets";
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

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  clover?: boolean;
};

type Floater = { x: number; y: number; life: number; text: string };

const JUMP = 620;
const SPRING = 920;
const GRAVITY = 1480;
const DOUBLE_CD = 3;

export function ClimbGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"ready" | "play" | "over">("ready");
  const [height, setHeight] = useState(0);
  const [runClovers, setRunClovers] = useState(0);
  const [jumpCd, setJumpCd] = useState(0);
  const [run, setRun] = useState(0);
  const equipped = usePlayground((s) => s.equippedTheme);
  const climbBest = usePlayground((s) => s.climbBest);
  const recordClimb = usePlayground((s) => s.recordClimb);
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

    const pointer = { x: 0, active: false, tap: false };
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
    let extraCd = 0;
    let groundedUntil = 0;
    let hops = 0;
    let hudTick = 0;
    const particles: Particle[] = [];
    const floaters: Floater[] = [];
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
      floaters.length = 0;
      player.x = w / 2;
      player.y = 90;
      player.vx = 0;
      player.vy = 0;
      player.squash = 1;
      cameraY = 0;
      maxY = 0;
      earned = 0;
      extraCd = 0;
      groundedUntil = 0;
      hops = 0;
      trauma = 0;
      plats.push({ x: w / 2, y: 40, w: 88, kind: "leaf" });
      let y = 140;
      while (y < 5200) {
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

    function spawnBurst(x: number, y: number, color: string, n = 10, clover = false) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 80 + Math.random() * 220;
        particles.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s + 40,
          life: 0.45 + Math.random() * 0.55,
          color,
          size: clover ? 10 + Math.random() * 8 : 2 + Math.random() * 4,
          clover,
        });
      }
    }

    function fireworks(x: number, y: number, label: string) {
      const theme = THEMES[usePlayground.getState().equippedTheme];
      spawnBurst(x, y, theme.accent, 18, false);
      spawnBurst(x, y, "#f4efe4", 10, false);
      spawnBurst(x, y, theme.leaf, 8, true);
      floaters.push({ x, y: y + 24, life: 1.1, text: label });
    }

    function grantPod(worldX: number, worldY: number) {
      const store = usePlayground.getState();
      const locked = (Object.keys(THEMES) as ThemeId[]).find((id) => !store.unlockedThemes.includes(id));
      if (locked) {
        store.unlockTheme(locked, "ad");
        fireworks(worldX, worldY, THEMES[locked].name);
        sfx.unlock();
      } else {
        store.addClovers(12);
        earned += 12;
        setRunClovers(earned);
        fireworks(worldX, worldY, "클로버 +12");
        sfx.collect();
      }
    }

    function tryDoubleJump() {
      if (phaseRef.current !== "play") return;
      if (extraCd > 0) return;
      if (hops < 1) return;
      if (groundedUntil > 0) return;
      player.vy = Math.max(player.vy, 0) + JUMP * 0.92;
      player.squash = 0.78;
      extraCd = DOUBLE_CD;
      sfx.jump();
      spawnBurst(player.x, player.y, THEMES[usePlayground.getState().equippedTheme].accent, 12);
    }

    function step(dt: number) {
      if (phaseRef.current !== "play") return;
      const theme = THEMES[usePlayground.getState().equippedTheme];
      extraCd = Math.max(0, extraCd - dt);
      groundedUntil = Math.max(0, groundedUntil - dt);
      hudTick += dt;
      if (hudTick > 0.08) {
        hudTick = 0;
        setJumpCd(extraCd);
      }

      if (pointer.tap) {
        pointer.tap = false;
        tryDoubleJump();
      }

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
          groundedUntil = 0.12;
          hops += 1;
          trauma = Math.min(1, trauma + (p.kind === "giant" ? 0.45 : 0.12));
          sfx.land();
          spawnBurst(player.x, player.y, theme.leaf, 8);
          if (p.kind === "clover") {
            p.taken = true;
            earned += 2;
            sfx.collect();
            setRunClovers(earned);
            fireworks(player.x, player.y + 20, "클로버 +2");
          }
          if (p.kind === "pod") {
            p.taken = true;
            grantPod(player.x, player.y + 24);
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
        pt.vy -= 80 * dt;
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i]!.life <= 0) particles.splice(i, 1);
      }
      for (const f of floaters) {
        f.life -= dt;
        f.y += 40 * dt;
      }
      for (let i = floaters.length - 1; i >= 0; i--) {
        if (floaters[i]!.life <= 0) floaters.splice(i, 1);
      }

      setHeight(Math.floor(maxY / 10));

      if (player.y < cameraY - 40) {
        sfx.fall();
        recordClimb(Math.floor(maxY / 10), earned);
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
          if (!drawSprite(ctx!, CLOVER_SPARK, p.x, sy - 26, 32)) {
            ctx!.fillStyle = theme.bean;
            ctx!.beginPath();
            ctx!.ellipse(p.x, sy - 26, 12, 16, 0, 0, Math.PI * 2);
            ctx!.fill();
          }
        }
      }

      for (const pt of particles) {
        ctx!.globalAlpha = Math.max(0, pt.life * 1.8);
        if (pt.clover) {
          drawSprite(ctx!, CLOVER_ICON, pt.x, toScreen(pt.y), pt.size);
        } else {
          ctx!.fillStyle = pt.color;
          ctx!.beginPath();
          ctx!.arc(pt.x, toScreen(pt.y), pt.size, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.globalAlpha = 1;
      }

      ctx!.font = "700 14px 'Noto Sans KR', sans-serif";
      ctx!.textAlign = "center";
      for (const f of floaters) {
        ctx!.globalAlpha = Math.max(0, f.life);
        ctx!.fillStyle = theme.ink;
        ctx!.fillText(f.text, f.x, toScreen(f.y));
        ctx!.globalAlpha = 1;
      }
      ctx!.textAlign = "start";

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
      pointer.tap = true;
    };
    const onMove = (e: PointerEvent) => setPointer(e, pointer.active);
    const onUp = (e: PointerEvent) => setPointer(e, false);
    const onKey = (e: KeyboardEvent) => {
      if (phaseRef.current !== "play") return;
      if (e.code === "ArrowLeft" || e.code === "KeyA") player.x -= 24;
      if (e.code === "ArrowRight" || e.code === "KeyD") player.x += 24;
      if (e.code === "Space") {
        e.preventDefault();
        tryDoubleJump();
      }
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

  return (
    <div className="absolute inset-0 min-h-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        style={{ touchAction: "none" }}
      />
      {phase === "play" ? (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex flex-col items-center gap-1.5">
          <div className="rounded-full bg-card/90 px-4 py-1.5 text-xs font-medium tabular-nums shadow-soft">
            {height} m · 클로버 +{runClovers}
          </div>
          <div className="rounded-full bg-card/80 px-3 py-1 text-[11px] font-medium tabular-nums text-muted-foreground shadow-soft">
            {jumpCd <= 0 ? "탭하면 더블점프" : `더블점프 ${jumpCd.toFixed(1)}초`}
          </div>
        </div>
      ) : null}
      {phase !== "play" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/25 px-6 text-center">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-lift">
            {phase === "ready" ? (
              <>
                <p className="text-sm text-muted-foreground">좌우로 밀고, 공중에서 탭하면 한 번 더 뛰어요</p>
                <h2 className="mt-1 text-2xl font-semibold">잎을 밟고 올라가요</h2>
                <p className="mt-2 text-sm text-muted-foreground">최고 {climbBest} m</p>
                <Button
                  className="mt-5 w-full"
                  onClick={() => {
                    unlockAudio();
                    setRun((n) => n + 1);
                    setRunClovers(0);
                    setHeight(0);
                    setJumpCd(0);
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
                <Button
                  className="mt-5 w-full"
                  onClick={() => {
                    setRun((n) => n + 1);
                    setPhase("play");
                  }}
                >
                  다시 오르기
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
