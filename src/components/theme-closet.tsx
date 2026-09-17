import { useState } from "react";
import { AdModal } from "@/components/ad-modal";
import { MoodBean } from "@/components/mood-bean";
import { Button } from "@/components/ui/button";
import { themeBg } from "@/lib/assets";
import { sfx } from "@/lib/audio";
import { usePlayground } from "@/lib/store";
import { THEME_LIST, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ThemeCloset({ open, onClose }: Props) {
  const equipped = usePlayground((s) => s.equippedTheme);
  const unlocked = usePlayground((s) => s.unlockedThemes);
  const clovers = usePlayground((s) => s.clovers);
  const unlockTheme = usePlayground((s) => s.unlockTheme);
  const equipTheme = usePlayground((s) => s.equipTheme);
  const [adFor, setAdFor] = useState<ThemeId | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 sm:items-center">
      <div className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-5 shadow-lift sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">하루콩 옷장</p>
            <h2 className="text-xl font-semibold">테마를 골라 입혀 보세요</h2>
          </div>
          <Button variant="ghost" onClick={onClose}>
            닫기
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {THEME_LIST.map((theme) => {
            const owned = unlocked.includes(theme.id);
            const on = equipped === theme.id;
            return (
              <article
                key={theme.id}
                className={cn(
                  "overflow-hidden rounded-xl border border-border bg-secondary text-left",
                  on && "ring-2 ring-primary",
                )}
              >
                <div
                  className="relative h-24 bg-cover bg-center"
                  style={{ backgroundImage: `url(${themeBg(theme.id)})` }}
                >
                  <div className="absolute bottom-1 left-1">
                    <MoodBean theme={theme.id} mood="best" size={44} />
                  </div>
                </div>
                <div className="space-y-2 p-3">
                  <h3 className="text-sm font-semibold leading-tight">{theme.name}</h3>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{theme.tagline}</p>
                  {owned ? (
                    <Button
                      size="sm"
                      variant={on ? "default" : "secondary"}
                      className="w-full"
                      onClick={() => {
                        equipTheme(theme.id);
                        sfx.tap();
                      }}
                    >
                      {on ? "입는 중" : "입히기"}
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={clovers < theme.cost}
                        onClick={() => {
                          if (unlockTheme(theme.id, "clover")) sfx.unlock();
                        }}
                      >
                        클로버 {theme.cost}
                      </Button>
                      <Button size="sm" variant="outline" className="w-full" onClick={() => setAdFor(theme.id)}>
                        광고 보고 받기
                      </Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <AdModal
        open={Boolean(adFor)}
        title="테마 광고"
        reward={adFor ? `${THEME_LIST.find((t) => t.id === adFor)?.name}을 받을 수 있어요` : ""}
        onClose={() => setAdFor(null)}
        onComplete={() => {
          if (adFor) unlockTheme(adFor, "ad");
          sfx.unlock();
          setAdFor(null);
        }}
      />
    </div>
  );
}
