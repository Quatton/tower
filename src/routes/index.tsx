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
    <main className="h-dvh w-full overflow-hidden">
      <div className="flex h-full w-full items-center justify-center bg-gray-100">
        <div className="h-full max-h-screen w-full max-w-7xl">
          <ClientOnly>
            <PhaserGame />
          </ClientOnly>
        </div>
      </div>
    </main>
  );
}
