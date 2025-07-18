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
  private scaleFactor: number = 1;
  private readonly BASE_TOWER_WIDTH = 160;
  private readonly BASE_TOWER_HEIGHT = 16;
  private readonly BASE_POLE_HEIGHT = 160;
  private readonly BASE_DISC_HEIGHT = 16;
  private readonly DISC_COLORS = [
    0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff,
  ];

  constructor() {
    super("Game");
  }

  preload() {}

  create() {
    this.cameras.main.setBackgroundColor(~0);

    // Calculate responsive scale factor
    this.calculateScaleFactor();

    // Setup towers
    this.createTowers();
    this.createDiscs(4); // Start with 4 discs

    // UI
    const fontSize = Math.max(16, 24 * this.scaleFactor);
    this.moveText = this.add.text(
      10 * this.scaleFactor,
      10 * this.scaleFactor,
      "Moves: 0",
      {
        fontSize: `${fontSize}px`,
        color: "#000000",
      },
    );

    this.winText = this.add
      .text(this.cameras.main.centerX, this.cameras.main.height * 0.15, "", {
        fontSize: `${Math.max(20, 32 * this.scaleFactor)}px`,
        color: "#000000",
      })
      .setOrigin(0.5);

    // Input handling
    this.input.on("pointerdown", this.handleClick, this);

    // Handle resize events
    this.scale.on("resize", this.handleResize, this);

    EventBus.emit("current-scene-ready", this);
  }

  private calculateScaleFactor() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Base the scale on the smaller dimension to ensure everything fits
    const minDimension = Math.min(width, height);

    // For landscape orientation, also consider width constraints
    const isLandscape = width > height;

    if (isLandscape) {
      // In landscape, we have more horizontal space but less vertical
      this.scaleFactor = Math.min(
        width / 1024, // Base width assumption
        height / 600, // Minimum height needed
        minDimension / 400,
      );
    } else {
      // In portrait, stack towers vertically or adjust layout
      this.scaleFactor = Math.min(
        width / 600, // Minimum width for 3 towers
        height / 800, // More height available in portrait
        minDimension / 400,
      );
    }

    // Ensure minimum scale for usability
    this.scaleFactor = Math.max(0.3, Math.min(this.scaleFactor, 2.0));
  }

  private handleResize() {
    this.calculateScaleFactor();

    // Clear existing objects
    this.towerBases.forEach((base) => base.destroy());
    this.towerPoles.forEach((pole) => pole.destroy());
    this.towers.forEach((tower) => {
      tower.forEach((disc) => disc.graphics.destroy());
    });

    // Reset arrays
    this.towerBases = [];
    this.towerPoles = [];
    this.towers = [[], [], []];
    this.selectedDisc = null;
    this.selectedTower = -1;

    // Recreate everything with new scale
    this.createTowers();
    this.createDiscs(4);

    // Update UI positions
    const fontSize = Math.max(16, 24 * this.scaleFactor);
    this.moveText.setPosition(10 * this.scaleFactor, 10 * this.scaleFactor);
    this.moveText.setStyle({ fontSize: `${fontSize}px` });

    this.winText.setPosition(
      this.cameras.main.centerX,
      this.cameras.main.height * 0.15,
    );
    this.winText.setStyle({
      fontSize: `${Math.max(20, 32 * this.scaleFactor)}px`,
    });
  }

  private getResponsiveDimensions() {
    return {
      towerWidth: this.BASE_TOWER_WIDTH * this.scaleFactor,
      towerHeight: this.BASE_TOWER_HEIGHT * this.scaleFactor,
      poleHeight: this.BASE_POLE_HEIGHT * this.scaleFactor,
      discHeight: this.BASE_DISC_HEIGHT * this.scaleFactor,
      poleWidth: Math.max(6, 10 * this.scaleFactor),
      marginBottom: Math.max(50, 100 * this.scaleFactor),
      towerSpacing: this.getTowerSpacing(),
    };
  }

  private getTowerSpacing(): number {
    const width = this.cameras.main.width;
    const isLandscape = width > this.cameras.main.height;

    if (isLandscape) {
      // In landscape, spread towers horizontally
      return Math.min(250 * this.scaleFactor, width / 4);
    } else {
      // In portrait, reduce spacing or stack differently
      return Math.min(200 * this.scaleFactor, width / 4);
    }
  }

  private createTowers() {
    const centerX = this.cameras.main.width / 2;
    const dimensions = this.getResponsiveDimensions();
    const baseY = this.cameras.main.height - dimensions.marginBottom;

    for (let i = 0; i < 3; i++) {
      const towerX = centerX + (i - 1) * dimensions.towerSpacing;

      // Create tower base
      const base = this.add.graphics();
      base.fillStyle(0x8b4513);
      base.fillRect(
        towerX - dimensions.towerWidth / 2,
        baseY,
        dimensions.towerWidth,
        dimensions.towerHeight,
      );
      this.towerBases.push(base);

      // Create tower pole
      const pole = this.add.graphics();
      pole.fillStyle(0x654321);
      pole.fillRect(
        towerX - dimensions.poleWidth / 2,
        baseY - dimensions.poleHeight,
        dimensions.poleWidth,
        dimensions.poleHeight,
      );
      this.towerPoles.push(pole);
    }
  }

  private createDiscs(numDiscs: number) {
    const centerX = this.cameras.main.width / 2;
    const dimensions = this.getResponsiveDimensions();
    const baseY =
      this.cameras.main.height -
      dimensions.marginBottom -
      dimensions.towerHeight;
    const leftTowerX = centerX - dimensions.towerSpacing;

    // Create discs on the leftmost tower
    for (let i = 0; i < numDiscs; i++) {
      const discSize = numDiscs - i; // Largest disc at bottom
      const discWidth = (30 + discSize * 25) * this.scaleFactor;
      const discY = baseY - i * dimensions.discHeight;

      const disc = this.add.graphics();
      const color = this.DISC_COLORS[i % this.DISC_COLORS.length];
      if (color) {
        disc.fillStyle(color);
      }
      disc.fillRoundedRect(
        -discWidth / 2,
        -dimensions.discHeight / 2,
        discWidth,
        dimensions.discHeight,
        5 * this.scaleFactor,
      );
      disc.setPosition(leftTowerX, discY);
      disc.setInteractive(
        new Phaser.Geom.Rectangle(
          -discWidth / 2,
          -dimensions.discHeight / 2,
          discWidth,
          dimensions.discHeight,
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
    const dimensions = this.getResponsiveDimensions();

    // Determine which tower was clicked
    let clickedTower = -1;
    for (let i = 0; i < 3; i++) {
      const towerX = centerX + (i - 1) * dimensions.towerSpacing;
      const clickZone = Math.max(
        100 * this.scaleFactor,
        dimensions.towerSpacing / 2,
      );
      if (Math.abs(pointer.x - towerX) < clickZone) {
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
    const dimensions = this.getResponsiveDimensions();
    const strokeWidth = Math.max(2, 3 * this.scaleFactor);
    const highlightSize = Math.max(40, 60 * this.scaleFactor);

    topDisc.graphics.lineStyle(strokeWidth, 0xffffff);
    topDisc.graphics.strokeRect(
      -highlightSize,
      -dimensions.discHeight / 2,
      highlightSize * 2,
      dimensions.discHeight,
    );
    topDisc.graphics.y -= 10 * this.scaleFactor; // Lift the disc slightly
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
    const dimensions = this.getResponsiveDimensions();
    const baseY =
      this.cameras.main.height -
      dimensions.marginBottom -
      dimensions.towerHeight;
    const targetX = centerX + (targetTower - 1) * dimensions.towerSpacing;
    const targetY =
      baseY - (targetTowerArray.length - 1) * dimensions.discHeight;

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
      const discWidth = (30 + discSize * 25) * this.scaleFactor;
      const dimensions = this.getResponsiveDimensions();
      const color = this.DISC_COLORS[(4 - discSize) % this.DISC_COLORS.length];
      if (color) {
        this.selectedDisc.graphics.fillStyle(color);
      }
      this.selectedDisc.graphics.fillRoundedRect(
        -discWidth / 2,
        -dimensions.discHeight / 2,
        discWidth,
        dimensions.discHeight,
        5 * this.scaleFactor,
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
