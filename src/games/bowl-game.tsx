import { useEffect, useRef, useState } from "react";
import { AdModal } from "@/components/ad-modal";
import { GameBoot } from "@/components/game-boot";
import { Button } from "@/components/ui/button";
import { BEAN_BALL, CLOVER_ICON, bowlAssetList, drawSprite, waitForImages } from "@/lib/assets";
import { sfx, unlockAudio } from "@/lib/audio";
import { usePlayground } from "@/lib/store";
import { THEMES, type ThemeId } from "@/lib/themes";

type Body = {
  x: number;
  y: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  alive: boolean;
  fallen: boolean;
};

type Pad = { x: number; y: number; w: number; h: number; kind: "slow" | "fast" };

const FRAMES = 5;
const LAYOUTS = ["기본 삼각", "두 덩이", "흩어진 핀", "벽 앵글", "지그재그", "난장판"];

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
  const [hud, setHud] = useState({
    frame: 1,
    throwNo: 1,
    pins: 10,
    score: 0,
    message: "",
    bonus: 0,
    layout: LAYOUTS[0],
  });
  const [adOpen, setAdOpen] = useState(false);
  const bowlBest = usePlayground((s) => s.bowlBest);
  const recordBowl = usePlayground((s) => s.recordBowl);
  const unlockTheme = usePlayground((s) => s.unlockTheme);
  const phaseRef = useRef(phase);
  const [run, setRun] = useState(0);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    let live = true;
    waitForImages(bowlAssetList()).then(() => {
      if (live) setBooted(true);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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
    let bonusShots = 0;
    let strikeThisGame = false;
    let trauma = 0;
    let lanePins = 10;
    let chaos = 0;
    let layoutName = LAYOUTS[0]!;
    const pads: Pad[] = [];

    const ball: Body = { x: 0, y: 0, ox: 0, oy: 0, vx: 0, vy: 0, r: 26, rot: 0, alive: true, fallen: false };
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

    function addPin(x: number, y: number, scale = 1) {
      pins.push({
        x,
        y,
        ox: x,
        oy: y,
        vx: 0,
        vy: 0,
        r: 13 * scale,
        rot: 0,
        alive: true,
        fallen: false,
      });
    }

    function scatterPins(count: number, y0: number, y1: number, inset = 26) {
      const placed: { x: number; y: number }[] = [];
      let guard = 0;
      while (placed.length < count && guard++ < 240) {
        const x = laneLeft() + inset + Math.random() * (laneRight() - laneLeft() - inset * 2);
        const y = y0 + Math.random() * (y1 - y0);
        if (placed.every((q) => Math.hypot(q.x - x, q.y - y) > 34)) placed.push({ x, y });
      }
      placed.forEach((q) => addPin(q.x, q.y, 0.92 + Math.random() * 0.12));
    }

    function setupPins() {
      pins.length = 0;
      pads.length = 0;
      const tier = Math.min(5, chaos);
      layoutName = LAYOUTS[tier] ?? "난장판";
      const left = laneLeft() + 30;
      const right = laneRight() - 30;
      const top = h * 0.15;
      const mid = h * 0.26;
      const low = h * 0.36;

      if (tier === 0) {
        const rows = [4, 3, 2, 1];
        const gapY = Math.min(48, h * 0.055);
        const gapX = Math.min(42, w * 0.09);
        rows.forEach((count, row) => {
          const y = top + row * gapY;
          const rowW = (count - 1) * gapX;
          for (let c = 0; c < count; c++) {
            addPin(w / 2 - rowW / 2 + c * gapX, y, 0.86 + row * 0.05);
          }
        });
      } else if (tier === 1) {
        for (let i = 0; i < 4; i++) addPin(left + 10 + (i % 2) * 28, top + Math.floor(i / 2) * 40, 0.95);
        for (let i = 0; i < 6; i++) addPin(right - 10 - (i % 3) * 28, top + Math.floor(i / 3) * 42, 0.95);
      } else if (tier === 2) {
        scatterPins(10, top, low);
      } else if (tier === 3) {
        for (let i = 0; i < 5; i++) addPin(left + 6, top + i * 38, 0.96);
        for (let i = 0; i < 5; i++) addPin(right - 6, top + 18 + i * 38, 0.96);
      } else if (tier === 4) {
        for (let i = 0; i < 10; i++) {
          const y = top + i * 22;
          addPin(i % 2 === 0 ? left + 18 : right - 18, y, 0.94);
        }
      } else {
        scatterPins(10, top, h * 0.48, 18);
      }

      if (tier >= 1) pads.push({ x: w * 0.26, y: h * 0.5, w: w * 0.22, h: 32, kind: "slow" });
      if (tier >= 2) pads.push({ x: w * 0.52, y: h * 0.6, w: w * 0.2, h: 30, kind: "fast" });
      if (tier >= 3) pads.push({ x: w * 0.33, y: h * 0.42, w: w * 0.18, h: 26, kind: "slow" });
      if (tier >= 4) pads.push({ x: w * 0.22, y: h * 0.7, w: w * 0.2, h: 26, kind: "fast" });
      lanePins = pins.length;
    }

    function bounceWall(body: Body, rest: number) {
      const t = Math.max(0, Math.min(1, (body.y - 64) / Math.max(1, h * 0.9 - 64)));
      const leftX = laneLeft() + 12 * (1 - t);
      const rightX = laneRight() - 12 * (1 - t);
      if (body.x - body.r < leftX) {
        body.x = leftX + body.r;
        body.vx = Math.abs(body.vx) * rest;
      } else if (body.x + body.r > rightX) {
        body.x = rightX - body.r;
        body.vx = -Math.abs(body.vx) * rest;
      }
    }

    function applyPads(dt: number) {
      for (const pad of pads) {
        if (ball.x < pad.x || ball.x > pad.x + pad.w || ball.y < pad.y || ball.y > pad.y + pad.h) continue;
        const speed = Math.hypot(ball.vx, ball.vy);
        if (pad.kind === "slow") {
          ball.vx *= Math.pow(0.9, dt * 60);
          ball.vy *= Math.pow(0.9, dt * 60);
        } else if (speed < 980) {
          const f = Math.pow(1.05, dt * 60);
          ball.vx *= f;
          ball.vy *= f;
        }
      }
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

    function clearFallenPins() {
      for (const p of pins) {
        if (p.fallen) p.alive = false;
      }
    }

    function finishThrow() {
      const left = standing();
      const knocked = lanePins - left;
      lanePins = left;
      const doubled = bonusShots > 0;
      if (bonusShots > 0) bonusShots -= 1;
      const gained = knocked * (doubled ? 2 : 1);
      score += gained;
      clearFallenPins();

      let message = knocked === 0 ? "거터예요" : doubled ? `2배 ${gained}점` : `${gained}점`;
      if (throwNo === 1 && left === 0) {
        message = doubled ? "스트라이크 · 2배" : "스트라이크";
        strikeThisGame = true;
        bonusShots += 2;
        sfx.strike();
        trauma = 0.7;
        frame += 1;
        throwNo = 1;
        chaos += 1;
        if (frame > FRAMES) endGame();
        else newFrame();
      } else if (throwNo === 2 || left === 0) {
        if (left === 0) {
          message = doubled ? "스페어 · 2배" : "스페어";
          bonusShots += 1;
          sfx.collect();
          chaos += 1;
        }
        frame += 1;
        throwNo = 1;
        if (frame > FRAMES) endGame();
        else newFrame();
      } else {
        throwNo = 2;
        resetBall();
      }
      setHud({
        frame: Math.min(frame, FRAMES),
        throwNo,
        pins: left,
        score,
        message,
        bonus: bonusShots,
        layout: layoutName,
      });
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
        ball.vx *= Math.pow(0.988, dt * 60);
        ball.vy *= Math.pow(0.988, dt * 60);
        applyPads(dt);
        bounceWall(ball, 0.9);
        if (ball.y < 48) {
          ball.vy = Math.abs(ball.vy) * 0.72;
          ball.y = 48;
        }
        for (const p of pins) {
          if (!p.alive) continue;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += Math.hypot(p.vx, p.vy) * dt * 0.04;
          p.vx *= Math.pow(0.96, dt * 60);
          p.vy *= Math.pow(0.96, dt * 60);
          bounceWall(p, 0.72);
          if (!p.fallen && (Math.hypot(p.x - p.ox, p.y - p.oy) > 22 || Math.hypot(p.vx, p.vy) > 120)) {
            p.fallen = true;
            sfx.pin();
            trauma = Math.min(1, trauma + 0.12);
          }
          if (p.y < 28 || p.y > h * 0.78) {
            p.alive = false;
            p.fallen = true;
          }
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

      ctx!.fillStyle = "#8a6a48";
      ctx!.beginPath();
      ctx!.moveTo(laneLeft() - 10, h * 0.94);
      ctx!.lineTo(laneLeft() + 8, 72);
      ctx!.lineTo(laneLeft() + 18, 72);
      ctx!.lineTo(laneLeft() + 6, h * 0.94);
      ctx!.closePath();
      ctx!.fill();
      ctx!.beginPath();
      ctx!.moveTo(laneRight() + 10, h * 0.94);
      ctx!.lineTo(laneRight() - 8, 72);
      ctx!.lineTo(laneRight() - 18, 72);
      ctx!.lineTo(laneRight() - 6, h * 0.94);
      ctx!.closePath();
      ctx!.fill();

      for (const pad of pads) {
        ctx!.fillStyle = pad.kind === "slow" ? "rgba(74, 130, 186, 0.38)" : "rgba(224, 122, 48, 0.4)";
        ctx!.beginPath();
        ctx!.roundRect?.(pad.x, pad.y, pad.w, pad.h, 10);
        if (!ctx!.roundRect) ctx!.rect(pad.x, pad.y, pad.w, pad.h);
        ctx!.fill();
        ctx!.fillStyle = pad.kind === "slow" ? "#2f4a28" : "#7a3b12";
        ctx!.font = "700 11px 'Noto Sans KR', sans-serif";
        ctx!.textAlign = "center";
        ctx!.fillText(pad.kind === "slow" ? "SLOW" : "FAST", pad.x + pad.w / 2, pad.y + pad.h / 2 + 4);
        ctx!.textAlign = "start";
      }

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
      <GameBoot ready={booted} label="레인을 닦는 중" />
      {phase === "play" ? (
        <div className="pointer-events-none absolute left-0 right-0 top-2 flex justify-center">
          <div className="rounded-full bg-card/90 px-4 py-1.5 text-xs font-medium tabular-nums shadow-soft">
            {hud.frame}/{FRAMES}프레임 · {hud.layout} · {hud.throwNo}번째 · {hud.score}점
            {hud.bonus > 0 ? ` · 다음 ${hud.bonus}투 2배` : ""}
            {hud.message ? ` · ${hud.message}` : ""}
          </div>
        </div>
      ) : booted ? (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/25 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center shadow-lift">
            {phase === "ready" ? (
              <>
                <p className="text-sm text-muted-foreground">콩을 뒤로 당겼다 놓으면 데굴데굴 굴러가요</p>
                <h2 className="mt-1 text-2xl font-semibold">데굴데굴 콩볼링</h2>
                <p className="text-sm text-muted-foreground">스트라이크·스페어 다음엔 핀이 흩어지고, 벽에 튕길 수 있어요</p>
                <Button
                  className="mt-5 w-full"
                  onClick={() => {
                    unlockAudio();
                    setRun((n) => n + 1);
                    setPhase("play");
                    setHud({ frame: 1, throwNo: 1, pins: 10, score: 0, message: "", bonus: 0, layout: LAYOUTS[0]! });
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
                    setHud({ frame: 1, throwNo: 1, pins: 10, score: 0, message: "", bonus: 0, layout: LAYOUTS[0]! });
                  }}
                >
                  다시 굴리기
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
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
