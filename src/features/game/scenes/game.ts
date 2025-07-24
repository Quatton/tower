import { Scene } from "phaser";
import { EventBus } from "../event";

interface Disc {
  container: Phaser.GameObjects.Container;
  graphics: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
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
  private towerLabels: Phaser.GameObjects.Text[] = [];
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
  // RGBCMYKW - High contrast colors for better visibility
  private readonly DISC_COLORS = [
    0xff0000, // Red
    0xffff00, // Yellow
    0x00ff00, // Green
    0x00ffff, // Cyan
    0x0000ff, // Blue
    0xff00ff, // Magenta
    0xffffff, // White
    0x111111, // Black
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

    // Show tower labels initially
    this.showTowerLabels();

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

    // Keyboard input handling
    this.input.keyboard?.on("keydown", this.handleKeyDown, this);

    // Handle resize events
    this.scale.on("resize", this.handleResize, this);

    // Handle scene shutdown for cleanup
    this.events.on("shutdown", this.cleanup, this);

    EventBus.emit("current-scene-ready", this);
  }
  private calculateScaleFactor() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Calculate the minimum height and width required for the game
    const requiredHeight = this.calculateRequiredHeight();
    const requiredWidth = this.calculateRequiredWidth();

    // Define maximum game width to prevent it from becoming too large
    const maxGameWidth = 1200; // Maximum width the game should occupy
    const maxWidthScale = maxGameWidth / requiredWidth;

    // Check if this is likely a mobile device (small screen)
    const isMobile = width < 768 || height < 768;

    // Calculate scale factors based on both width and height constraints
    let widthScale: number;
    let heightScale: number;

