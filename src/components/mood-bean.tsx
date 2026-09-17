import { beanSrc } from "@/lib/assets";
import { cn } from "@/lib/utils";
import { MOODS, type Mood, type ThemeId } from "@/lib/themes";

type Props = {
  mood?: Mood;
  theme?: ThemeId;
  size?: number;
  selected?: boolean;
  className?: string;
  alt?: string;
};

export function MoodBean({
  mood = "good",
  theme = "sprout",
  size = 72,
  selected = false,
  className,
  alt,
}: Props) {
  const spec = MOODS.find((m) => m.id === mood) ?? MOODS[1];
  return (
    <img
      src={beanSrc(theme, mood)}
      alt={alt ?? spec.label}
      width={size}
      height={size}
      draggable={false}
      className={cn(
        "select-none object-contain transition-transform duration-200 ease-out",
        selected && "scale-110 drop-shadow-md",
        className,
      )}
    />
  );
}

export function CloverMark({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <img
      src="/icons/clover.png"
      alt=""
      width={size}
      height={size}
      className={cn("object-contain", className)}
      draggable={false}
    />
  );
}
