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
  private towerIndicators: Phaser.GameObjects.Graphics[] = [];
  private guideArrow: Phaser.GameObjects.Graphics | null = null;
  private moveCount: number = 0;
  private moveText!: Phaser.GameObjects.Text;
  private winText!: Phaser.GameObjects.Text;
  private scaleFactor: number = 1;
  private numDiscs: number = 4; // Dynamic number of discs
  private startHintArrow: Phaser.GameObjects.Graphics | null = null;
  private readonly BASE_TOWER_WIDTH = 160;
  private readonly BASE_TOWER_HEIGHT = 16;
  private readonly BASE_POLE_HEIGHT = 160;
  private readonly BASE_DISC_HEIGHT = 24; // Increased from 16 to 24
  private readonly DISC_COLORS = [
    0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xff8000,
    0x8000ff, 0x80ff00, 0xff0080,
  ];

  constructor(numDiscs: number = 4) {
    super("Game");
    this.numDiscs = Math.max(1, Math.min(10, numDiscs)); // Limit between 1 and 10 discs
  }

  preload() {}

  create() {
    this.cameras.main.setBackgroundColor(~0);

    // Initialize/reset game state
    this.initializeGameState();

    // Calculate responsive scale factor
    this.calculateScaleFactor();

    // Setup towers
    this.createTowers();
    this.createDiscs(this.numDiscs); // Use dynamic number of discs

    // Create start hint arrow
    this.createStartHintArrow();

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
      .text(this.cameras.main.centerX, this.cameras.main.height * 0.25, "", {
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

    // Check if this is likely a mobile device (small screen)
    const isMobile = width < 768 || height < 768;
    const isLandscape = width > height;

    if (isMobile) {
      // Be more generous with scaling on mobile devices
      if (isLandscape) {
        // Mobile landscape: prioritize using full width, allow tighter spacing
        this.scaleFactor = Math.min(
          width / 750, // More lenient width requirement
          height / 400, // Minimum height for towers
        );
      } else {
        // Mobile portrait: use more of the available space
        this.scaleFactor = Math.min(
          width / 450, // Allow towers to be closer together
          height / 600, // Use more vertical space
        );
      }
      // Higher minimum scale for mobile for better usability
      this.scaleFactor = Math.max(0.6, Math.min(this.scaleFactor, 1.8));
    } else {
      // Desktop/tablet scaling (original logic but more generous)
      if (isLandscape) {
        this.scaleFactor = Math.min(
          width / 900, // Less conservative than before
          height / 500,
        );
      } else {
        this.scaleFactor = Math.min(width / 550, height / 700);
      }
      // Standard minimum scale for larger devices
      this.scaleFactor = Math.max(0.4, Math.min(this.scaleFactor, 2.0));
    }
  }

  private handleResize() {
    this.calculateScaleFactor();

    // Initialize/reset game state and clear objects
    this.initializeGameState();

    // Recreate everything with new scale
    this.createTowers();
    this.createDiscs(this.numDiscs);

    // Recreate start hint arrow
    this.createStartHintArrow();

    // Update UI positions
    const fontSize = Math.max(16, 24 * this.scaleFactor);
    this.moveText.setPosition(10 * this.scaleFactor, 10 * this.scaleFactor);
    this.moveText.setStyle({ fontSize: `${fontSize}px` });

    this.winText.setPosition(
      this.cameras.main.centerX,
      this.cameras.main.height * 0.25,
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
    const height = this.cameras.main.height;
    const isMobile = width < 768 || height < 768;
    const isLandscape = width > height;

    if (isMobile) {
      // On mobile, distribute towers more evenly across screen width
      // Use a larger portion of screen width with padding on sides
      if (isLandscape) {
        // Mobile landscape: use ~70% of screen width for the 3 towers
        return Math.max(180 * this.scaleFactor, width * 0.35);
      } else {
        // Mobile portrait: use ~60% of screen width for better separation
        return Math.max(150 * this.scaleFactor, width * 0.3);
      }
    } else {
      // Desktop/tablet spacing - more conservative
      if (isLandscape) {
        return Math.min(250 * this.scaleFactor, width / 4);
      } else {
        return Math.min(200 * this.scaleFactor, width / 4);
      }
    }
  }

  private createTowers() {
    const centerX = this.cameras.main.width / 2;
    const dimensions = this.getResponsiveDimensions();
    const positions = this.getVerticalPositions();

    // Create subtle guide arrow from first to last tower
    const leftTowerX = centerX - dimensions.towerSpacing;
    const rightTowerX = centerX + dimensions.towerSpacing;
    const arrowY = positions.guideArrowY; // Use calculated position

    this.guideArrow = this.add.graphics();
    this.guideArrow.lineStyle(Math.max(2, 3 * this.scaleFactor), 0xcccccc, 0.3); // Light gray, semi-transparent

    // Draw arrow line
    this.guideArrow.beginPath();
    this.guideArrow.moveTo(leftTowerX + dimensions.towerWidth / 3, arrowY);
    this.guideArrow.lineTo(rightTowerX - dimensions.towerWidth / 3, arrowY);
    this.guideArrow.strokePath();

    // Draw arrow head
    const arrowHeadSize = Math.max(8, 12 * this.scaleFactor);
    const arrowTipX = rightTowerX - dimensions.towerWidth / 3;
    this.guideArrow.fillStyle(0xcccccc, 0.3); // Same color and opacity
    this.guideArrow.beginPath();
    this.guideArrow.moveTo(arrowTipX, arrowY);
    this.guideArrow.lineTo(
      arrowTipX - arrowHeadSize,
      arrowY - arrowHeadSize / 2,
    );
    this.guideArrow.lineTo(
      arrowTipX - arrowHeadSize,
      arrowY + arrowHeadSize / 2,
    );
    this.guideArrow.closePath();
    this.guideArrow.fillPath();

    for (let i = 0; i < 3; i++) {
      const towerX = centerX + (i - 1) * dimensions.towerSpacing;

      // Create tower base
      const base = this.add.graphics();
      // Use different colors for the last tower (goal tower)
      const baseColor = i === 2 ? 0x32cd32 : 0x8b4513; // Bright lime green for goal, brown for others
      base.fillStyle(baseColor);
      base.fillRect(
        towerX - dimensions.towerWidth / 2,
        positions.baseY,
        dimensions.towerWidth,
        dimensions.towerHeight,
      );
      this.towerBases.push(base);

      // Create tower pole
      const pole = this.add.graphics();
      // Use different colors for the last tower (goal tower)
      const poleColor = i === 2 ? 0x228b22 : 0x654321; // Forest green for goal pole, darker brown for others
      pole.fillStyle(poleColor);
      pole.fillRect(
        towerX - dimensions.poleWidth / 2,
        positions.baseY - dimensions.poleHeight,
        dimensions.poleWidth,
        dimensions.poleHeight,
      );
      this.towerPoles.push(pole);

      // Create tower indicator (initially hidden)
      const indicator = this.add.graphics();
      indicator.setVisible(false);
      this.towerIndicators.push(indicator);
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
      const discWidth = (50 + discSize * 35) * this.scaleFactor; // Increased from (30 + discSize * 25)
      const discY = baseY - i * dimensions.discHeight;

      const disc = this.add.graphics();
      const color = this.DISC_COLORS[i % this.DISC_COLORS.length];
      const strokeWidth = Math.max(2, 4 * this.scaleFactor);

      // Add stroke for better contrast
      disc.lineStyle(strokeWidth, 0x000000);
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
      disc.strokeRoundedRect(
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

      // Add number to the disc
      const discNumber = discSize; // Number corresponds to disc size
      const fontSize = Math.max(12, 16 * this.scaleFactor);
      
      // Create a darker version of the disc color for the text
      const darkerColor = this.getDarkerColor(color);
      
      const numberText = this.add.text(leftTowerX, discY, discNumber.toString(), {
        fontSize: `${fontSize}px`,
        color: `#${darkerColor.toString(16).padStart(6, '0')}`,
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const discObj: Disc = {
        graphics: disc,
        size: discSize,
        originalY: discY,
      };

      this.towers[0]?.push(discObj);
    }
  }

  private handleClick(pointer: Phaser.Input.Pointer) {
    const centerX = this.cameras.main.width / 2;
    const dimensions = this.getResponsiveDimensions();

    // Determine which tower was clicked
    let clickedTower = -1;
    for (let i = 0; i < 3; i++) {
      const towerX = centerX + (i - 1) * dimensions.towerSpacing;
      // Make click zone more generous, especially on mobile
      const width = this.cameras.main.width;
      const isMobile = width < 768;
      const baseClickZone = isMobile ? 120 : 100;
      const clickZone = Math.max(
        baseClickZone * this.scaleFactor,
        dimensions.towerSpacing / 2.2, // Slightly smaller than half spacing to avoid overlap
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

    // If this disc is already selected, don't do anything
    if (this.selectedDisc === topDisc) return;

    // Deselect any previously selected disc first
    this.deselectDisc();

    this.selectedDisc = topDisc;
    this.selectedTower = towerIndex;

    // Hide start hint arrow after first selection
    this.hideStartHintArrow();

    // Animate disc to calculated position to avoid overlaps
    const positions = this.getVerticalPositions();
    this.tweens.add({
      targets: topDisc.graphics,
      x: this.cameras.main.centerX,
      y: positions.selectedDiscY,
      duration: 200,
      ease: "Power2",
    });

    // Show move indicators
    this.showMoveIndicators();
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
      onComplete: () => {
        // Redraw the disc with normal black stroke after move
        disc.graphics.clear();
        const discSize = disc.size;
        const discWidth = (50 + discSize * 35) * this.scaleFactor; // Updated to match createDiscs
        const dimensions = this.getResponsiveDimensions();
        const strokeWidth = Math.max(2, 4 * this.scaleFactor);
        const color =
          this.DISC_COLORS[
            (this.numDiscs - discSize) % this.DISC_COLORS.length
          ];

        // Add normal black stroke
        disc.graphics.lineStyle(strokeWidth, 0x000000);
        if (color) {
          disc.graphics.fillStyle(color);
        }
        disc.graphics.fillRoundedRect(
          -discWidth / 2,
          -dimensions.discHeight / 2,
          discWidth,
          dimensions.discHeight,
          5 * this.scaleFactor,
        );
        disc.graphics.strokeRoundedRect(
          -discWidth / 2,
          -dimensions.discHeight / 2,
          discWidth,
          dimensions.discHeight,
          5 * this.scaleFactor,
        );
      },
    });

    this.moveCount++;
    this.moveText.setText(`Moves: ${this.moveCount}`);

    // Hide start hint arrow after first move
    if (this.moveCount === 1) {
      this.hideStartHintArrow();
    }

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
    // Hide move indicators first
    this.hideMoveIndicators();

    if (this.selectedDisc && this.selectedTower !== -1) {
      // Find the correct position for this disc in its current tower
      const currentTower = this.towers[this.selectedTower];
      if (currentTower) {
        const discIndex = currentTower.indexOf(this.selectedDisc);
        if (discIndex !== -1) {
          // Calculate correct position
          const centerX = this.cameras.main.width / 2;
          const dimensions = this.getResponsiveDimensions();
          const baseY =
            this.cameras.main.height -
            dimensions.marginBottom -
            dimensions.towerHeight;
          const correctX =
            centerX + (this.selectedTower - 1) * dimensions.towerSpacing;
          const correctY = baseY - discIndex * dimensions.discHeight;

          // Animate back to correct position
          this.tweens.add({
            targets: this.selectedDisc.graphics,
            x: correctX,
            y: correctY,
            duration: 200,
            ease: "Power2",
          });
        }
      }

      this.selectedDisc = null;
      this.selectedTower = -1;
    }
  }

  private checkWinCondition() {
    // Win condition: all discs are on the rightmost tower
    const rightTower = this.towers[2];
    if (rightTower && rightTower.length === this.numDiscs) {
      this.winText.setText(
        `🎉 You Won! 🎉\nMoves: ${this.moveCount}\n\nCongratulations!`,
      );

      // Create a restart button instead of making entire screen clickable
      const buttonWidth = Math.max(120, 150 * this.scaleFactor);
      const buttonHeight = Math.max(40, 50 * this.scaleFactor);
      const buttonX = this.cameras.main.centerX;
      const buttonY = this.cameras.main.height * 0.5; // More gap from win text

      // Create button background
      const restartButton = this.add.graphics();
      restartButton.fillStyle(0x4f46e5); // Nice blue color
      restartButton.fillRoundedRect(
        -buttonWidth / 2,
        -buttonHeight / 2,
        buttonWidth,
        buttonHeight,
        8 * this.scaleFactor,
      );
      restartButton.setPosition(buttonX, buttonY);
      restartButton.setInteractive(
        new Phaser.Geom.Rectangle(
          -buttonWidth / 2,
          -buttonHeight / 2,
          buttonWidth,
          buttonHeight,
        ),
        Phaser.Geom.Rectangle.Contains,
      );

      // Add button text
      const buttonText = this.add
        .text(buttonX, buttonY, "Play Again", {
          fontSize: `${Math.max(16, 20 * this.scaleFactor)}px`,
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      // Button hover effects
      restartButton.on("pointerover", () => {
        restartButton.clear();
        restartButton.fillStyle(0x3730a3); // Darker blue on hover
        restartButton.fillRoundedRect(
          -buttonWidth / 2,
          -buttonHeight / 2,
          buttonWidth,
          buttonHeight,
          8 * this.scaleFactor,
        );
      });

      restartButton.on("pointerout", () => {
        restartButton.clear();
        restartButton.fillStyle(0x4f46e5); // Original blue
        restartButton.fillRoundedRect(
          -buttonWidth / 2,
          -buttonHeight / 2,
          buttonWidth,
          buttonHeight,
          8 * this.scaleFactor,
        );
      });

      // Button click handler
      restartButton.on("pointerdown", () => {
        restartButton.destroy();
        buttonText.destroy();
        this.scene.restart();
      });
    }
  }

  public setNumDiscs(numDiscs: number) {
    this.numDiscs = Math.max(1, Math.min(10, numDiscs)); // Limit between 1 and 10 discs
    this.restartGame();
  }

  private restartGame() {
    this.initializeGameState();

    // Recreate game elements
    this.createTowers();
    this.createDiscs(this.numDiscs);
    this.createStartHintArrow(); // Recreate start hint arrow
    this.moveText.setText("Moves: 0");
    this.winText.setText("");

    // Restore normal input handling (in case we were in win state)
    this.input.off("pointerdown");
    this.input.on("pointerdown", this.handleClick, this);
  }

  private initializeGameState() {
    // Clear any existing objects BEFORE resetting the arrays
    this.towerBases.forEach((base) => base.destroy());
    this.towerPoles.forEach((pole) => pole.destroy());
    this.towerIndicators.forEach((indicator) => indicator.destroy());
    if (this.guideArrow) {
      this.guideArrow.destroy();
      this.guideArrow = null;
    }
    if (this.startHintArrow) {
      this.tweens.killTweensOf(this.startHintArrow);
      this.startHintArrow.destroy();
      this.startHintArrow = null;
    }
    this.towers.forEach((tower) => {
      tower.forEach((disc) => disc.graphics.destroy());
    });

    // Reset game state
    this.towers = [[], [], []];
    this.selectedDisc = null;
    this.selectedTower = -1;
    this.moveCount = 0;

    // Reset arrays
    this.towerBases = [];
    this.towerPoles = [];
    this.towerIndicators = [];
  }

  private showMoveIndicators() {
    if (this.selectedDisc === null || this.selectedTower === -1) return;

    const centerX = this.cameras.main.width / 2;
    const dimensions = this.getResponsiveDimensions();
    const positions = this.getVerticalPositions();
    const indicatorSize = Math.max(20, 30 * this.scaleFactor);
    const strokeWidth = Math.max(2, 3 * this.scaleFactor); // Reduced stroke thickness

    for (let i = 0; i < 3; i++) {
      const towerX = centerX + (i - 1) * dimensions.towerSpacing;
      const indicatorY = positions.indicatorY;

      const indicator = this.towerIndicators[i];
      if (!indicator) continue;

      indicator.clear();
      indicator.setVisible(true);
      indicator.setPosition(towerX, indicatorY);

      const isValidMove = this.isValidMove(this.selectedTower, i);

      if (isValidMove) {
        // Draw green arrow (pointing down)
        indicator.lineStyle(strokeWidth, 0x000000); // Black border
        indicator.fillStyle(0x00ff00); // Green fill

        // Arrow shape (pointing down) - fixed direction
        indicator.beginPath();
        indicator.moveTo(0, indicatorSize / 2); // Point at bottom
        indicator.lineTo(-indicatorSize / 3, indicatorSize / 6);
        indicator.lineTo(-indicatorSize / 6, indicatorSize / 6);
        indicator.lineTo(-indicatorSize / 6, -indicatorSize / 2);
        indicator.lineTo(indicatorSize / 6, -indicatorSize / 2);
        indicator.lineTo(indicatorSize / 6, indicatorSize / 6);
        indicator.lineTo(indicatorSize / 3, indicatorSize / 6);
        indicator.closePath();
        indicator.fillPath();
        indicator.strokePath();
      } else {
        // Draw red filled circle with white X
        indicator.fillStyle(0xff0000); // Red fill for circle

        // Draw filled red circle with red stroke
        indicator.fillCircle(0, 0, indicatorSize / 2);
        indicator.lineStyle(strokeWidth, 0xff0000); // Red stroke for circle
        indicator.strokeCircle(0, 0, indicatorSize / 2);

        // Draw white X lines with proper padding inside the circle
        const padding = Math.max(6, 8 * this.scaleFactor); // More padding from circle edge
        const halfSize = indicatorSize / 2 - padding;
        indicator.lineStyle(Math.max(2, 3 * this.scaleFactor), 0xffffff); // White X lines for contrast

        indicator.beginPath();
        indicator.moveTo(-halfSize, -halfSize);
        indicator.lineTo(halfSize, halfSize);
        indicator.moveTo(halfSize, -halfSize);
        indicator.lineTo(-halfSize, halfSize);
        indicator.strokePath();
      }
    }
  }

  private hideMoveIndicators() {
    this.towerIndicators.forEach((indicator) => {
      indicator.setVisible(false);
      indicator.clear();
    });
  }
  private getVerticalPositions() {
    const dimensions = this.getResponsiveDimensions();
    const baseY = this.cameras.main.height - dimensions.marginBottom;

    // Define minimum spacing between elements
    const minSpacing = Math.max(20, 30 * this.scaleFactor);

    // Calculate positions from bottom to top
    const towerTop = baseY - dimensions.poleHeight;
    const indicatorY = towerTop - Math.max(25, 35 * this.scaleFactor); // Small gap from pole top
    const guideArrowY =
      indicatorY - minSpacing - Math.max(15, 20 * this.scaleFactor);
    const selectedDiscY = Math.max(
      50,
      Math.min(
        guideArrowY - minSpacing - Math.max(30, 40 * this.scaleFactor),
        80 * this.scaleFactor,
      ),
    );

    return {
      baseY,
      towerTop,
      indicatorY,
      guideArrowY,
      selectedDiscY,
      minSpacing,
    };
  }

  private createStartHintArrow() {
    // Only show if no moves have been made yet
    if (this.moveCount > 0) return;

    const centerX = this.cameras.main.width / 2;
    const dimensions = this.getResponsiveDimensions();
    const leftTowerX = centerX - dimensions.towerSpacing;
    const positions = this.getVerticalPositions();

    // Position the arrow at the top left of the first pole with some margin
    const margin = Math.max(20, 30 * this.scaleFactor);
    const arrowX = leftTowerX - dimensions.poleWidth / 2 - margin;
    const arrowY = positions.towerTop - margin;

    this.startHintArrow = this.add.graphics();
    this.startHintArrow.fillStyle(0xff0000); // Red fill

    // Draw arrow pointing 45 degrees to bottom right (bigger size)
    const arrowSize = Math.max(10, 12 * this.scaleFactor); // Increased size
    const arrowHead = Math.max(8, 12 * this.scaleFactor); // Increased head size
    const shaftThickness = Math.max(8, 12 * this.scaleFactor); // Thicker shaft width

    // Arrow line at 45 degree angle (pointing to bottom right)
    const lineLength = arrowSize;
    const endX = lineLength * Math.cos(Math.PI / 4); // 45 degrees in radians
    const endY = lineLength * Math.sin(Math.PI / 4);

    // Draw thick arrow shaft using a filled rectangle rotated at 45 degrees
    const angle = Math.PI / 4; // 45 degrees

    // Calculate the four corners of the thick shaft rectangle
    const halfThickness = shaftThickness / 2;

    // Perpendicular vector to the arrow direction (for thickness)
    const perpX = -Math.sin(angle) * halfThickness;
    const perpY = Math.cos(angle) * halfThickness;

    // Four corners of the shaft rectangle
    const corner1X = 0 + perpX;
    const corner1Y = 0 + perpY;
    const corner2X = 0 - perpX;
    const corner2Y = 0 - perpY;
    const corner3X = endX - perpX;
    const corner3Y = endY - perpY;
    const corner4X = endX + perpX;
    const corner4Y = endY + perpY;

    // Draw the thick shaft as a filled polygon
    this.startHintArrow.beginPath();
    this.startHintArrow.moveTo(corner1X, corner1Y);
    this.startHintArrow.lineTo(corner2X, corner2Y);
    this.startHintArrow.lineTo(corner3X, corner3Y);
    this.startHintArrow.lineTo(corner4X, corner4Y);
    this.startHintArrow.closePath();
    this.startHintArrow.fillPath();

    // Triangle/polygon arrow head (taller tip)
    const headAngle = Math.PI / 4; // 45 degrees

    // Make the arrow head longer/taller by increasing the distance from tip to base
    const headLength = arrowHead * 2; // Make it 80% longer for a more elongated tip

    // Calculate the three points of the triangle arrow head
    const tipX = endX + headLength / 2;
    const tipY = endY + headLength / 2;

    // Left point of triangle base
    const leftX = endX - (headLength / 2) * Math.cos(headAngle - Math.PI / 3);
    const leftY = endY - (headLength / 2) * Math.sin(headAngle - Math.PI / 3);

    // Right point of triangle base
    const rightX = endX - (headLength / 2) * Math.cos(headAngle + Math.PI / 3);
    const rightY = endY - (headLength / 2) * Math.sin(headAngle + Math.PI / 3);

    // Draw filled triangle arrow head
    this.startHintArrow.beginPath();
    this.startHintArrow.moveTo(tipX, tipY);
    this.startHintArrow.lineTo(leftX, leftY);
    this.startHintArrow.lineTo(rightX, rightY);
    this.startHintArrow.closePath();
    this.startHintArrow.fillPath();

    this.startHintArrow.setPosition(arrowX, arrowY);

    // Add oscillating animation (bigger movement to match larger arrow)
    this.tweens.add({
      targets: this.startHintArrow,
      x: arrowX + Math.max(8, 12 * this.scaleFactor), // Increased oscillation
      y: arrowY + Math.max(8, 12 * this.scaleFactor), // Increased oscillation
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private hideStartHintArrow() {
    if (this.startHintArrow) {
      this.tweens.killTweensOf(this.startHintArrow); // Stop any running animations
      this.startHintArrow.destroy();
      this.startHintArrow = null;
    }
  }
}