    if (isMobile) {
      // Mobile device scaling
      widthScale = width / requiredWidth;
      heightScale = height / requiredHeight;

      // Higher minimum scale for mobile for better usability, but respect max width
      this.scaleFactor = Math.max(
        0.4,
        Math.min(
          Math.min(widthScale, heightScale),
          Math.min(1.8, maxWidthScale),
        ),
      );
    } else {
      // Desktop/tablet scaling
      widthScale = width / requiredWidth;
      heightScale = height / requiredHeight;

      // Standard minimum scale for larger devices, but respect max width
      this.scaleFactor = Math.max(
        0.3,
        Math.min(
          Math.min(widthScale, heightScale),
          Math.min(2.0, maxWidthScale),
        ),
      );
    }
  }

  private calculateRequiredHeight(): number {
    // Calculate the total height needed for the game elements
    const baseDiscHeight = this.BASE_DISC_HEIGHT;
    const basePoleHeight = this.BASE_POLE_HEIGHT;
    const baseTowerHeight = this.BASE_TOWER_HEIGHT;
    const baseMarginBottom = 100; // Base margin at bottom
    const labelSpaceBelow = 40; // Space below tower base for number labels

    // Height for disc stack (with some extra space above)
    const discStackHeight = this.numDiscs * baseDiscHeight;
    const extraSpaceAboveDiscs = 60; // Extra space above the highest disc
    const dynamicPoleHeight = Math.max(
      basePoleHeight,
      discStackHeight + extraSpaceAboveDiscs,
    );

    // Space needed above towers for UI elements
    const spaceForIndicators = 35; // Space for move indicators
    const spaceForGuideArrow = 35; // Space for guide arrow
    const spaceForSelectedDisc = 50; // Space for selected disc
    const spaceForStartHint = 40; // Space for start hint arrow
    const topPadding = 20; // General top padding

    const totalUISpace =
      spaceForIndicators +
      spaceForGuideArrow +
      spaceForSelectedDisc +
      spaceForStartHint +
      topPadding;

    // Total required height (unscaled) - now includes space for labels below tower base
    return (
      baseMarginBottom +
      labelSpaceBelow +
      baseTowerHeight +
      dynamicPoleHeight +
      totalUISpace
    );
  }

  private calculateRequiredWidth(): number {
    // Calculate the total width needed for the game elements
    const baseTowerWidth = this.BASE_TOWER_WIDTH;

    // Calculate the width of the largest disc (largest disc is size numDiscs)
    const largestDiscWidth = 50 + this.numDiscs * 35;

    // We need space for 3 towers, with the largest disc width being the constraint
    // Plus some padding between towers and on the sides
    const sidePadding = 50; // Padding on each side
    const minTowerSpacing = Math.max(baseTowerWidth, largestDiscWidth) + 40; // Minimum spacing between tower centers

    // Total width: side padding + space for 3 towers with 2 gaps between them
    const totalWidth = sidePadding * 2 + minTowerSpacing * 2; // 2 gaps between 3 towers

    // Add the width of towers themselves (center tower position doesn't add width, left and right do)
    const towerWidth = Math.max(baseTowerWidth, largestDiscWidth);

    return totalWidth + towerWidth;
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

    // Show tower labels
    this.showTowerLabels();

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
    // Calculate pole height based on number of discs with some extra space
    const discStackHeight =
      this.numDiscs * this.BASE_DISC_HEIGHT * this.scaleFactor;
    const extraSpace = Math.max(40, 60 * this.scaleFactor); // Extra space above the highest disc
    const dynamicPoleHeight = discStackHeight + extraSpace;

    // Ensure minimum pole height for visual consistency
    const minPoleHeight = this.BASE_POLE_HEIGHT * this.scaleFactor;

    // Include space for labels below tower base
    const labelSpaceBelow = Math.max(30, 40 * this.scaleFactor); // Space for number labels
    const baseMarginBottom = Math.max(50, 100 * this.scaleFactor);

    return {
      towerWidth: this.BASE_TOWER_WIDTH * this.scaleFactor,
      towerHeight: this.BASE_TOWER_HEIGHT * this.scaleFactor,
      poleHeight: Math.max(minPoleHeight, dynamicPoleHeight),
      discHeight: this.BASE_DISC_HEIGHT * this.scaleFactor,
      poleWidth: Math.max(6, 10 * this.scaleFactor),
      marginBottom: baseMarginBottom + labelSpaceBelow, // Now includes space for labels
      towerSpacing: this.getTowerSpacing(),
    };
  }

  private getTowerSpacing(): number {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const isMobile = width < 768 || height < 768;

    // Calculate minimum spacing based on disc and tower sizes
    const baseTowerWidth = this.BASE_TOWER_WIDTH * this.scaleFactor;
    const largestDiscWidth = (50 + this.numDiscs * 35) * this.scaleFactor;
    const minSpacingForDiscs =
      Math.max(baseTowerWidth, largestDiscWidth) + 40 * this.scaleFactor;

    // Calculate available space for towers
    const sidePadding = Math.max(50, 80 * this.scaleFactor);
    const availableWidth = width - sidePadding * 2;

    // Calculate spacing that fits in available width
    // We have 3 towers, so 2 gaps between them
    const maxSpacing = availableWidth / 2; // 2 gaps between 3 towers

    if (isMobile) {
      // On mobile, use tighter spacing but ensure discs don't overlap
      const mobileSpacing = Math.max(
        minSpacingForDiscs * 0.9,
        maxSpacing * 0.8,
      );
      return Math.min(mobileSpacing, maxSpacing);
    } else {
      // Desktop/tablet: prefer wider spacing but respect width constraints
      const desktopSpacing = Math.max(minSpacingForDiscs, width / 5);
      return Math.min(desktopSpacing, maxSpacing);
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
    this.guideArrow.lineStyle(Math.max(2, 3 * this.scaleFactor), 0x555555, 0.3); // Light gray, semi-transparent

    // Draw arrow line
    this.guideArrow.beginPath();
    this.guideArrow.moveTo(leftTowerX + dimensions.towerWidth / 3, arrowY);
    this.guideArrow.lineTo(rightTowerX - dimensions.towerWidth / 3, arrowY);
    this.guideArrow.strokePath();

    // Draw arrow head
    const arrowHeadSize = Math.max(8, 12 * this.scaleFactor);
    const arrowTipX = rightTowerX - dimensions.towerWidth / 3;
    this.guideArrow.fillStyle(0x555555, 0.3); // Same color and opacity
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

      // Create tower keyboard label
      const labelText = this.add
        .text(
          towerX,
          positions.baseY +
            dimensions.towerHeight +
            Math.max(15, 20 * this.scaleFactor),
          (i + 1).toString(),
          {
            fontSize: `${Math.max(14, 18 * this.scaleFactor)}px`,
            color: "#666666",
            fontStyle: "bold",
          },
        )
        .setOrigin(0.5);
      this.towerLabels.push(labelText);
    }
  }

  private getContrastColor(color: number): number {
    // Extract RGB components
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    // Calculate perceived brightness using the luminance formula
    const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

    let contrastR: number, contrastG: number, contrastB: number;

    if (brightness > 0.5) {
      // Light color - make it darker
      contrastR = Math.floor(r * 0.3);
      contrastG = Math.floor(g * 0.3);
      contrastB = Math.floor(b * 0.3);
    } else {
      // Dark color - make it lighter
      contrastR = Math.min(255, Math.floor(r + (255 - r) * 0.7));
      contrastG = Math.min(255, Math.floor(g + (255 - g) * 0.7));
      contrastB = Math.min(255, Math.floor(b + (255 - b) * 0.7));
    }

    // Combine back into a single color value
    return (contrastR << 16) | (contrastG << 8) | contrastB;
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
      const color = this.DISC_COLORS[(discSize - 1) % this.DISC_COLORS.length];
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
      // Add number to the disc
      const discNumber = discSize; // Number corresponds to disc size
      const fontSize = Math.max(12, 16 * this.scaleFactor);

      // Create a contrasting version of the disc color for the text
      const contrastColor = this.getContrastColor(color || 0x888888); // fallback color if undefined

      const numberText = this.add
        .text(0, 0, discNumber.toString(), {
          fontSize: `${fontSize}px`,
          color: `#${contrastColor.toString(16).padStart(6, "0")}`,
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      // Create container to hold both graphics and text
      const discContainer = this.add.container(leftTowerX, discY, [
        disc,
        numberText,
      ]);
      discContainer.setSize(discWidth, dimensions.discHeight);
      discContainer.setInteractive(
        new Phaser.Geom.Rectangle(
          -discWidth / 2,
          -dimensions.discHeight / 2,
          discWidth,
          dimensions.discHeight,
        ),
        Phaser.Geom.Rectangle.Contains,
      );

      const discObj: Disc = {
        container: discContainer,
        graphics: disc,
        text: numberText,
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

    // Hide the default tower labels since we're now showing move indicators
    this.hideTowerLabels();

    // Animate disc to calculated position to avoid overlaps
    const positions = this.getVerticalPositions();
    this.tweens.add({
      targets: topDisc.container,
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
      targets: disc.container,
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
          this.DISC_COLORS[(discSize - 1) % this.DISC_COLORS.length];

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
            targets: this.selectedDisc.container,
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
    this.showTowerLabels(); // Show tower labels
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
    this.towerLabels.forEach((label) => label.destroy());
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
      tower.forEach((disc) => {
        disc.container.destroy();
      });
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
    this.towerLabels = [];
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
      const label = this.towerLabels[i];
      if (!indicator || !label) continue;

      const isValidMove = this.isValidMove(this.selectedTower, i);

      // Show/hide and style the label based on move validity
      if (isValidMove) {
        label.setVisible(true);
        label.setStyle({ color: "#00aa00", fontStyle: "bold" }); // Green for valid moves
      } else {
        label.setVisible(true);
        label.setStyle({ color: "#aa0000", fontStyle: "bold" }); // Red for invalid moves
      }

      indicator.clear();
      indicator.setVisible(true);
      indicator.setPosition(towerX, indicatorY);

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

    // Reset labels to default style and show them again
    this.showTowerLabels();
  }
  private getVerticalPositions() {
    const dimensions = this.getResponsiveDimensions();
    const baseY = this.cameras.main.height - dimensions.marginBottom;

    // Define minimum spacing between elements (scaled appropriately)
    const minSpacing = Math.max(15, 25 * this.scaleFactor);

    // Calculate positions from bottom to top
    const towerTop = baseY - dimensions.poleHeight;
    const indicatorY = towerTop - Math.max(20, 30 * this.scaleFactor); // Small gap from pole top
    const guideArrowY =
      indicatorY - minSpacing - Math.max(10, 15 * this.scaleFactor);

    // Ensure selected disc position has enough space but doesn't go too high
    const availableTopSpace = guideArrowY - minSpacing;
    const selectedDiscY = Math.max(
      30 * this.scaleFactor, // Minimum distance from top
      Math.min(
        availableTopSpace - Math.max(20, 30 * this.scaleFactor),
        60 * this.scaleFactor, // Maximum preferred distance from top
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

  private handleKeyDown(event: KeyboardEvent) {
    // Map keys to tower indices
    const keyToTower: { [key: string]: number } = {
      "1": 0,
      a: 0,
      j: 0, // First tower (left)
      "2": 1,
      s: 1,
      k: 1, // Second tower (middle)
      "3": 2,
      d: 2,
      l: 2, // Third tower (right)
    };

    const key = event.key.toLowerCase();
    const towerIndex = keyToTower[key];

    // Only proceed if it's a valid key
    if (towerIndex === undefined) return;

    // Prevent default behavior for these keys
    event.preventDefault();

    // Handle the tower interaction (same logic as clicking)
    if (this.selectedDisc === null) {
      // Select a disc from the specified tower
      this.selectDiscFromTower(towerIndex);
    } else {
      // Try to move the selected disc to the specified tower
      this.moveDiscToTower(towerIndex);
    }
  }

  private cleanup() {
    // Clean up keyboard event listeners
    if (this.input.keyboard) {
      this.input.keyboard.off("keydown", this.handleKeyDown, this);
    }
  }

  private showTowerLabels() {
    // Show labels when no disc is selected to indicate which keys can be pressed
    this.towerLabels.forEach((label, index) => {
      const tower = this.towers[index];
      if (tower && tower.length > 0) {
        // Tower has discs - show label in green (can select)
        label.setVisible(true);
        label.setStyle({ color: "#00aa00", fontStyle: "bold" });
      } else {
        // Tower is empty - show label in gray (cannot select but visible for reference)
        label.setVisible(true);
        label.setStyle({ color: "#999999", fontStyle: "normal" });
      }
    });
  }

  private hideTowerLabels() {
    this.towerLabels.forEach((label) => {
      label.setVisible(false);
    });
  }
}
