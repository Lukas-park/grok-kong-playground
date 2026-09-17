export function GameBoot({ ready, label = "콩을 깨우는 중" }: { ready: boolean; label?: string }) {
  if (ready) return null;
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/95 px-6 text-center">
      <img
        src="/beans/sprout-2.png"
        alt=""
        width={72}
        height={76}
        className="h-[72px] w-[72px] animate-bounce object-contain"
      />
      <p className="mt-4 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">이미지를 준비하고 있어요</p>
    </div>
  );
}
