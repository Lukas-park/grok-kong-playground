import { useEffect, useRef, useState } from "react";
import { AdModal } from "@/components/ad-modal";
import { Button } from "@/components/ui/button";
import { BEAN_BALL, CLOVER_ICON, drawSprite, preloadTheme } from "@/lib/assets";
import { sfx, unlockAudio } from "@/lib/audio";
import { usePlayground } from "@/lib/store";
import { THEMES, type ThemeId } from "@/lib/themes";

type Body = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  alive: boolean;
  fallen: boolean;
};

const FRAMES = 5;

function drawPin(
  ctx: CanvasRenderingContext2D,
  p: Body,
) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.fallen ? 1.2 + p.rot * 0.15 : p.rot * 0.04);
  const h = p.r * 3.6;
  const w = p.r * 1.45;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.5);
  ctx.bezierCurveTo(w * 0.36, -h * 0.5, w * 0.4, -h * 0.2, w * 0.26, -h * 0.08);
  ctx.bezierCurveTo(w * 0.58, 0.04 * h, w * 0.6, h * 0.42, 0, h * 0.5);
  ctx.bezierCurveTo(-w * 0.6, h * 0.42, -w * 0.58, 0.04 * h, -w * 0.26, -h * 0.08);
  ctx.bezierCurveTo(-w * 0.4, -h * 0.2, -w * 0.36, -h * 0.5, 0, -h * 0.5);
  ctx.fillStyle = "#fffdf8";
  ctx.fill();
  ctx.strokeStyle = "#d9d0c4";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = "#61ae72";
  ctx.fillRect(-w * 0.22, -h * 0.1, w * 0.44, 5);
  drawSprite(ctx, CLOVER_ICON, 0, -h * 0.28, p.r * 1.55);
  ctx.restore();
}

