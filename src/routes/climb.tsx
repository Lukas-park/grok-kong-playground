import { createFileRoute } from "@tanstack/react-router";
import { GameShell } from "@/components/game-shell";
import { ClimbGame } from "@/games/climb-game";

export const Route = createFileRoute("/climb")({ component: ClimbPage });

function ClimbPage() {
  return (
    <GameShell title="쑥쑥 콩나무" subtitle="아래 바로 이동 · 화면 탭하면 더블점프">
      <ClimbGame />
    </GameShell>
  );
}
