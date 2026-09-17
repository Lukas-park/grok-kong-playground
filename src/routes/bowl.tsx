import { createFileRoute } from "@tanstack/react-router";
import { GameShell } from "@/components/game-shell";
import { BowlGame } from "@/games/bowl-game";

export const Route = createFileRoute("/bowl")({ component: BowlPage });

function BowlPage() {
  return (
    <GameShell title="데굴데굴 콩볼링" subtitle="뒤로 당겼다 놓으면 굴러가요">
      <BowlGame />
    </GameShell>
  );
}
