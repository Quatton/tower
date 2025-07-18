import { Scene } from "phaser";
import { EventBus } from "../event";

interface Disc {
  graphics: Phaser.GameObjects.Graphics;
  size: number;
  originalY: number;
}

export class Game extends Scene {
  private towers: Disc[][] = [[], [], []];
  private selectedDisc: Disc | null = null;
  private selectedTower: number = -1;
  private towerBases: Phaser.GameObjects.Graphics[] = [];
  private towerPoles: Phaser.GameObjects.Graphics[] = [];
  private moveCount: number = 0;
  private moveText!: Phaser.GameObjects.Text;
  private winText!: Phaser.GameObjects.Text;
  private readonly TOWER_WIDTH = 200;
  private readonly TOWER_HEIGHT = 20;
  private readonly POLE_HEIGHT = 200;
  private readonly DISC_HEIGHT = 20;
  private readonly DISC_COLORS = [
    0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff,
  ];

  constructor() {
    super("Game");
  }

  preload() {}

  create() {
    this.cameras.main.setBackgroundColor(0x2c3e50);

    // Setup towers
    this.createTowers();
    this.createDiscs(4); // Start with 4 discs

    // UI
    this.moveText = this.add.text(10, 10, "Moves: 0", {
      fontSize: "24px",
      color: "#ffffff",
    });

    this.winText = this.add
      .text(400, 100, "", {
        fontSize: "32px",
        color: "#00ff00",
      })
      .setOrigin(0.5);

    // Input handling
    this.input.on("pointerdown", this.handleClick, this);

    EventBus.emit("current-scene-ready", this);
  }

  private createTowers() {
    const centerX = this.cameras.main.width / 2;
    const baseY = this.cameras.main.height - 100;

    for (let i = 0; i < 3; i++) {
      const towerX = centerX + (i - 1) * 250;

      // Create tower base
      const base = this.add.graphics();
      base.fillStyle(0x8b4513);
      base.fillRect(
        towerX - this.TOWER_WIDTH / 2,
        baseY,
        this.TOWER_WIDTH,
        this.TOWER_HEIGHT,
      );
      this.towerBases.push(base);

      // Create tower pole
      const pole = this.add.graphics();
      pole.fillStyle(0x654321);
      pole.fillRect(towerX - 5, baseY - this.POLE_HEIGHT, 10, this.POLE_HEIGHT);
      this.towerPoles.push(pole);
    }
  }

  private createDiscs(numDiscs: number) {
    const centerX = this.cameras.main.width / 2;
    const baseY = this.cameras.main.height - 100 - this.TOWER_HEIGHT;
    const leftTowerX = centerX - 250;

    // Create discs on the leftmost tower
    for (let i = 0; i < numDiscs; i++) {
      const discSize = numDiscs - i; // Largest disc at bottom
      const discWidth = 40 + discSize * 30;
      const discY = baseY - i * this.DISC_HEIGHT;

      const disc = this.add.graphics();
      const color = this.DISC_COLORS[i % this.DISC_COLORS.length];
      if (color) {
        disc.fillStyle(color);
      }
      disc.fillRoundedRect(
        -discWidth / 2,
        -this.DISC_HEIGHT / 2,
        discWidth,
        this.DISC_HEIGHT,
        5,
      );
      disc.setPosition(leftTowerX, discY);
      disc.setInteractive(
        new Phaser.Geom.Rectangle(
          -discWidth / 2,
          -this.DISC_HEIGHT / 2,
          discWidth,
          this.DISC_HEIGHT,
        ),
        Phaser.Geom.Rectangle.Contains,
      );

      const discObj: Disc = {
        graphics: disc,
        size: discSize,
        originalY: discY,
      };

      this.towers[0]?.push(discObj);

      // Add hover effects
      disc.on("pointerover", () => {
        if (this.canSelectDisc(discObj)) {
          disc.setAlpha(0.8);
        }
      });

      disc.on("pointerout", () => {
        disc.setAlpha(1);
      });
    }
  }

