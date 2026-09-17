import { createFileRoute } from "@tanstack/react-router";
import { GameShell } from "@/components/game-shell";
import { ClimbGame } from "@/games/climb-game";

export const Route = createFileRoute("/climb")({ component: ClimbPage });

function ClimbPage() {
  return (
    <GameShell title="쑥쑥 콩나무" subtitle="좌우로 밀어 잎을 밟아요">
      <ClimbGame />
    </GameShell>
  );
}
