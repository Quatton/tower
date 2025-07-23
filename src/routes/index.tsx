import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Disc2, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

const PhaserGame = lazy(() =>
  import("@/features/game/phaser").then((mod) => ({ default: mod.PhaserGame })),
);

export default function Home() {
  const [numDiscs, setNumDiscs] = useState(4);
  const [isAspectRatioTooVertical, setIsAspectRatioTooVertical] =
    useState(false);

  useEffect(() => {
    const checkAspectRatio = () => {
      const aspectRatio = window.innerWidth / window.innerHeight;
      // Consider aspect ratio too vertical if height is more than 1.5 times the width
      setIsAspectRatioTooVertical(aspectRatio < 0.67);
    };

    checkAspectRatio();
    window.addEventListener("resize", checkAspectRatio);
    window.addEventListener("orientationchange", checkAspectRatio);

    return () => {
      window.removeEventListener("resize", checkAspectRatio);
      window.removeEventListener("orientationchange", checkAspectRatio);
    };
  }, []);

  if (isAspectRatioTooVertical) {
    return (
      <main className="h-dvh w-full overflow-hidden bg-gray-100">
        <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-8 text-center">
          <RotateCcw className="h-16 w-16 text-gray-600" />
          <div className="max-w-md space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">
              Please Rotate Your Device
            </h2>
            <p className="text-gray-600">
              This game works best in landscape orientation or with a wider
              screen. Please rotate your device or resize your browser window
              for the optimal experience.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-dvh w-full overflow-hidden">
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 bg-gray-100">
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 transform flex-wrap items-center justify-center gap-2 rounded-lg p-4 shadow-md backdrop-blur-sm">
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
        <div className="h-full max-h-screen w-full">
          <ClientOnly>
            <PhaserGame numDiscs={numDiscs} />
          </ClientOnly>
        </div>
      </div>
    </main>
  );
}
