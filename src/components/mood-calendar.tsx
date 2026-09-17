import { MoodBean } from "@/components/mood-bean";
import { type Mood, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const FAKE: Mood[] = ["best", "good", "ok", "good", "best", "bad", "good", "ok", "worst", "good"];

type Props = {
  theme: ThemeId;
  todayMood: Mood | null;
};

export function MoodCalendar({ theme, todayMood }: Props) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <section className="rounded-2xl bg-card/90 p-4 shadow-soft backdrop-blur-sm">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground">이 달의 콩</p>
          <h2 className="text-lg font-semibold">
            {year}년 {month + 1}월
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">테마가 달력에도 입혀져요</p>
      </div>
      <div className="grid grid-cols-7 gap-y-2 text-center">
        {WEEK.map((d) => (
          <span key={d} className="text-[11px] font-medium text-muted-foreground">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={`e-${i}`} />;
          const isToday = day === today;
          const past = day < today;
          const mood = isToday ? todayMood : past ? FAKE[(day + month) % FAKE.length]! : null;
          return (
            <div
              key={day}
              className={cn("flex flex-col items-center gap-0.5", isToday && "rounded-lg bg-pod/80")}
            >
              <span className="text-[10px] tabular-nums text-muted-foreground">{day}</span>
              {mood ? (
                <MoodBean theme={theme} mood={mood} size={28} />
              ) : (
                <span className="size-7 rounded-full border border-dashed border-border" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