  private handleClick(pointer: Phaser.Input.Pointer) {
    const centerX = this.cameras.main.width / 2;

    // Determine which tower was clicked
    let clickedTower = -1;
    for (let i = 0; i < 3; i++) {
      const towerX = centerX + (i - 1) * 250;
      if (Math.abs(pointer.x - towerX) < 125) {
        clickedTower = i;
        break;
      }
    }

    if (clickedTower === -1) return;

    if (this.selectedDisc === null) {
      // Select a disc
      this.selectDiscFromTower(clickedTower);
    } else {
      // Try to move the selected disc
      this.moveDiscToTower(clickedTower);
    }
  }

  private selectDiscFromTower(towerIndex: number) {
    const tower = this.towers[towerIndex];
    if (!tower || tower.length === 0) return;

    const topDisc = tower[tower.length - 1];
    if (!topDisc) return;

    this.selectedDisc = topDisc;
    this.selectedTower = towerIndex;

    // Visual feedback
    topDisc.graphics.lineStyle(3, 0xffffff);
    topDisc.graphics.strokeRect(
      -50,
      -this.DISC_HEIGHT / 2,
      100,
      this.DISC_HEIGHT,
    );
    topDisc.graphics.y -= 10; // Lift the disc slightly
  }

  private moveDiscToTower(targetTower: number) {
    if (this.selectedDisc === null || this.selectedTower === -1) return;

    // Check if move is valid
    if (!this.isValidMove(this.selectedTower, targetTower)) {
      this.deselectDisc();
      return;
    }

    // Remove disc from source tower
    const sourceTower = this.towers[this.selectedTower];
    if (!sourceTower) return;
    const disc = sourceTower.pop();
    if (!disc) return;

    // Add disc to target tower
    const targetTowerArray = this.towers[targetTower];
    if (!targetTowerArray) return;
    targetTowerArray.push(disc);

    // Calculate new position
    const centerX = this.cameras.main.width / 2;
    const baseY = this.cameras.main.height - 100 - this.TOWER_HEIGHT;
    const targetX = centerX + (targetTower - 1) * 250;
    const targetY = baseY - (targetTowerArray.length - 1) * this.DISC_HEIGHT;

    // Animate the move
    this.tweens.add({
      targets: disc.graphics,
      x: targetX,
      y: targetY,
      duration: 300,
      ease: "Power2",
    });

    this.moveCount++;
    this.moveText.setText(`Moves: ${this.moveCount}`);

    this.deselectDisc();
    this.checkWinCondition();
  }

  private isValidMove(fromTower: number, toTower: number): boolean {
    if (fromTower === toTower) return false;

    const sourceTower = this.towers[fromTower];
    const targetTower = this.towers[toTower];

    if (!sourceTower || sourceTower.length === 0) return false;

    const sourceDisc = sourceTower[sourceTower.length - 1];
    if (!sourceDisc) return false;

    if (!targetTower || targetTower.length === 0) return true;

    const targetDisc = targetTower[targetTower.length - 1];
    if (!targetDisc) return false;

    return sourceDisc.size < targetDisc.size;
  }

  private canSelectDisc(disc: Disc): boolean {
    for (let tower of this.towers) {
      if (tower.length > 0 && tower[tower.length - 1] === disc) {
        return true;
      }
    }
    return false;
  }

  private deselectDisc() {
    if (this.selectedDisc) {
      this.selectedDisc.graphics.clear();
      // Redraw the disc
      const discSize = this.selectedDisc.size;
      const discWidth = 40 + discSize * 30;
      const color = this.DISC_COLORS[(4 - discSize) % this.DISC_COLORS.length];
      if (color) {
        this.selectedDisc.graphics.fillStyle(color);
      }
      this.selectedDisc.graphics.fillRoundedRect(
        -discWidth / 2,
        -this.DISC_HEIGHT / 2,
        discWidth,
        this.DISC_HEIGHT,
        5,
      );
      this.selectedDisc = null;
      this.selectedTower = -1;
    }
  }

  private checkWinCondition() {
    // Win condition: all discs are on the rightmost tower
    const rightTower = this.towers[2];
    if (rightTower && rightTower.length === 4) {
      this.winText.setText(
        `You Won!\nMoves: ${this.moveCount}\nClick to restart`,
      );
      this.winText.setInteractive();
      this.winText.on("pointerdown", () => {
        this.scene.restart();
      });
    }
  }
}
