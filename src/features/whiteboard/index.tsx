import { WhiteBoardRoot } from "@/components/ui/whiteboard/root";
import { useCallback, useEffect, useRef } from "react";
import { Layer } from "react-konva";
import { WhiteBoardElements, WhiteboardTools } from "./elements";
import { ElementEvents, whiteboardStore } from "./store";
import { Button } from "@/components/ui/button";
import { dommer } from "@/lib/dom-logger";
import { useSelector } from "@xstate/react";
import { selfId } from "trystero";
import { Trash2 } from "lucide-react";
import { sha1 } from "@/lib/rtc/utils";
import { uuidv7 } from "uuidv7";

export function DocumentWhiteboard() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative h-dvh min-h-0 flex-1" ref={containerRef}>
      <WhiteBoardRoot containerRef={containerRef}>
        <Layer>
          <WhiteBoardElements />
        </Layer>
      </WhiteBoardRoot>
      <WhiteBoardConnection />
      <WhiteBoardPersistencePlugin />
      <div className="absolute top-1 left-1">
        <WhiteboardTools />
      </div>
    </div>
  );
}

export function WhiteBoardConnection({ autoConnect = false }) {
  const SEND_HISTORY = useSelector(
    whiteboardStore,
    (state) => state.context.roomActions.SEND_HISTORY,
  );
  const UPDATE_ELEMENT = useSelector(
    whiteboardStore,
    (state) => state.context.roomActions.REALTIME,
  );
  const REQUEST_HISTORY = useSelector(
    whiteboardStore,
    (state) => state.context.roomActions.REQUEST_HISTORY,
  );
  const PROPOSE_CHECKPOINT = useSelector(
    whiteboardStore,
    (state) => state.context.roomActions.PROPOSE,
  );

  const room = useSelector(whiteboardStore, (state) => state.context.room);

  useEffect(() => {
    if (autoConnect && !room) {
      handleJoinRoom();
    }
  }, [autoConnect, room]);

  useEffect(() => {
    if (
      !room ||
      !SEND_HISTORY ||
      !UPDATE_ELEMENT ||
      !REQUEST_HISTORY ||
      !PROPOSE_CHECKPOINT
    ) {
      dommer.trigger.LOG({
        event: "Collaboration not initialized, skipping setup",
      });
      return;
    }

    dommer.trigger.LOG({
      event: `Setting up collaboration handlers for selfId: ${selfId}`,
    });

    SEND_HISTORY.receiver((remoteHistory, peerId) => {
      if (peerId === selfId) {
        return;
      }
      dommer.trigger.LOG({
        event: `Received remote history: ${remoteHistory.length} updates`,
      });

      whiteboardStore.send({
        type: "MERGE_FROM",
        payload: remoteHistory,
      });
    });

    UPDATE_ELEMENT.receiver(function collabUpdateEventHandler(
      payload: ElementEvents,
    ) {
      dommer.trigger.LOG({
        event: `Received remote event: ${JSON.stringify(payload)}`,
      });

      whiteboardStore.send({
        type: "ACTION",
        payload,
        isRemote: true,
      });
    });

    REQUEST_HISTORY.receiver((id) => {
      dommer.trigger.LOG({
        event: `REQUEST_HISTORY.receiver called with id: ${id}, selfId: ${selfId}`,
      });

      if (id === selfId) {
        dommer.trigger.LOG({
          event: `Ignoring history request from self (${id})`,
        });
        return;
      }

      dommer.trigger.LOG({
        event: `Processing remote history request from peer: ${id}`,
      });

      const { context } = whiteboardStore.getSnapshot();
      const historyEntries = context.crdtHistory.entries().toArray();

      dommer.trigger.LOG({
        event: `Sending history: ${historyEntries.length} entries to peer ${id}`,
      });

      SEND_HISTORY?.sender(historyEntries);
    });

    PROPOSE_CHECKPOINT.receiver(
      async ({ checkpointId, elementHash }, peerId) => {
        const snapshot = whiteboardStore.getSnapshot();
        const selfElementHash = await sha1(
          JSON.stringify(snapshot.context.elements.entries()),
        );
        if (elementHash !== selfElementHash) {
          REQUEST_HISTORY.sender(selfId, peerId);
          return;
        }
        dommer.trigger.LOG({
          event: `Received checkpoint proposal from ${peerId}: ${checkpointId}`,
        });
        whiteboardStore.send({
          type: "VOTE_CHECKPOINT",
          checkpointId: checkpointId,
          peerId: peerId,
          elementHash: selfElementHash,
        });
        if (snapshot.context.checkpointVotes.get(checkpointId)?.has(selfId)) {
          PROPOSE_CHECKPOINT.sender({
            checkpointId: checkpointId,
            elementHash: selfElementHash,
          });
        }
      },
    );

    room.onPeerJoin((peer) => {
      REQUEST_HISTORY.sender(selfId, [peer]);
    });
  }, [SEND_HISTORY, UPDATE_ELEMENT, REQUEST_HISTORY, room, PROPOSE_CHECKPOINT]);

  function handleJoinRoom() {
    whiteboardStore.send({
      type: "JOIN_ROOM",
      roomId: "room1",
    });
  }

  useEffect(() => {
    const timer = setInterval(async () => {
      const snapshot = whiteboardStore.getSnapshot();
      if (snapshot.context.crdtHistory.size < 100) {
        return;
      }
      if (room) {
        const elementHash = await sha1(
          JSON.stringify(
            whiteboardStore.getSnapshot().context.elements.entries(),
          ),
        );
        if (snapshot.context.lastSnapshot?.elementHash === elementHash) {
          return;
        }
        whiteboardStore.send({
          type: "PROPOSE_CHECKPOINT",
          checkpointId: uuidv7(),
          elementHash,
        });
      }
    }, 60000);

    return () => clearInterval(timer);
  }, [room]);

  const handleRequestHistory = useCallback(() => {
    if (!REQUEST_HISTORY) {
      dommer.trigger.LOG({
        event: "REQUEST_HISTORY action not available",
      });
      return;
    }

    dommer.trigger.LOG({
      event: `Manually requesting history from selfId: ${selfId}`,
    });

    REQUEST_HISTORY.sender(selfId);
  }, [REQUEST_HISTORY]);

  return (
    <div className="bg-card absolute bottom-1 left-1 z-10 flex items-center gap-2 rounded p-2 shadow">
      {!room ? (
        <Button onClick={handleJoinRoom}>Connect</Button>
      ) : (
        <>
          <Button size="sm" variant="outline" onClick={handleRequestHistory}>
            Request History
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              whiteboardStore.send({ type: "LEAVE_ROOM" });
            }}
          >
            Leave Room
          </Button>
        </>
      )}

      <Button
        size="icon"
        onClick={() => {
          whiteboardStore.send({ type: "CLEAR_HISTORY" });
          localStorage.removeItem("history");
        }}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

