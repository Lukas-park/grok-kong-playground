import { useEffect, useState } from "react";
import { MoodBean } from "@/components/mood-bean";
import { Button } from "@/components/ui/button";
import { sfx, unlockAudio } from "@/lib/audio";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  title: string;
  reward: string;
  onClose: () => void;
  onComplete: () => void;
};

export function AdModal({ open, title, reward, onClose, onComplete }: Props) {
  const [left, setLeft] = useState(5);

  useEffect(() => {
    if (!open) return;
    setLeft(5);
    unlockAudio();
    const id = window.setInterval(() => {
      setLeft((n) => {
        if (n <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal
        aria-labelledby="ad-title"
        className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-lift"
      >
        <p className="text-xs font-medium tracking-wide text-muted-foreground">잠깐 광고</p>
        <h2 id="ad-title" className="mt-1 text-xl font-semibold">
          {title}
        </h2>
        <div className="relative mt-4 overflow-hidden rounded-xl bg-pod px-4 py-8 text-center">
          <div className={cn("mx-auto w-fit", left > 0 && "animate-bounce")}>
            <MoodBean mood="best" size={96} />
          </div>
          <p className="mt-3 text-sm text-ink-soft">하루콩 테마 미리보기</p>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{reward}</p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            닫기
          </Button>
          <Button
            className="flex-1"
            disabled={left > 0}
            onClick={() => {
              sfx.unlock();
              onComplete();
            }}
          >
            {left > 0 ? `${left}초 남음` : "보상 받기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
