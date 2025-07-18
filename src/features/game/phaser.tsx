import {
  forwardRef,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
} from "react";
import StartGame from "./main";
import { EventBus } from "./event";

export interface IRefPhaserGame {
  game: Phaser.Game | null;
  scene: Phaser.Scene | null;
}

interface IProps {
  currentActiveScene?: (scene_instance: Phaser.Scene) => void;
}

export const PhaserGame = forwardRef<IRefPhaserGame, IProps>(
  function PhaserGame({ currentActiveScene }, ref) {
    const game = useRef<Phaser.Game | null>(null!);

    const getContainerSize = () => {
      const parent = document.getElementById("game-container");
      if (!parent) return { width: 1024, height: 768 };

      const rect = parent.getBoundingClientRect();
      return {
        width: rect.width || 1024,
        height: rect.height || 768,
      };
    };

    const handleResize = () => {
      if (!game.current || !parent) return;

      const { width: newWidth, height: newHeight } = getContainerSize();

      game.current.scale.resize(newWidth, newHeight);
    };

    useLayoutEffect(() => {
      if (game.current === null) {
        const { width: gameWidth, height: gameHeight } = getContainerSize();
        game.current = StartGame({
          parent: "game-container",
          width: gameWidth,
          height: gameHeight,
        });

        if (typeof ref === "function") {
          ref({ game: game.current, scene: null });
        } else if (ref) {
          ref.current = { game: game.current, scene: null };
        }
      }

      return () => {
        if (game.current) {
          game.current.destroy(true);
          if (game.current !== null) {
            game.current = null;
          }
        }
      };
    }, [ref]);

    useEffect(() => {
      window.addEventListener("resize", handleResize);

      EventBus.on("current-scene-ready", (scene_instance: Phaser.Scene) => {
        if (currentActiveScene && typeof currentActiveScene === "function") {
          currentActiveScene(scene_instance);
        }

        if (typeof ref === "function") {
          ref({ game: game.current, scene: scene_instance });
        } else if (ref) {
          ref.current = { game: game.current, scene: scene_instance };
        }
      });

      return () => {
        window.removeEventListener("resize", handleResize);
        EventBus.removeListener("current-scene-ready");
      };
    }, [currentActiveScene, ref]);

    return (
      <div
        id="game-container"
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          overflow: "hidden",
        }}
      />
    );
  },
);
