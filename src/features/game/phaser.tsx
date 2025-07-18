import { forwardRef, useEffect, useRef, useLayoutEffect } from "react";
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
    const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      if (!game.current) return;

      // Debounce resize to avoid too many calls during orientation change
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = setTimeout(() => {
        const { width: newWidth, height: newHeight } = getContainerSize();

        // Update the game scale
        game.current!.scale.resize(newWidth, newHeight);

        // Force a scene refresh for responsive updates
        const currentScene = game.current!.scene.getScene("Game");
        if (currentScene && currentScene.scene.isActive()) {
          // Trigger resize event on the scene if it has a handleResize method
          if (
            "handleResize" in currentScene &&
            typeof currentScene.handleResize === "function"
          ) {
            currentScene.handleResize();
          }
        }
      }, 150);
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
      window.addEventListener("orientationchange", handleResize);

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
        window.removeEventListener("orientationchange", handleResize);
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
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
