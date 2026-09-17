import { createFileRoute } from "@tanstack/react-router";
import { GameShell } from "@/components/game-shell";
import { BowlGame } from "@/games/bowl-game";

export const Route = createFileRoute("/bowl")({ component: BowlPage });

function BowlPage() {
  return (
    <GameShell title="데굴데굴 콩볼링" subtitle="스트라이크는 다음 두 투구가 2배">
      <BowlGame />
    </GameShell>
  );
}
