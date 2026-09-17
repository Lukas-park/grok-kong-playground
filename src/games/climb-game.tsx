import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  beanSrc,
  climbAssetList,
  climbBootAssets,
  CLOVER_ICON,
  CLOVER_SPARK,
  drawSprite,
  FLY_SPRITE,
  LARVA_SPRITE,
  waitForImages,
} from "@/lib/assets";
import { sfx, unlockAudio } from "@/lib/audio";
import { drawBean, drawClover } from "@/lib/draw-bean";
import { usePlayground } from "@/lib/store";
import { THEME_LIST, THEMES, type Mood, type ThemeId } from "@/lib/themes";
import { GameBoot } from "@/components/game-boot";

type Plat = {
  x: number;
  y: number;
  w: number;
  kind: "leaf" | "spring" | "clover" | "pod" | "giant" | "fly";
  theme: ThemeId;
  hp: number;
  taken?: boolean;
  broken?: boolean;
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
  leaf?: boolean;
  rot?: number;
  vr?: number;
};

type Floater = { x: number; y: number; life: number; text: string };
type Fly = { a: number; x: number; y: number; shot: number; life: number };
type Dart = { x: number; y: number; vx: number; vy: number; life: number };

const LEAF_GREEN = "#3f8a52";
const LEAF_RED = "#c45c28";
const LEAF_YELLOW = "#e8c44d";

function leafFill(hp: number) {
  if (hp <= 1) return LEAF_YELLOW;
  if (hp <= 3) return LEAF_RED;
  return LEAF_GREEN;
}

const JUMP = 620;
const SPRING = 920;
const GRAVITY = 1480;
const DOUBLE_CD = 3;
const ZONE = 820;