export function WhiteBoardPersistencePlugin() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const history = localStorage.getItem("history");
    const lastSnapshot = localStorage.getItem("lastSnapshot");
    if (history) {
      const parsedHistory = JSON.parse(history) as Array<
        [string, ElementEvents]
      >;
      whiteboardStore.send({
        type: "MERGE_FROM",
        payload: parsedHistory,
      });
      dommer.trigger.LOG({
        event: `Loaded ${parsedHistory.length} history entries from localStorage`,
      });
    } else {
      dommer.trigger.LOG({
        event: "No history found in localStorage, starting fresh",
      });
    }

    if (lastSnapshot) {
      try {
        const parsedSnapshot = JSON.parse(lastSnapshot);
        whiteboardStore.send({
          type: "RESTORE_SNAPSHOT",
          ...parsedSnapshot,
        });

        dommer.trigger.LOG({
          event: `Restored last snapshot from localStorage: ${JSON.stringify(
            parsedSnapshot,
          )}`,
        });
      } catch (error) {
        dommer.trigger.LOG({
          event: `Failed to parse last snapshot from localStorage: ${error}`,
        });
      }
    }

    whiteboardStore.subscribe((snapshot) => {
      if (snapshot.context.crdtHistory.size === 0) {
        return;
      }
      localStorage.setItem(
        "history",
        JSON.stringify(snapshot.context.crdtHistory.entries().toArray()),
      );
      if (snapshot.context.lastSnapshot) {
        localStorage.setItem(
          "lastSnapshot",
          JSON.stringify(snapshot.context.lastSnapshot),
        );
      }
    });
  }, []);

  return null;
}