export function BowlGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"ready" | "play" | "over">("ready");
  const [hud, setHud] = useState({ frame: 1, throwNo: 1, pins: 10, score: 0, message: "" });
  const [adOpen, setAdOpen] = useState(false);
  const bowlBest = usePlayground((s) => s.bowlBest);
  const recordBowl = usePlayground((s) => s.recordBowl);
  const unlockTheme = usePlayground((s) => s.unlockTheme);
  const phaseRef = useRef(phase);
  const [run, setRun] = useState(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    preloadTheme(usePlayground.getState().equippedTheme);

    let w = 390;
    let h = 700;
    const pointer = { x: 0, y: 0, down: false, sx: 0, sy: 0 };
    let acc = 0;
    let last = performance.now();
    let raf = 0;
    let waiting = 0;
    let settling = false;
    let frame = 1;
    let throwNo = 1;
    let score = 0;
    let strikeThisGame = false;
    let trauma = 0;
    let lanePins = 10;

    const ball: Body = { x: 0, y: 0, vx: 0, vy: 0, r: 26, rot: 0, alive: true, fallen: false };
    const pins: Body[] = [];

    function resize() {
      const parent = canvas!.parentElement;
      w = parent?.clientWidth || 390;
      h = parent?.clientHeight || 700;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const laneLeft = () => w * 0.16;
    const laneRight = () => w * 0.84;
    const ballHome = () => ({ x: w / 2, y: h * 0.86 });

    function setupPins() {
      pins.length = 0;
      const rows = [4, 3, 2, 1];
      const backY = h * 0.16;
      const gapY = Math.min(48, h * 0.055);
      const gapX = Math.min(42, w * 0.09);
      rows.forEach((count, row) => {
        const y = backY + row * gapY;
        const rowW = (count - 1) * gapX;
        const scale = 0.86 + row * 0.05;
        for (let c = 0; c < count; c++) {
          pins.push({
            x: w / 2 - rowW / 2 + c * gapX,
            y,
            vx: 0,
            vy: 0,
            r: 13 * scale,
            rot: 0,
            alive: true,
            fallen: false,
          });
        }
      });
      lanePins = 10;
    }

    function resetBall() {
      const home = ballHome();
      ball.x = home.x;
      ball.y = home.y;
      ball.vx = 0;
      ball.vy = 0;
      ball.rot = 0;
      ball.alive = true;
      settling = false;
      waiting = 0;
    }

    function newFrame() {
      setupPins();
      resetBall();
    }

    newFrame();

    function collide(a: Body, b: Body) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const min = a.r + b.r;
      if (dist >= min) return false;
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = min - dist;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rel > 0) {
        const impulse = rel * 0.92;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
      }
      return true;
    }

    function standing() {
      return pins.filter((p) => p.alive && !p.fallen).length;
    }

    function finishThrow() {
      const left = standing();
      const knocked = lanePins - left;
      lanePins = left;
      score += knocked;
      let message = knocked === 0 ? "거터에 가까워요" : `${knocked}개`;
      if (throwNo === 1 && left === 0) {
        message = "스트라이크";
        strikeThisGame = true;
        sfx.strike();
        trauma = 0.7;
        score += 5;
        frame += 1;
        throwNo = 1;
        if (frame > FRAMES) endGame();
        else newFrame();
      } else if (throwNo === 2 || left === 0) {
        if (left === 0) {
          message = "스페어";
          sfx.collect();
          score += 2;
        }
        frame += 1;
        throwNo = 1;
        if (frame > FRAMES) endGame();
        else newFrame();
      } else {
        throwNo = 2;
        resetBall();
      }
      setHud({ frame: Math.min(frame, FRAMES), throwNo, pins: left, score, message });
    }

    function endGame() {
      const earned = Math.max(3, Math.floor(score / 2) + (strikeThisGame ? 8 : 0));
      recordBowl(score, earned);
      setPhase("over");
      if (strikeThisGame) setAdOpen(true);
    }

    function step(dt: number) {
      if (phaseRef.current !== "play") return;
      trauma = Math.max(0, trauma - dt * 2);
      const moving = Math.hypot(ball.vx, ball.vy) > 8 || pins.some((p) => Math.hypot(p.vx, p.vy) > 8);

      if (settling) {
        waiting += dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        const speed = Math.hypot(ball.vx, ball.vy);
        ball.rot += (speed / Math.max(8, ball.r)) * dt;
        ball.vx *= Math.pow(0.985, dt * 60);
        ball.vy *= Math.pow(0.985, dt * 60);
        for (const p of pins) {
          if (!p.alive) continue;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += Math.hypot(p.vx, p.vy) * dt * 0.04;
          p.vx *= Math.pow(0.96, dt * 60);
          p.vy *= Math.pow(0.96, dt * 60);
          if (Math.hypot(p.vx, p.vy) > 40 && !p.fallen) {
            p.fallen = true;
            sfx.pin();
            trauma = Math.min(1, trauma + 0.12);
          }
          if (p.x < laneLeft() - 8 || p.x > laneRight() + 8 || p.y < 40 || p.y > h * 0.72) {
            p.alive = false;
            p.fallen = true;
          }
        }
        if (ball.x < laneLeft() || ball.x > laneRight()) {
          ball.vx *= 0.4;
          ball.x = Math.max(laneLeft(), Math.min(laneRight(), ball.x));
        }
        if (ball.y < 50) {
          ball.vy *= -0.2;
          ball.y = 50;
        }
        for (let i = 0; i < pins.length; i++) {
          for (let j = i + 1; j < pins.length; j++) {
            if (pins[i]!.alive && pins[j]!.alive) collide(pins[i]!, pins[j]!);
          }
          if (pins[i]!.alive) collide(ball, pins[i]!);
        }
        if ((!moving && waiting > 0.55) || waiting > 2.4) finishThrow();
        return;
      }

      if (pointer.down) return;
    }

    function draw() {
      const theme = THEMES[usePlayground.getState().equippedTheme];
      const shake = trauma * trauma;
      ctx!.save();
      ctx!.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake);

      const g = ctx!.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, theme.sky[0]);
      g.addColorStop(1, theme.sky[1]);
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, w, h);

      ctx!.fillStyle = "rgba(90,70,40,0.16)";
      ctx!.beginPath();
      ctx!.moveTo(laneLeft() - 22, h);
      ctx!.lineTo(laneLeft() + 10, 56);
      ctx!.lineTo(laneRight() - 10, 56);
      ctx!.lineTo(laneRight() + 22, h);
      ctx!.closePath();
      ctx!.fill();

      ctx!.fillStyle = theme.paper;
      ctx!.beginPath();
      ctx!.moveTo(laneLeft(), h * 0.94);
      ctx!.lineTo(laneLeft() + 14, 72);
      ctx!.lineTo(laneRight() - 14, 72);
      ctx!.lineTo(laneRight(), h * 0.94);
      ctx!.closePath();
      ctx!.fill();

      ctx!.strokeStyle = theme.accent;
      ctx!.globalAlpha = 0.28;
      ctx!.setLineDash([8, 10]);
      ctx!.beginPath();
      ctx!.moveTo(w / 2, 88);
      ctx!.lineTo(w / 2, h * 0.8);
      ctx!.stroke();
      ctx!.setLineDash([]);
      ctx!.globalAlpha = 1;

      for (const p of pins) {
        if (!p.alive) continue;
        ctx!.globalAlpha = p.fallen ? 0.7 : 1;
        drawPin(ctx!, p);
        ctx!.globalAlpha = 1;
      }

      const ballOk = drawSprite(ctx!, BEAN_BALL, ball.x, ball.y, ball.r * 2.35, {
        tilt: ball.rot,
      });
      if (!ballOk) {
        ctx!.fillStyle = "#61ae72";
        ctx!.beginPath();
        ctx!.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      if (pointer.down && phaseRef.current === "play" && !settling) {
        ctx!.strokeStyle = theme.accent;
        ctx!.lineWidth = 3;
        ctx!.beginPath();
        ctx!.moveTo(ball.x, ball.y);
        const ax = ball.x - (pointer.x - pointer.sx) * 1.4;
        const ay = ball.y - (pointer.y - pointer.sy) * 1.4;
        ctx!.lineTo(ax, ay);
        ctx!.stroke();
        ctx!.fillStyle = theme.accent;
        ctx!.beginPath();
        ctx!.arc(ax, ay, 5, 0, Math.PI * 2);
        ctx!.fill();
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

    function local(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    const onDown = (e: PointerEvent) => {
      if (phaseRef.current !== "play" || settling) return;
      canvas!.setPointerCapture(e.pointerId);
      const p = local(e);
      pointer.down = true;
      pointer.x = pointer.sx = p.x;
      pointer.y = pointer.sy = p.y;
    };
    const onMove = (e: PointerEvent) => {
      if (!pointer.down) return;
      const p = local(e);
      pointer.x = p.x;
      pointer.y = p.y;
    };
    const onUp = (e: PointerEvent) => {
      if (!pointer.down) return;
      pointer.down = false;
      if (phaseRef.current !== "play" || settling) return;
      const p = local(e);
      const pullX = p.x - pointer.sx;
      const pullY = p.y - pointer.sy;
      const power = Math.min(780, Math.hypot(pullX, pullY) * 3.4);
      if (power < 36) return;
      ball.vx = -pullX * 3.4;
      ball.vy = -pullY * 3.4;
      if (ball.vy > -90) ball.vy = -Math.max(180, power * 0.7);
      sfx.roll();
      settling = true;
      waiting = 0;
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [recordBowl, run]);

  const locked = (Object.keys(THEMES) as ThemeId[]).find(
    (id) => !usePlayground.getState().unlockedThemes.includes(id),
  );

  return (
    <div className="absolute inset-0 min-h-0">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" style={{ touchAction: "none" }} />
      {phase === "play" ? (
        <div className="pointer-events-none absolute left-0 right-0 top-2 flex justify-center">
          <div className="rounded-full bg-card/90 px-4 py-1.5 text-xs font-medium tabular-nums shadow-soft">
            {hud.frame}/{FRAMES}프레임 · {hud.throwNo}번째 · {hud.score}점
            {hud.message ? ` · ${hud.message}` : ""}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/25 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center shadow-lift">
            {phase === "ready" ? (
              <>
                <p className="text-sm text-muted-foreground">콩을 뒤로 당겼다 놓으면 데굴데굴 굴러가요</p>
                <h2 className="mt-1 text-2xl font-semibold">데굴데굴 콩볼링</h2>
                <p className="mt-2 text-sm text-muted-foreground">5프레임 · 최고 {bowlBest}점</p>
                <Button
                  className="mt-5 w-full"
                  onClick={() => {
                    unlockAudio();
                    setRun((n) => n + 1);
                    setPhase("play");
                    setHud({ frame: 1, throwNo: 1, pins: 10, score: 0, message: "" });
                  }}
                >
                  굴리기
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">이번 점수</p>
                <h2 className="mt-1 text-3xl font-semibold tabular-nums">{hud.score}점</h2>
                <Button
                  className="mt-5 w-full"
                  onClick={() => {
                    setRun((n) => n + 1);
                    setPhase("play");
                    setHud({ frame: 1, throwNo: 1, pins: 10, score: 0, message: "" });
                  }}
                >
                  다시 굴리기
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      <AdModal
        open={adOpen}
        title="스트라이크 기념 광고"
        reward={locked ? `${THEMES[locked].name} 테마를 받을 수 있어요` : "클로버 20개를 받아요"}
        onClose={() => setAdOpen(false)}
        onComplete={() => {
          if (locked) unlockTheme(locked, "ad");
          else usePlayground.getState().addClovers(20);
          setAdOpen(false);
        }}
      />
    </div>
  );
}
