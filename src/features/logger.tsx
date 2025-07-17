import { Button } from "@/components/ui/button";
import { dommer } from "@/lib/dom-logger";
import { useSelector } from "@xstate/react";
import { useEffect, useRef } from "react";

export function Logger() {
  const logs = useSelector(dommer, (state) => state.context.logs);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-card flex min-h-0 w-128 flex-col gap-2 rounded p-2 shadow-lg max-lg:hidden">
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold">Logger</h2>

        <Button
          variant="outline"
          size="sm"
          onClick={() => dommer.trigger.CLEAR_LOGS()}
        >
          Clear Logs
        </Button>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto" ref={scrollRef}>
        {logs.map((log, index) => (
          <div
            key={index}
            className="bg-secondary text-secondary-foreground rounded p-2"
          >
            <pre className="text-muted-foreground text-sm break-words whitespace-pre-wrap">
              {log}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
