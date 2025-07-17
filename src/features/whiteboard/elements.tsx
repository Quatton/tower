import { Rect } from "react-konva";
import { whiteboardStore } from "./store";
import { useSelector } from "@xstate/react";
import { Button } from "@/components/ui/button";
import { uuidv7 } from "uuidv7";
import { Square } from "lucide-react";

export function WhiteBoardElements() {
  const elements = useSelector(
    whiteboardStore,
    (state) => state.context.elements,
  );

  return (
    <>
      {elements.keys().map((element) => {
        return <WhileboardElement key={element} id={element} />;
      })}
    </>
  );
}

export function WhileboardElement({ id }: { id: string }) {
  const element = useSelector(whiteboardStore, (state) =>
    state.context.elements.get(id),
  );

  if (!element) return null;

  switch (element.type) {
    case "rect":
      return <WhiteboardRect key={element.id} id={element.id} />;

    default:
      return null;
  }
}

export function WhiteboardRect({ id }: { id: string }) {
  const element = useSelector(whiteboardStore, (state) =>
    state.context.elements.get(id),
  );

  if (!element || element.type !== "rect") return null;

  return (
    <Rect
      id={id}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      fill={element.color}
      draggable={element.draggable}
      onDragMove={(e) => {
        whiteboardStore.send({
          type: "ACTION",
          payload: {
            action: "update",
            payload: {
              id,
              type: "rect",
              x: e.target.x(),
              y: e.target.y(),
            },
          },
        });
      }}
      onDragEnd={(e) => {
        whiteboardStore.send({
          type: "COMMIT",
          payload: {
            action: "update",
            payload: {
              id,
              type: "rect",
              x: e.target.x(),
              y: e.target.y(),
            },
          },
        });
      }}
      onPointerDblClick={() => {
        whiteboardStore.send({
          type: "ACTION",
          payload: {
            action: "delete",
            payload: { id },
          },
        });
        whiteboardStore.send({
          type: "COMMIT",
          payload: {
            action: "delete",
            payload: { id },
          },
        });
      }}
    />
  );
}

export function WhiteboardTools() {
  return (
    <div className="flex gap-2">
      <Button
        size="icon"
        onClick={() => {
          const payload = {
            action: "create",
            payload: {
              id: uuidv7(),
              type: "rect",
              x: 100,
              y: 100,
              width: 100,
              height: 100,
              color: randomColor(),
              draggable: true,
            },
          } as const;
          whiteboardStore.send({
            type: "ACTION",
            payload,
          });
          whiteboardStore.send({
            type: "COMMIT",
            payload,
          });
        }}
      >
        <Square />
      </Button>
    </div>
  );
}

function randomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
