import { dommer } from "@/lib/dom-logger";
import { ActionProgress, ActionReceiver, ActionSender, Room } from "trystero";
import { joinRoom, selfId } from "trystero/nostr";
import { produce, enableMapSet } from "immer";
import { createStoreWithProducer } from "@xstate/store";
import { uuidv7 } from "uuidv7";

enableMapSet(); // Enable Map and Set support in immer

export type ElementType = "rect" | "circle" | "line";
export type ElementBase = {
  id: string;
  x: number;
  y: number;
  color: string;
  draggable: boolean;
};
export type ElementVariant<T extends ElementType = ElementType> = ElementBase &
  (T extends "rect"
    ? { type: "rect"; width: number; height: number; x: number; y: number }
    : T extends "circle"
      ? { type: "circle"; radius: number }
      : T extends "line"
        ? { type: "line"; points: Array<{ x: number; y: number }> }
        : never);

export type UpdateElementEvent<T extends ElementType> = {
  id: string;
  type: T;
} & Partial<ElementVariant<T>>;

export type CreateElementEvent<T extends ElementType> = ElementVariant<T>;

export type DeleteElementEvent = {
  id: string;
};

export type ElementEvents<T extends ElementType = ElementType> = {
  isRemote?: boolean;
} & (
  | {
      action: "update";
      payload: UpdateElementEvent<T>;
    }
  | {
      action: "create";
      payload: CreateElementEvent<T>;
    }
  | {
      action: "delete";
      payload: DeleteElementEvent;
    }
);