export function ClimbGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"ready" | "play" | "over">("ready");
  const [height, setHeight] = useState(0);
  const [runClovers, setRunClovers] = useState(0);
  const [jumpCd, setJumpCd] = useState(0);
  const [threat, setThreat] = useState("");
  const [overWhy, setOverWhy] = useState<"fall" | "eaten">("fall");
  const [booted, setBooted] = useState(false);
  const [run, setRun] = useState(0);
  const [knob, setKnob] = useState(0.5);
  const steerRef = useRef(0.5);
  const climbBest = usePlayground((s) => s.climbBest);
  const recordClimb = usePlayground((s) => s.recordClimb);
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    let live = true;
    waitForImages(climbBootAssets()).then(() => {
      if (live) setBooted(true);
      void waitForImages(climbAssetList());
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

    const pointer = { tap: false };
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
    const flies: Fly[] = [];
    const darts: Dart[] = [];

    const player = {
      x: 195,
      y: 80,
      vx: 0,
      vy: 0,
      squash: 1,
      mood: "good" as Mood,
    };

    const larva = {
      alive: false,
      y: 0,
      stun: 0,
      wiggle: 0,
      hidden: 0,
      mode: "chase" as "chase" | "dash" | "recoil",
      dashTo: 0,
      recoil: 0,
    };

    function themeAt(y: number): ThemeId {
      const zi = Math.min(THEME_LIST.length - 1, Math.max(0, Math.floor(Math.max(0, y - 80) / ZONE)));
      return THEME_LIST[zi]!.id;
    }

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
      flies.length = 0;
      darts.length = 0;
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
      larva.alive = false;
      larva.y = 0;
      larva.stun = 0;
      larva.hidden = 0;
      larva.mode = "chase";
      larva.recoil = 0;
      steerRef.current = 0.5;
      setKnob(0.5);
      plats.push({ x: w / 2, y: 40, w: 88, kind: "leaf", theme: "sprout", hp: 5 });
      THEME_LIST.forEach((theme, zi) => {
        const z0 = 120 + zi * ZONE;
        const z1 = z0 + ZONE - 90;
        let y = z0;
        let placedFly = zi < 1;
        while (y < z1 - 50) {
          const side = Math.random() < 0.5 ? -1 : 1;
          const x = w / 2 + side * (40 + Math.random() * Math.min(110, w * 0.28));
          let kind: Plat["kind"] = "leaf";
          const roll = Math.random();
          if (theme.id === "halloween" && y > z0 + 300 && y < z0 + 420 && !plats.some((p) => p.kind === "giant")) {
            kind = "giant";
          } else if (!placedFly && y > z0 + 180 && roll < 0.12) {
            kind = "fly";
            placedFly = true;
          } else if (roll < 0.08) kind = "clover";
          else if (roll < 0.14) kind = "spring";
          plats.push({
            x,
            y,
            w: kind === "giant" ? 150 : 74 + Math.random() * 18,
            kind,
            theme: theme.id,
            hp: kind === "giant" || kind === "spring" ? 99 : 5,
          });
          y += 76 + Math.random() * 40;
        }
        const topX = w / 2 + (zi % 2 === 0 ? -70 : 70);
        plats.push({ x: topX, y: z1, w: 96, kind: "pod", theme: theme.id, hp: 5 });
        if (!placedFly && zi >= 1) {
          plats.push({
            x: w / 2 - topX + w / 2,
            y: z0 + ZONE * 0.45,
            w: 78,
            kind: "fly",
            theme: theme.id,
            hp: 5,
          });
        }
      });
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
          leaf: false,
          rot: 0,
          vr: 0,
        });
      }
    }

    function fireworks(x: number, y: number, label: string, color?: string) {
      const theme = THEMES[themeAt(y)];
      spawnBurst(x, y, color ?? theme.accent, 18, false);
      spawnBurst(x, y, "#f4efe4", 10, false);
      spawnBurst(x, y, theme.leaf, 8, true);
      floaters.push({ x, y: y + 24, life: 1.15, text: label });
    }

    function shatter(p: Plat) {
      p.broken = true;
      p.hp = 0;
      for (let i = 0; i < 8; i++) {
        const a = -0.2 + Math.random() * Math.PI * 1.2;
        particles.push({
          x: p.x + (Math.random() - 0.5) * p.w * 0.8,
          y: p.y,
          vx: Math.cos(a) * (50 + Math.random() * 110),
          vy: 20 + Math.random() * 80,
          life: 0.75 + Math.random() * 0.45,
          color: LEAF_YELLOW,
          size: 7 + Math.random() * 8,
          leaf: true,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 10,
        });
      }
      sfx.fall();
    }

    function grantPod(plat: Plat, worldX: number, worldY: number) {
      const store = usePlayground.getState();
      store.unlockTheme(plat.theme, "ad");
      fireworks(worldX, worldY, THEMES[plat.theme].name);
      sfx.unlock();
    }

    function summonFlies(worldX: number, worldY: number) {
      flies.length = 0;
      for (let i = 0; i < 3; i++) {
        flies.push({ a: i * 2.1, x: worldX, y: worldY, shot: 0.15 * i, life: 3.4 });
      }
      fireworks(worldX, worldY, "긴등기생파리", "#5a4638");
      sfx.buzz();
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
      spawnBurst(player.x, player.y, THEMES[themeAt(player.y)].accent, 12);
    }

    function endRun(why: "fall" | "eaten") {
      if (why === "eaten") sfx.eat();
      else sfx.fall();
      setOverWhy(why);
      recordClimb(Math.floor(maxY / 10), earned);
      setPhase("over");
    }

    function step(dt: number) {
      if (phaseRef.current !== "play") return;
      const tId = themeAt(player.y);
      const theme = THEMES[tId];
      extraCd = Math.max(0, extraCd - dt);
      groundedUntil = Math.max(0, groundedUntil - dt);
      hudTick += dt;
      if (hudTick > 0.08) {
        hudTick = 0;
        setJumpCd(extraCd);
        if (larva.alive) {
          const gap = player.y - larva.y;
          setThreat(
            larva.stun > 0
              ? `유충이 멈췄어요 ${Math.max(0, larva.stun).toFixed(1)}초`
              : larva.mode === "dash"
                ? "파바박 올라와요"
                : gap < 140
                  ? "따라잡히고 있어요"
                  : "담배거세미가 올라와요",
          );
        } else setThreat("");
      }

      if (pointer.tap) {
        pointer.tap = false;
        tryDoubleJump();
      }

      const targetX = 36 + steerRef.current * (w - 72);
      player.x += (targetX - player.x) * (1 - Math.exp(-14 * dt));
      player.x = Math.max(28, Math.min(w - 28, player.x));
      player.vy -= GRAVITY * dt;
      player.y += player.vy * dt;
      player.squash += (1 - player.squash) * (1 - Math.exp(-12 * dt));

      if (player.vy < 0) {
        for (const p of plats) {
          if (p.broken) continue;
          const half = p.w / 2;
          if (Math.abs(player.x - p.x) > half + 8) continue;
          if (player.y > p.y + 18 || player.y < p.y - 10) continue;
          player.y = p.y + 16;
          player.vy = p.kind === "spring" || p.kind === "giant" ? SPRING : JUMP;
          player.squash = 0.72;
          groundedUntil = 0.12;
          hops += 1;
          trauma = Math.min(1, trauma + (p.kind === "giant" ? 0.45 : 0.12));
          sfx.land();
          spawnBurst(player.x, player.y, leafFill(Math.max(1, p.hp - 1)), 8);
          if (p.kind === "clover" && !p.taken) {
            p.taken = true;
            earned += 2;
            sfx.collect();
            setRunClovers(earned);
            fireworks(player.x, player.y + 20, "클로버 +2");
          }
          if (p.kind === "pod" && !p.taken) {
            p.taken = true;
            grantPod(p, player.x, player.y + 24);
          }
          if (p.kind === "fly" && !p.taken) {
            p.taken = true;
            summonFlies(player.x, player.y + 20);
          }
          if (p.kind === "giant") sfx.strike();
          if (p.kind !== "giant" && p.kind !== "spring") {
            if (p.hp <= 1) shatter(p);
            else p.hp -= 1;
          }
          break;
        }
      }

      maxY = Math.max(maxY, player.y);
      const desired = Math.max(0, player.y - h * 0.38);
      cameraY += (desired - cameraY) * (1 - Math.exp(-6 * dt));
      trauma = Math.max(0, trauma - dt * 1.8);

      if (!larva.alive && maxY > ZONE * 0.85) {
        larva.alive = true;
        larva.y = Math.max(40, player.y - 220);
        larva.stun = 0;
        larva.hidden = 0;
        larva.mode = "chase";
        floaters.push({ x: w / 2, y: larva.y + 40, life: 1.6, text: "담배거세미가 따라와요" });
        sfx.eat();
      }
      if (larva.alive) {
        const stunned = larva.stun > 0;
        larva.wiggle += dt * (stunned ? 1.2 : larva.mode === "dash" ? 18 : 6);
        if (stunned) {
          larva.stun = Math.max(0, larva.stun - dt);
        } else if (larva.mode === "dash") {
          larva.y += 1280 * dt;
          if (Math.random() < 0.25) spawnBurst(w / 2, larva.y - 10, "#3d3a36", 1);
          if (larva.y >= larva.dashTo) {
            larva.y = larva.dashTo;
            larva.mode = "recoil";
            larva.recoil = 0.48;
          }
        } else if (larva.mode === "recoil") {
          larva.recoil -= dt;
          larva.y -= 160 * dt;
          if (larva.recoil <= 0) larva.mode = "chase";
        } else {
          const zi = Math.min(THEME_LIST.length - 1, Math.floor(Math.max(0, player.y) / ZONE));
          larva.y += (70 + zi * 8) * dt;
          const onScreen = larva.y > cameraY - 24 && larva.y < cameraY + h + 20;
          if (!onScreen && larva.y < cameraY) {
            larva.hidden += dt;
            if (larva.hidden >= 1) {
              larva.hidden = 0;
              larva.mode = "dash";
              larva.dashTo = Math.min(player.y - 92, cameraY + h * 0.22);
              floaters.push({ x: w / 2, y: larva.y + 30, life: 0.8, text: "파바박" });
              sfx.strike();
            }
          } else {
            larva.hidden = 0;
            if (larva.y < cameraY + 28) larva.y += (cameraY + 28 - larva.y) * Math.min(1, dt * 2);
          }
        }
        if (larva.y + 20 >= player.y) {
          endRun("eaten");
          return;
        }
      }

      const stalkX = w / 2;
      for (const f of flies) {
        f.life -= dt;
        f.a += dt * 3.2;
        const tx = (larva.alive ? stalkX + 16 : player.x) + Math.cos(f.a) * 34;
        const ty = (larva.alive ? larva.y + 36 : player.y + 18) + Math.sin(f.a) * 22;
        f.x += (tx - f.x) * (1 - Math.exp(-8 * dt));
        f.y += (ty - f.y) * (1 - Math.exp(-8 * dt));
        f.shot -= dt;
        if (larva.alive && f.life > 0 && f.shot <= 0) {
          f.shot = 0.42;
          const dx = stalkX - f.x;
          const dy = larva.y - f.y;
          const dist = Math.hypot(dx, dy) || 1;
          darts.push({ x: f.x, y: f.y, vx: (dx / dist) * 280, vy: (dy / dist) * 280, life: 0.7 });
          sfx.buzz();
        }
      }
      for (let i = flies.length - 1; i >= 0; i--) if (flies[i]!.life <= 0) flies.splice(i, 1);
      for (const d of darts) {
        d.life -= dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (larva.alive && Math.hypot(d.x - stalkX, d.y - larva.y) < 28) {
          d.life = 0;
          if (larva.stun <= 0) larva.stun = 3;
          trauma = Math.min(1, trauma + 0.2);
          spawnBurst(stalkX, larva.y, "#5a4638", 14);
          sfx.pin();
        }
      }
      for (let i = darts.length - 1; i >= 0; i--) if (darts[i]!.life <= 0) darts.splice(i, 1);

      for (const pt of particles) {
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy -= 80 * dt;
        if (pt.leaf) {
          pt.rot = (pt.rot ?? 0) + (pt.vr ?? 0) * dt;
          pt.vy -= 220 * dt;
        }
      }
      for (let i = particles.length - 1; i >= 0; i--) if (particles[i]!.life <= 0) particles.splice(i, 1);
      for (const f of floaters) {
        f.life -= dt;
        f.y += 40 * dt;
      }
      for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i]!.life <= 0) floaters.splice(i, 1);

      setHeight(Math.floor(maxY / 10));

      if (player.y < cameraY - 40) endRun("fall");
    }

    function draw() {
      const tId = themeAt(cameraY + h * 0.45);
      const theme = THEMES[tId];
      const shake = trauma * trauma;
      ctx!.save();
      ctx!.translate((Math.random() - 0.5) * 12 * shake, (Math.random() - 0.5) * 12 * shake);

      const g = ctx!.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, theme.sky[0]);
      g.addColorStop(1, theme.sky[1]);
      ctx!.fillStyle = g;
      ctx!.fillRect(-20, -20, w + 40, h + 40);

      const stalkX = w / 2;
      ctx!.strokeStyle = theme.stalk;
      ctx!.lineWidth = 22;
      ctx!.lineCap = "round";
      ctx!.beginPath();
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
        if (p.broken) continue;
        const sy = toScreen(p.y);
        if (sy < -80 || sy > h + 80) continue;
        const fill = p.kind === "giant" || p.kind === "spring" ? THEMES[p.theme].leaf : leafFill(p.hp);
        if (p.kind === "giant") {
          const ok = drawSprite(ctx!, beanSrc(p.theme, "ok"), p.x, sy - 40, 110, { squash: 0.9 });
          if (!ok) drawBean(ctx!, p.x, sy - 48, 56, "ok", { blush: true, squash: 0.9 });
          ctx!.fillStyle = fill;
          ctx!.beginPath();
          ctx!.ellipse(p.x, sy + 8, p.w / 2, 14, 0, 0, Math.PI * 2);
          ctx!.fill();
          continue;
        }
        ctx!.fillStyle = fill;
        ctx!.beginPath();
        ctx!.ellipse(p.x, sy, p.w / 2, 13, 0.2, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.strokeStyle = "rgba(255,255,255,0.28)";
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        ctx!.moveTo(p.x - p.w / 3, sy);
        ctx!.quadraticCurveTo(p.x, sy + 6, p.x + p.w / 3, sy);
        ctx!.stroke();
        if (p.hp <= 3 && p.hp > 0 && p.kind !== "spring") {
          ctx!.strokeStyle = "rgba(61,58,54,0.28)";
          ctx!.beginPath();
          ctx!.moveTo(p.x - p.w * 0.22, sy - 2);
          ctx!.lineTo(p.x - 4, sy + 4);
          ctx!.lineTo(p.x + p.w * 0.18, sy - 1);
          ctx!.stroke();
        }
        if (p.kind === "spring") {
          ctx!.fillStyle = THEMES[p.theme].accent;
          ctx!.fillRect(p.x - 8, sy - 10, 16, 8);
        }
        if (p.kind === "clover" && !p.taken) {
          if (!drawSprite(ctx!, CLOVER_ICON, p.x, sy - 22, 26)) drawClover(ctx!, p.x, sy - 22, 12);
        }
        if (p.kind === "pod" && !p.taken) {
          drawSprite(ctx!, beanSrc(p.theme, 2), p.x, sy - 28, 36);
          if (!drawSprite(ctx!, CLOVER_SPARK, p.x, sy - 44, 22)) {
            ctx!.fillStyle = THEMES[p.theme].bean;
            ctx!.beginPath();
            ctx!.ellipse(p.x, sy - 26, 12, 16, 0, 0, Math.PI * 2);
            ctx!.fill();
          }
        }
        if (p.kind === "fly" && !p.taken) {
          drawSprite(ctx!, FLY_SPRITE, p.x, sy - 26, 36, { width: 42, height: 28 });
        }
      }

      if (larva.alive) {
        const ly = toScreen(larva.y);
        const lx = stalkX + Math.sin(larva.wiggle) * 8;
        const flash = larva.stun > 0 && Math.floor(larva.wiggle * 8) % 2 === 0;
        if (larva.mode === "dash") {
          ctx!.strokeStyle = "rgba(61,58,54,0.35)";
          ctx!.lineWidth = 3;
          for (let i = 1; i <= 3; i++) {
            ctx!.beginPath();
            ctx!.moveTo(lx, ly + 12 + i * 10);
            ctx!.lineTo(lx, ly + 28 + i * 16);
            ctx!.stroke();
          }
        }
        drawSprite(ctx!, LARVA_SPRITE, lx, ly, 120, {
          width: 132,
          height: 36,
          tilt: -Math.PI / 2 + Math.sin(larva.wiggle) * 0.08,
          alpha: flash ? 0.55 : 1,
        });
        if (larva.stun > 0) {
          ctx!.fillStyle = "rgba(255,255,255,0.35)";
          ctx!.beginPath();
          ctx!.arc(lx, ly, 22, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      for (const d of darts) {
        ctx!.fillStyle = "#3d3a36";
        ctx!.beginPath();
        ctx!.arc(d.x, toScreen(d.y), 3.2, 0, Math.PI * 2);
        ctx!.fill();
      }
      for (const f of flies) {
        drawSprite(ctx!, FLY_SPRITE, f.x, toScreen(f.y), 28, {
          width: 34,
          height: 22,
          tilt: Math.sin(f.a) * 0.4,
        });
      }

      for (const pt of particles) {
        ctx!.globalAlpha = Math.max(0, pt.life * 1.8);
        if (pt.clover) drawSprite(ctx!, CLOVER_ICON, pt.x, toScreen(pt.y), pt.size);
        else if (pt.leaf) {
          ctx!.save();
          ctx!.translate(pt.x, toScreen(pt.y));
          ctx!.rotate(pt.rot ?? 0);
          ctx!.fillStyle = pt.color;
          ctx!.beginPath();
          ctx!.ellipse(0, 0, pt.size, pt.size * 0.45, 0.3, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.restore();
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

      const pTheme = themeAt(player.y);
      const aim = 36 + steerRef.current * (w - 72);
      const tilt = Math.max(-0.35, Math.min(0.35, (aim - player.x) / 140));
      const drawn = drawSprite(ctx!, beanSrc(pTheme, player.mood), player.x, toScreen(player.y), 48, {
        squash: player.squash,
        tilt,
      });
      if (!drawn) {
        drawBean(ctx!, player.x, toScreen(player.y), 22, player.mood, { squash: player.squash, tilt });
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

    const onDown = (e: PointerEvent) => {
      if (phaseRef.current !== "play") return;
      e.preventDefault();
      pointer.tap = true;
    };
    const onKey = (e: KeyboardEvent) => {
      if (phaseRef.current !== "play") return;
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        steerRef.current = Math.max(0, steerRef.current - 0.08);
        setKnob(steerRef.current);
      }
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        steerRef.current = Math.min(1, steerRef.current + 0.08);
        setKnob(steerRef.current);
      }
      if (e.code === "Space") {
        e.preventDefault();
        tryDoubleJump();
      }
    };

    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [recordClimb, run]);

  return (
    <div className="absolute inset-0 min-h-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        style={{ touchAction: "none" }}
      />
      <GameBoot ready={booted} label="콩나무를 키우는 중" />
      {phase === "play" ? (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex flex-col items-center gap-1.5">
          <div className="rounded-full bg-card/90 px-4 py-1.5 text-xs font-medium tabular-nums shadow-soft">
            {height} m · 클로버 +{runClovers}
          </div>
          <div className="rounded-full bg-card/80 px-3 py-1 text-[11px] font-medium tabular-nums text-muted-foreground shadow-soft">
            {jumpCd <= 0 ? "탭하면 더블점프" : `더블점프 ${jumpCd.toFixed(1)}초`}
          </div>
          {threat ? (
            <div className="rounded-full bg-ink/80 px-3 py-1 text-[11px] font-medium text-paper shadow-soft">
              {threat}
            </div>
          ) : null}
        </div>
      ) : null}
      {phase === "play" ? (
        <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(0.8rem,env(safe-area-inset-bottom))] pt-1">
          <p className="mb-1.5 text-center text-[11px] font-medium text-muted-foreground">
            아래 바만 밀어 이동 · 화면을 탭하면 더블점프
          </p>
          <div
            className="relative h-14 touch-none rounded-full bg-card shadow-lift"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const rect = e.currentTarget.getBoundingClientRect();
              const v = Math.max(0, Math.min(1, (e.clientX - rect.left - 28) / (rect.width - 56)));
              steerRef.current = v;
              setKnob(v);
            }}
            onPointerMove={(e) => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const v = Math.max(0, Math.min(1, (e.clientX - rect.left - 28) / (rect.width - 56)));
              steerRef.current = v;
              setKnob(v);
            }}
          >
            <div className="pointer-events-none absolute inset-y-0 left-7 right-7 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary/25" />
            <img
              src="/beans/sprout-2.png"
              alt=""
              className="pointer-events-none absolute top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 object-contain"
              style={{ left: `calc(1.75rem + ${knob} * (100% - 3.5rem))` }}
            />
          </div>
        </div>
      ) : null}
      {phase !== "play" && booted ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/25 px-6 text-center">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-lift">
            {phase === "ready" ? (
              <>
                <p className="text-sm text-muted-foreground">아래 바로 움직이고, 노란 잎은 한 번이면 바스러져요</p>
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
                    setThreat("");
                    setPhase("play");
                  }}
                >
                  올라가기
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {overWhy === "eaten" ? "담배거세미가 따라잡았어요" : "이번 높이"}
                </p>
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
