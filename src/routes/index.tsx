import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { Shirt, Sprout } from "lucide-react";
import { useEffect, useState } from "react";
import { MoodCalendar } from "@/components/mood-calendar";
import { CloverMark, MoodBean } from "@/components/mood-bean";
import { ThemeCloset } from "@/components/theme-closet";
import { Button } from "@/components/ui/button";
import { preloadTheme, themeBg } from "@/lib/assets";
import { sfx, unlockAudio } from "@/lib/audio";
import { usePlayground } from "@/lib/store";
import { MOODS, THEMES, type Mood } from "@/lib/themes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Lobby });

function Lobby() {
  const equipped = usePlayground((s) => s.equippedTheme);
  const clovers = usePlayground((s) => s.clovers);
  const todayMood = usePlayground((s) => s.todayMood);
  const growStage = usePlayground((s) => s.growStage);
  const wateredDate = usePlayground((s) => s.wateredDate);
  const setMood = usePlayground((s) => s.setMood);
  const water = usePlayground((s) => s.water);
  const climbBest = usePlayground((s) => s.climbBest);
  const bowlBest = usePlayground((s) => s.bowlBest);
  const [closet, setCloset] = useState(false);
  const [toast, setToast] = useState("");
  const [squash, setSquash] = useState(1);
  const theme = THEMES[equipped];
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const watered = wateredDate === todayKey;

  useEffect(() => {
    preloadTheme(equipped);
  }, [equipped]);

  useEffect(() => {
    let last = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
      if (mag > 22 && Date.now() - last > 1200) {
        last = Date.now();
        const result = usePlayground.getState().water();
        if (result.grew) sfx.water();
      }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, []);

  function tryWater() {
    unlockAudio();
    const result = water();
    setSquash(0.82);
    window.setTimeout(() => setSquash(1), 180);
    if (result.grew) {
      sfx.water();
      setToast(`물이 들어갔어요. 클로버 +${result.bonus}`);
    } else {
      sfx.tap();
      setToast("오늘은 이미 물을 줬어요");
    }
    window.setTimeout(() => setToast(""), 1800);
  }

  return (
    <div
      className="min-h-dvh bg-background bg-cover bg-center text-foreground"
      style={{ backgroundImage: `linear-gradient(180deg, rgb(244 239 228 / 0.55), rgb(244 239 228 / 0.88)), url(${themeBg(equipped)})` }}
    >
      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground">하루콩 놀이터</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight">콩놀이터</h1>
          </div>
          <div className="inline-flex h-11 items-center gap-1.5 rounded-full bg-card px-3.5 text-sm font-medium tabular-nums shadow-soft">
            <CloverMark size={18} />
            {clovers}
          </div>
        </header>

        <section className="rounded-2xl bg-card/90 p-5 text-center shadow-soft backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">오늘은 어떤 콩인가요</p>
          <button
            type="button"
            className="mx-auto mt-2 block"
            onClick={tryWater}
            aria-label="콩에게 물 주기"
            style={{ transform: `scale(${2 - squash}, ${squash})` }}
          >
            <MoodBean theme={equipped} mood={todayMood ?? "good"} size={108 + growStage * 6} />
          </button>
          <p className="mt-1 text-xs text-muted-foreground">
            {watered ? "오늘 물을 줬어요" : "콩을 눌러 물을 주세요"}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {MOODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMood(m.id as Mood);
                  sfx.tap();
                }}
                className={cn(
                  "flex flex-col items-center rounded-xl px-1 py-1",
                  todayMood === m.id && "bg-pod",
                )}
              >
                <MoodBean theme={equipped} mood={m.id} size={44} selected={todayMood === m.id} />
                <span className="mt-1 text-[10px] text-muted-foreground">{m.label}</span>
              </button>
            ))}
          </div>
        </section>

        <MoodCalendar theme={equipped} todayMood={todayMood} />

        <section className="grid grid-cols-1 gap-3">
          <PlayCard
            to="/climb"
            title="쑥쑥 콩나무"
            copy="잎을 밟고, 공중에서 탭하면 한 번 더 뛰어요"
            best={`${climbBest} m`}
            beanMood="best"
            theme={equipped}
          />
          <PlayCard
            to="/bowl"
            title="데굴데굴 콩볼링"
            copy="콩을 굴려 기분 핀을 쓰러뜨려요"
            best={`${bowlBest}점`}
            beanMood="ok"
            theme={equipped}
          />
        </section>

        <Button variant="cream" className="h-12 w-full justify-between px-5" onClick={() => setCloset(true)}>
          <span className="inline-flex items-center gap-2">
            <Shirt className="size-4" />
            테마 옷장 · {theme.name}
          </span>
          <span className="text-xs text-muted-foreground">입히기</span>
        </Button>

        <footer className="flex items-center justify-between text-xs text-muted-foreground">
          <Link to="/present" className="underline-offset-2 hover:underline">
            발표 자료
          </Link>
          <span className="inline-flex items-center gap-1">
            <Sprout className="size-3.5" />
            Grok과 함께 만든 해커톤 빌드
          </span>
        </footer>
        {toast ? (
          <p className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-paper shadow-lift">
            {toast}
          </p>
        ) : null}
      </main>
      <ThemeCloset open={closet} onClose={() => setCloset(false)} />
    </div>
  );
}

function PlayCard({
  to,
  title,
  copy,
  best,
  beanMood,
  theme,
}: {
  to: "/climb" | "/bowl";
  title: string;
  copy: string;
  best: string;
  beanMood: Mood;
  theme: ReturnType<typeof usePlayground.getState>["equippedTheme"];
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-2xl bg-card/90 p-4 shadow-soft backdrop-blur-sm transition-transform duration-150 active:scale-[0.99]"
    >
      <MoodBean theme={theme} mood={beanMood} size={64} />
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{copy}</p>
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">최고 {best}</p>
      </div>
    </Link>
  );
}
