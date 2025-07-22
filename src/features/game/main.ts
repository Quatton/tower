import { Game as MainGame } from "./scenes/game";
import { AUTO, Game, Types } from "phaser";

interface StartGameConfig extends Partial<Types.Core.GameConfig> {
  numDiscs?: number;
}

const StartGame = ({ numDiscs = 4, ...overrides }: StartGameConfig) => {
  const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: "game-container",
    backgroundColor: "#028af8",
    scene: [new MainGame(numDiscs)],
  };

  return new Game({ ...config, ...overrides });
};

export default StartGame;
