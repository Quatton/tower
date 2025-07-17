import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Logger } from "@/features/logger";
import { DocumentWhiteboard } from "@/features/whiteboard";

export const Route = createFileRoute("/")({
  component: Home,
  ssr: false,
});

export default function Home() {
  return (
    <main className="container mx-auto flex h-dvh flex-col items-center justify-center gap-2 py-2">
      <div className="flex max-h-180 min-h-0 w-full flex-1 justify-center gap-2">
        <div className="bg-card flex min-h-0 max-w-sm flex-1 flex-col gap-2 rounded p-2 shadow-lg">
          <ClientOnly>
            <DocumentWhiteboard />
          </ClientOnly>
        </div>
        <Logger />
      </div>
    </main>
  );
}
