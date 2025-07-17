import {
  Editor,
  EditorContent,
  EditorContentEditable,
} from "@/components/ui/editor";
import {
  COLLABORATION_TAG,
  LexicalEditor,
  UpdateListenerPayload,
} from "lexical";
import { useEffect, useRef } from "react";
import { joinRoom } from "trystero/nostr";
import { dommer } from "@/lib/dom-logger";

const KEYWORDS_FOR_USERNAME = [
  "Apple",
  "Juice",
  "Tree",
  "Mountain",
  "River",
  "Sky",
  "Ocean",
  "Star",
  "Cloud",
  "Flower",
  "Sun",
  "Moon",
  "Wind",
  "Rain",
  "Snow",
  "Fire",
  "Earth",
  "Leaf",
  "Rock",
  "Bird",
  "Fish",
  "Animal",
  "Insect",
  "Plant",
  "Fruit",
  "Vegetable",
  "Seed",
  "Root",
  "Branch",
  "Trunk",
];

// oxlint-disable-next-line no-unused-vars
function getRandomUsername() {
  const LENGTH = 2;
  let username = "";
  for (let i = 0; i < LENGTH; i++) {
    const randomIndex = Math.floor(
      Math.random() * KEYWORDS_FOR_USERNAME.length,
    );
    username += KEYWORDS_FOR_USERNAME[randomIndex];
  }
  return username;
}

export function DocumentEditor() {
  const editorRef = useRef<LexicalEditor | null>(null);
  const contentEditableRef = useRef<HTMLDivElement | null>(null);

  const room = joinRoom(
    {
      appId: "tower.qttn.dev",
    },
    "room1",
  );

  room.onPeerJoin((peer) => {
    dommer.trigger.LOG({
      event: `Peer joined: ${peer}`,
    });
  });

  const [sendAction, getAction] = room.makeAction<any>("action");

  useEffect(() => {
    function updateHandler(update: UpdateListenerPayload) {
      if (update.tags.has(COLLABORATION_TAG)) {
        return;
      }

      const editorState = update.editorState;

      sendAction({
        type: "editorStateChange",
        payload: editorState.toJSON(),
      });
    }
    editorRef.current?.registerUpdateListener(updateHandler);
  }, [sendAction]);

  getAction((action) => {
    dommer.trigger.LOG({
      event: `Received action: ${JSON.stringify(action)}`,
    });

    editorRef.current?.update(
      () => {
        const newEditorState = editorRef.current?.parseEditorState(
          action.payload,
        );
        if (newEditorState) {
          editorRef.current?.setEditorState(newEditorState);
        }
      },
      {
        tag: "collaboration",
      },
    );
  });

  return (
    <div className="min-h-0 w-full max-w-3xl flex-1">
      <Editor ref={editorRef}>
        <EditorContent>
          <EditorContentEditable ref={contentEditableRef} className="h-full" />
        </EditorContent>
        {/* <OnChangePlugin onChange={handleChange} ignoreSelectionChange={true} /> */}
      </Editor>
    </div>
  );
}
