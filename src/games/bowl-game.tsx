import { useEffect, useRef, useState } from "react";
import { AdModal } from "@/components/ad-modal";
import { GameBoot } from "@/components/game-boot";
import { Button } from "@/components/ui/button";
import { BEAN_BALL, CLOVER_ICON, CLOVER_SPARK, bowlAssetList, drawSprite, waitForImages } from "@/lib/assets";
import { sfx, unlockAudio } from "@/lib/audio";
import {
  BOWL_STAGES,
  FIRST_STAGE,
  buildStage,
  mulberry,
  nextLockedStage,
  stageById,
  type StageId,
} from "@/lib/bowl-stages";
import { usePlayground } from "@/lib/store";
import { THEMES, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";

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
  key?: boolean;
};

type Pad = { x: number; y: number; w: number; h: number; kind: "slow" | "fast" };

const FRAMES = 8;

function drawPin(ctx: CanvasRenderingContext2D, p: Body) {
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
  ctx.fillStyle = p.key ? "#f3d36b" : "#fffdf8";
  ctx.fill();
  ctx.strokeStyle = p.key ? "#d9a441" : "#d9d0c4";
  ctx.lineWidth = p.key ? 2.2 : 1.6;
  ctx.stroke();
  ctx.fillStyle = p.key ? "#c45c28" : "#61ae72";
  ctx.fillRect(-w * 0.22, -h * 0.1, w * 0.44, 5);
  drawSprite(ctx, p.key ? CLOVER_SPARK : CLOVER_ICON, 0, -h * 0.28, p.r * 1.55);
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
    layout: stageById(FIRST_STAGE).name,
    key: false,
    unlocked: "",
  });
  const [adOpen, setAdOpen] = useState(false);
  const bowlBest = usePlayground((s) => s.bowlBest);
  const bowlUnlocked = usePlayground((s) => s.bowlUnlocked);
  const bowlStage = usePlayground((s) => s.bowlStage);
  const selectBowlStage = usePlayground((s) => s.selectBowlStage);
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
    let stageId: StageId = usePlayground.getState().bowlStage;
    let pendingStage: StageId | null = null;
    let keyClaimed = false;
    let remix = false;
    let layoutName = stageById(stageId).name;
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
        key: false,
      });
    }

    function setupPins() {
      pins.length = 0;
      pads.length = 0;
      keyClaimed = false;
      const rng = mulberry(frame * 7919 + run * 104729 + (remix ? 333 : 0) + Math.floor(w * h) % 97);
      const built = buildStage(stageId, { w, h, left: laneLeft(), right: laneRight() }, rng);
      layoutName = stageById(stageId).name;
      built.pins.forEach((p) => addPin(p.x, p.y, p.scale ?? 1));
      pads.push(...built.pads);
      if (pins.length) {
        const far = [...pins].sort((a, b) => a.y - b.y);
        const pick = far[Math.min(far.length - 1, 1 + Math.floor(rng() * Math.min(4, far.length)))];
        if (pick) pick.key = true;
      }
      if (remix) {
        pads.push({
          x: w * (0.25 + rng() * 0.3),
          y: h * (0.45 + rng() * 0.2),
          w: w * 0.18,
          h: 24,
          kind: rng() > 0.5 ? "fast" : "slow",
        });
      }
      lanePins = pins.length;
    }

    function claimKey() {
      if (keyClaimed) return;
      const keyPin = pins.find((p) => p.key);
      if (!keyPin || !(keyPin.fallen || !keyPin.alive)) return;
      keyClaimed = true;
      const store = usePlayground.getState();
      const next = nextLockedStage(store.bowlUnlocked);
      if (next) {
        store.unlockBowlStage(next);
        pendingStage = next;
        sfx.unlock();
        trauma = Math.min(1, trauma + 0.4);
      } else {
        remix = true;
        pendingStage = stageId;
        sfx.collect();
      }
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
      if (pendingStage) {
        stageId = pendingStage;
        pendingStage = null;
      }
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
      const nextName = pendingStage ? stageById(pendingStage).name : "";
      if (keyClaimed && nextName) message = `해금! ${nextName}`;
      if (throwNo === 1 && left === 0) {
        message = keyClaimed && nextName ? `스트라이크 · ${nextName}` : doubled ? "스트라이크 · 2배" : "스트라이크";
        strikeThisGame = true;
        bonusShots += 2;
        sfx.strike();
        trauma = 0.7;
        frame += 1;
        throwNo = 1;
        if (frame > FRAMES) endGame();
        else newFrame();
      } else if (throwNo === 2 || left === 0) {
        if (left === 0) {
          message = keyClaimed && nextName ? `스페어 · ${nextName}` : doubled ? "스페어 · 2배" : "스페어";
          bonusShots += 1;
          sfx.collect();
        }
        frame += 1;
        throwNo = 1;
        if (frame > FRAMES) endGame();
        else newFrame();
      } else {
        throwNo = 2;
        resetBall();
      }
      const locked = nextLockedStage(usePlayground.getState().bowlUnlocked);
      setHud({
        frame: Math.min(frame, FRAMES),
        throwNo,
        pins: left,
        score,
        message,
        bonus: bonusShots,
        layout: layoutName,
        key: pins.some((p) => p.key && p.alive && !p.fallen),
        unlocked: locked ? `노란 핀 → ${stageById(locked).name}` : remix ? "변주 레인" : "",
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
            if (p.key) claimKey();
          }
          if (p.y < 28 || p.y > h * 0.78) {
            p.alive = false;
            p.fallen = true;
            if (p.key) claimKey();
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
          <div className="max-w-[92%] rounded-full bg-card/90 px-4 py-1.5 text-center text-xs font-medium tabular-nums shadow-soft">
            {hud.frame}/{FRAMES}세트 · {hud.layout} · {hud.score}점
            {hud.bonus > 0 ? ` · 다음 ${hud.bonus}투 2배` : ""}
            {hud.message ? ` · ${hud.message}` : ""}
          </div>
        </div>
      ) : booted ? (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/25 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center shadow-lift">
            {phase === "ready" ? (
              <>
                <p className="text-sm text-muted-foreground">노란 열쇠 핀을 쓰러뜨리면 다음 세트가 열려요</p>
                <h2 className="mt-1 text-2xl font-semibold">데굴데굴 콩볼링</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {bowlUnlocked.length}/{BOWL_STAGES.length}스테이지 · 최고 {bowlBest}점
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {BOWL_STAGES.map((s) => {
                    const open = bowlUnlocked.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!open}
                        onClick={() => open && selectBowlStage(s.id)}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-medium",
                          open ? "bg-pod text-foreground" : "bg-muted text-muted-foreground",
                          bowlStage === s.id && "ring-2 ring-primary",
                        )}
                      >
                        {open ? s.name : "잠김"}
                      </button>
                    );
                  })}
                </div>
                <Button
                  className="mt-5 w-full"
                  onClick={() => {
                    unlockAudio();
                    setRun((n) => n + 1);
                    setPhase("play");
                    setHud({
                      frame: 1,
                      throwNo: 1,
                      pins: 10,
                      score: 0,
                      message: "",
                      bonus: 0,
                      layout: stageById(bowlStage).name,
                      key: true,
                      unlocked: "",
                    });
                  }}
                >
                  굴리기
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">이번 점수</p>
                <h2 className="mt-1 text-3xl font-semibold tabular-nums">{hud.score}점</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  열린 스테이지 {bowlUnlocked.length}/{BOWL_STAGES.length}
                </p>
                <Button
                  className="mt-5 w-full"
                  onClick={() => {
                    setRun((n) => n + 1);
                    setPhase("play");
                    setHud({
                      frame: 1,
                      throwNo: 1,
                      pins: 10,
                      score: 0,
                      message: "",
                      bonus: 0,
                      layout: stageById(bowlStage).name,
                      key: true,
                      unlocked: "",
                    });
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