export const whiteboardStore = createStoreWithProducer(produce, {
  context: {
    lastSnapshot: undefined as
      | {
          id: string;
          elements: Map<string, ElementVariant<ElementType>>;
          elementHash: string;
        }
      | undefined,
    dimensions: {
      width: 0,
      height: 0,
    },
    roomActions: {
      REALTIME: undefined as
        | {
            sender: ActionSender<ElementEvents>;
            receiver: ActionReceiver<ElementEvents>;
            progress: ActionProgress;
          }
        | undefined,
      SEND_HISTORY: undefined as
        | {
            sender: ActionSender<Array<[string, ElementEvents]>>;
            receiver: ActionReceiver<Array<[string, ElementEvents]>>;
            progress: ActionProgress;
          }
        | undefined,
      REQUEST_HISTORY: undefined as
        | {
            sender: ActionSender<string>;
            receiver: ActionReceiver<string>;
            progress: ActionProgress;
          }
        | undefined,
      PROPOSE: undefined as
        | {
            sender: ActionSender<{
              checkpointId: string;
              elementHash: string;
            }>;
            receiver: ActionReceiver<{
              checkpointId: string;
              elementHash: string;
            }>;
            progress: ActionProgress;
          }
        | undefined,
    },
    room: undefined as Room | undefined,
    elements: new Map<string, ElementVariant<ElementType>>(),
    crdtHistory: new Map<string, ElementEvents>(),
    checkpointVotes: new Map<string, Set<string>>(),
  },
  on: {
    RESTORE_SNAPSHOT: (
      context,
      event: {
        id: string;
        elements: [string, ElementVariant<ElementType>][];
        elementHash: string;
      },
    ) => {
      context.lastSnapshot = {
        id: event.id,
        elements: new Map(event.elements),
        elementHash: event.elementHash,
      };
      context.elements = new Map(event.elements);
      dommer.trigger.LOG({
        event: `Restored snapshot with id: ${event.id}, elements: ${event.elements.length}, elementHash: ${event.elementHash}`,
      });
      return context;
    },
    COMPACT_HISTORY: (
      context,
      event: {
        checkpointId: string;
        elementHash: string;
      },
    ) => {
      context.lastSnapshot = {
        id: event.checkpointId,
        elements: new Map(context.elements),
        elementHash: event.elementHash,
      };

      const sortedHistory = Array.from(context.crdtHistory.entries()).sort(
        (a, b) => a[0].localeCompare(b[0]),
      );

      const recentHistory = sortedHistory.slice(-100);
      context.crdtHistory = new Map(recentHistory);

      dommer.trigger.LOG({
        event: `Compacted history to last 100 entries after checkpoint ${event.checkpointId}`,
      });
    },
    ACTION: (
      context,
      event: {
        payload: ElementEvents;
        isRemote?: boolean;
      },
    ) => {
      doActionFromDraft(context.elements, event.payload);

      if (!event.isRemote) {
        context.roomActions.REALTIME?.sender(event.payload);
      }
    },
    COMMIT: (context, event: { payload: ElementEvents }) => {
      const elementHash = uuidv7();
      context.crdtHistory.set(elementHash, event.payload);
      dommer.trigger.LOG({
        event: `Committing update to history: ${JSON.stringify(event.payload)}`,
      });

      context.roomActions.SEND_HISTORY?.sender([[elementHash, event.payload]]);
    },
    MERGE_FROM: (
      context,
      event: {
        payload: Array<[string, ElementEvents]>;
      },
    ) => {
      dommer.trigger.LOG({
        event: `Merging ${event.payload.length} updates from remote history`,
      });

      event.payload.forEach(([elementHash, update]) => {
        if (!context.crdtHistory.has(elementHash)) {
          context.crdtHistory.set(elementHash, update);
        }
      });
      const allHistory = Array.from(context.crdtHistory.entries()).sort(
        (a, b) => {
          return a[0].localeCompare(b[0]); // uuidv7 is time-sortable
        },
      );

      const newElements = new Map<string, ElementVariant<ElementType>>();
      const pendingDeletes = new Map<string, DeleteElementEvent>();

      allHistory.forEach(([_elementHash, update]) => {
        switch (update.action) {
          case "create": {
            // Remove any pending delete for this element
            pendingDeletes.delete(update.payload.id);
            createElementFromDraft(newElements, update.payload);
            break;
          }
          case "update": {
            // Remove any pending delete for this element (update implies it should exist)
            pendingDeletes.delete(update.payload.id);
            updateElementFromDraft(newElements, update.payload);
            break;
          }
          case "delete": {
            // Add to pending deletes instead of immediately deleting
            pendingDeletes.set(update.payload.id, update.payload);
            break;
          }
        }
      });

      // Apply all pending deletes at the end
      pendingDeletes.forEach((deleteEvent) => {
        deleteElementFromDraft(newElements, deleteEvent);
      });

      context.elements = newElements;

      dommer.trigger.LOG({
        event: `State rebuilt from ${allHistory.length} history entries`,
      });
    },
    LEAVE_ROOM: (context) => {
      if (!context.room) {
        console.warn("Not currently in a room.");
        return context;
      }
      dommer.trigger.LOG({
        event: `Leaving room`,
      });
      context.room.leave();
      context.room = undefined;
      context.roomActions.REALTIME = undefined;
      context.roomActions.SEND_HISTORY = undefined;
      context.roomActions.REQUEST_HISTORY = undefined;
      dommer.trigger.LOG({
        event: "Room actions reset after leaving room.",
      });
      return context;
    },
    JOIN_ROOM: (
      context,
      event: {
        roomId: string;
        password?: string;
      },
    ) => {
      if (context.room) {
        console.warn("Already joined a room.");
        return context;
      }
      context.room = joinRoom(
        {
          appId: "tower.qttn.dev",
          password: event.password,
          rtcConfig: {
            iceServers: [
              {
                urls: [
                  "stun:stun.cloudflare.com:3478",
                  "turn:turn.cloudflare.com:3478?transport=udp",
                  "turn:turn.cloudflare.com:3478?transport=tcp",
                  "turns:turn.cloudflare.com:5349?transport=tcp",
                ],
                username: "cd00285783a2f6cd21b032a6fed426d9",
                credential:
                  "425ed172605801137c9beda486c9f4c567edf1c47867c9a9ddd1f467b6131735",
              },
            ],
          },
        },

        event.roomId,
      );
      const [sender, receiver, progress] =
        context.room.makeAction<ElementEvents>("realtime");

      context.roomActions.REALTIME = {
        sender,
        receiver,
        progress,
      };

      const [historySender, historyReceiver, historyProgress] =
        context.room.makeAction<Array<[string, ElementEvents]>>("send-history");

      context.roomActions.SEND_HISTORY = {
        sender: historySender,
        receiver: historyReceiver,
        progress: historyProgress,
      };

      const [requestSender, requestReceiver, requestProgress] =
        context.room.makeAction<string>("req-hist");
      context.roomActions.REQUEST_HISTORY = {
        sender: requestSender,
        receiver: requestReceiver,
        progress: requestProgress,
      };

      const [proposeSender, proposeReceiver, proposeProgress] =
        context.room.makeAction<{
          checkpointId: string;
          elementHash: string;
        }>("propose");

      context.roomActions.PROPOSE = {
        sender: proposeSender,
        receiver: proposeReceiver,
        progress: proposeProgress,
      };

      dommer.trigger.LOG({
        event: `Joined room: ${event.roomId}`,
      });
    },
    CLEAR_HISTORY: (context) => {
      context.crdtHistory.clear();
      context.elements.clear();
      return context;
    },
    PROPOSE_CHECKPOINT: (
      context,
      event: {
        checkpointId: string;
        elementHash: string;
      },
    ) => {
      if (!context.roomActions.PROPOSE) {
        console.warn("Propose action not available.");
        return context;
      }
      context.roomActions.PROPOSE.sender({
        checkpointId: event.checkpointId,
        elementHash: event.elementHash,
      });

      context.checkpointVotes.set(event.checkpointId, new Set(selfId));
      dommer.trigger.LOG({
        event: `Proposed checkpoint with payload: ${JSON.stringify(event)}`,
      });
      return context;
    },
    VOTE_CHECKPOINT: (
      context,
      event: {
        checkpointId: string;
        elementHash: string;
        peerId: string;
      },
      enqueue,
    ) => {
      if (!context.checkpointVotes.has(event.checkpointId)) {
        context.checkpointVotes.set(event.checkpointId, new Set());
      }
      context.checkpointVotes.get(event.checkpointId)?.add(event.peerId);

      const votes = context.checkpointVotes.get(event.checkpointId)!;

      if (votes.size > Object.keys(context.room!.getPeers()).length / 2 + 1) {
        dommer.trigger.LOG({
          event: `Checkpoint ${event.checkpointId} has enough votes (${votes.size})`,
        });

        enqueue.effect(async () => {
          whiteboardStore.send({
            type: "COMPACT_HISTORY",
            checkpointId: event.checkpointId,
            elementHash: event.elementHash,
          });
        });
      }
    },
  },
});

