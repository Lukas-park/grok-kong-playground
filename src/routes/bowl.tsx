import { createFileRoute } from "@tanstack/react-router";
import { GameShell } from "@/components/game-shell";
import { BowlGame } from "@/games/bowl-game";

export const Route = createFileRoute("/bowl")({ component: BowlPage });

function BowlPage() {
  return (
    <GameShell title="데굴데굴 콩볼링" subtitle="노란 핀을 쓰러뜨리면 다음 스테이지">
      <BowlGame />
    </GameShell>
  );
}
