import { createFileRoute } from "@tanstack/react-router";
import { GameShell } from "@/components/game-shell";
import { BowlGame } from "@/games/bowl-game";

export const Route = createFileRoute("/bowl")({ component: BowlPage });

function BowlPage() {
  return (
    <GameShell title="데굴데굴 콩볼링" subtitle="스트라이크 다음엔 핀이 흩어져요">
      <BowlGame />
    </GameShell>
  );
}
