/**
 * ScoreboardScreen — The "home base" jumbotron screen.
 *
 * Renders live game state as a dot matrix scoreboard:
 * - Team names
 * - Scores (large digits)
 * - Inning
 * - Ball/Strike/Out count (lit/unlit indicator dots)
 * - Base diamond
 *
 * Layout (128x64 grid):
 *   Row 0-1:   (padding)
 *   Row 2-8:   Away team name + score
 *   Row 10-16: Home team name + score
 *   Row 18:    Divider line
 *   Row 20-31: Inning display (large)
 *   Row 34-40: B: ●●○  S: ●○  O: ●○
 *   Row 42-58: Base diamond graphic
 */

export class ScoreboardScreen {
  static id = 'scoreboard';
  static name = 'Scoreboard';
  static duration = Infinity; // Stays until explicitly changed

  constructor(matrix) {
    this.matrix = matrix;
    this._blinkState = false;
    this._blinkTimer = 0;
  }

  render(gameState, deltaTime = 0) {
    const m = this.matrix;
    m.clear();

    const {
      awayTeam = 'AWAY',
      homeTeam = 'HOME',
      awayScore = 0,
      homeScore = 0,
      inning = 1,
      inningHalf = 'top', // 'top' or 'bottom'
      balls = 0,
      strikes = 0,
      outs = 0,
      bases = [false, false, false], // [1st, 2nd, 3rd]
    } = gameState;

    // Blink timer (for colon separator, active inning indicator)
    this._blinkTimer += deltaTime;
    if (this._blinkTimer > 500) {
      this._blinkState = !this._blinkState;
      this._blinkTimer = 0;
    }

    const amber = [255, 200, 50];
    const white = [220, 220, 220];
    const dimWhite = [80, 80, 80];
    const green = [50, 255, 80];
    const yellow = [255, 255, 50];
    const red = [255, 60, 60];

    // --- Team names and scores ---
    // Away team
    m.drawText(awayTeam.substring(0, 8), 2, 2, white);
    m.drawScore(awayScore, 70, 1, amber);

    // Home team
    m.drawText(homeTeam.substring(0, 8), 2, 14, white);
    m.drawScore(homeScore, 70, 13, amber);

    // Divider line
    for (let col = 0; col < m.cols; col++) {
      m.setDot(col, 26, 60, 60, 60, 0.3);
    }

    // --- Inning ---
    m.drawText('INN', 92, 2, dimWhite);

    // Inning half indicator (triangle)
    if (inningHalf === 'top') {
      // Up triangle
      m.setDot(105, 10, ...amber);
      m.setDot(104, 11, ...amber);
      m.setDot(105, 11, ...amber);
      m.setDot(106, 11, ...amber);
    } else {
      // Down triangle
      m.setDot(104, 10, ...amber);
      m.setDot(105, 10, ...amber);
      m.setDot(106, 10, ...amber);
      m.setDot(105, 11, ...amber);
    }

    m.drawScore(inning, 96, 10, amber);

    // --- Count: B S O ---
    this._drawCount(m, 2, 29, 'B', balls, 4, green);
    this._drawCount(m, 2, 37, 'S', strikes, 3, yellow);
    this._drawCount(m, 2, 45, 'O', outs, 3, red);

    // --- Base diamond ---
    this._drawDiamond(m, 95, 30, bases, amber);

    // --- Bottom border accent ---
    for (let col = 0; col < m.cols; col++) {
      if (col % 4 < 2) {
        m.setDot(col, m.rows - 1, 40, 40, 40, 0.2);
      }
    }
  }

  _drawCount(matrix, col, row, label, count, max, color) {
    matrix.drawText(label, col, row, [150, 150, 150]);

    const startCol = col + 8;
    for (let i = 0; i < max; i++) {
      const lit = i < count;
      const dotColor = lit ? color : [35, 35, 35];
      const brightness = lit ? 1.0 : 0.25;

      // Draw a 3x3 dot with rounded corners (skip corners)
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          const isCorner = (dx === 0 || dx === 2) && (dy === 0 || dy === 2);
          if (!isCorner) {
            matrix.setDot(startCol + i * 5 + dx, row + dy + 1, ...dotColor, brightness);
          }
        }
      }
    }
  }

  _drawDiamond(matrix, centerCol, centerRow, bases, color) {
    const dim = [35, 35, 35];
    const dimBright = 0.25;

    // Diamond shape: 4 bases in a diamond layout
    // 2nd base (top)
    const positions = [
      { dc: 0, dr: -8, on: bases[1], label: '2B' },  // 2nd
      { dc: 8, dr: 0, on: bases[0], label: '1B' },    // 1st (right)
      { dc: -8, dr: 0, on: bases[2], label: '3B' },   // 3rd (left)
      { dc: 0, dr: 8, on: false, label: 'HP' },       // Home (always dim)
    ];

    // Draw base paths (connecting lines)
    for (let i = 0; i < 8; i++) {
      // Top-right path (2nd to 1st)
      matrix.setDot(centerCol + i, centerRow - 8 + i, 40, 40, 40, 0.15);
      // Top-left path (2nd to 3rd)
      matrix.setDot(centerCol - i, centerRow - 8 + i, 40, 40, 40, 0.15);
      // Bottom-right path (1st to home)
      matrix.setDot(centerCol + 8 - i, centerRow + i, 40, 40, 40, 0.15);
      // Bottom-left path (3rd to home)
      matrix.setDot(centerCol - 8 + i, centerRow + i, 40, 40, 40, 0.15);
    }

    // Draw bases (4x4 squares, rotated 45deg simulated)
    for (const pos of positions) {
      const baseColor = pos.on ? color : dim;
      const bright = pos.on ? 1.0 : dimBright;

      const bc = centerCol + pos.dc;
      const br = centerRow + pos.dr;

      // 3x3 filled square for each base
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          matrix.setDot(bc + dx, br + dy, ...baseColor, bright);
        }
      }
    }
  }
}