function doActionFromDraft<T extends ElementType>(
  draft: Map<string, ElementVariant<T>>,
  event: ElementEvents<T>,
) {
  switch (event.action) {
    case "update": {
      updateElementFromDraft(draft, event.payload);
      break;
    }
    case "create": {
      createElementFromDraft(draft, event.payload);
      break;
    }
    case "delete": {
      deleteElementFromDraft(draft, event.payload);
      break;
    }
  }
}

function updateElementFromDraft<T extends ElementType>(
  draft: Map<string, ElementVariant<T>>,
  event: UpdateElementEvent<T>,
) {
  const element = draft.get(event.id);
  if (element) {
    const definedAttributes = Object.fromEntries(
      Object.entries(event).filter(([_, value]) => value !== undefined),
    ) as any;

    draft.set(event.id, {
      ...element,
      ...definedAttributes,
    });
  } else {
    console.warn(`Element with id ${event.id} not found.`);
  }
}

function createElementFromDraft<T extends ElementType>(
  draft: Map<string, ElementVariant<T>>,
  event: CreateElementEvent<T>,
) {
  draft.set(event.id, event);
}

function deleteElementFromDraft<T extends ElementType>(
  draft: Map<string, ElementVariant<T>>,
  event: DeleteElementEvent,
) {
  if (draft.has(event.id)) {
    draft.delete(event.id);
  } else {
    console.warn(`Element with id ${event.id} not found for deletion.`);
  }
}
