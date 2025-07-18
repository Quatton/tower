import { Scene } from "phaser";
export class Game extends Scene {
  constructor() {
    super("Game");
  }

  preload() {}

  create() {
    this.add
      .text(
        512,
        490,
        "Make something fun!\nand share it with us:\nsupport@phaser.io",
        {
          fontFamily: "Arial Black",
          fontSize: 38,
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 8,
          align: "center",
        },
      )
      .setOrigin(0.5)
      .setDepth(100);
  }
}
