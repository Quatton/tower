import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";

export const Route = createFileRoute("/")({
  component: Home,
});

const PhaserGame = lazy(() =>
  import("@/features/game/phaser").then((mod) => ({ default: mod.PhaserGame })),
);

export default function Home() {
  return (
    <main className="container mx-auto flex h-dvh flex-col items-center justify-center gap-2 py-2">
      <div className="flex w-full max-w-4xl flex-col items-center justify-center gap-2">
        <div className="bg-card rounded p-2 shadow-lg" id="game-container">
          <ClientOnly>
            <PhaserGame />
          </ClientOnly>
        </div>
      </div>
    </main>
  );
}
