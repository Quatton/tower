import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, useState } from "react";
import { Button } from "@/components/ui/button";
import { Disc2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

const PhaserGame = lazy(() =>
  import("@/features/game/phaser").then((mod) => ({ default: mod.PhaserGame })),
);

export default function Home() {
  const [numDiscs, setNumDiscs] = useState(4);

  return (
    <main className="h-dvh w-full overflow-hidden">
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-gray-100 p-4">
        <div className="z-10 flex flex-wrap items-center justify-center gap-2 rounded-lg bg-white/90 p-4 shadow-md backdrop-blur-sm">
          {[3, 4, 5, 6, 7, 8].map((num) => (
            <Button
              key={num}
              variant={numDiscs === num ? "default" : "outline"}
              size="sm"
              onClick={() => setNumDiscs(num)}
            >
              {num}
            </Button>
          ))}
        </div>

        {/* Game Container */}
        <div className="h-full max-h-screen w-full max-w-7xl">
          <ClientOnly>
            <PhaserGame numDiscs={numDiscs} />
          </ClientOnly>
        </div>
      </div>
    </main>
  );
}
