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
    <main className="h-dvh">
      <ClientOnly>
        <PhaserGame />
      </ClientOnly>
    </main>
  );
}
