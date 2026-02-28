/**
 * Jumbotron — Dot matrix display controller.
 *
 * Manages the DotMatrixDisplay canvas, screen rotation,
 * and transitions between jumbotron screens.
 *
 * Unlike other effects, the Jumbotron is persistent — it starts
 * when the game screen mounts and runs continuously.
 */
import { DotMatrixDisplay } from './core/DotMatrixDisplay.js';
import { ScoreboardScreen } from './screens/Scoreboard.js';

export class Jumbotron {
  constructor(canvas, opts = {}) {
    this.matrix = new DotMatrixDisplay(canvas, opts);
    this.screens = new Map();
    this.activeScreen = null;
    this.gameState = {};
    this.rafId = null;
    this.running = false;
  }

  /**
   * Register a screen class
   */
  addScreen(ScreenClass) {
    const screen = new ScreenClass(this.matrix);
    this.screens.set(ScreenClass.id, screen);
    return this; // Chainable
  }

  /**
   * Update game state (called from main app on websocket events)
   */
  updateGameState(state) {
    this.gameState = { ...this.gameState, ...state };
  }

  /**
   * Switch to a screen by ID
   */
  async switchTo(screenId, transition = 'cut') {
    const next = this.screens.get(screenId);
    if (!next) {
      console.warn(`Jumbotron: unknown screen "${screenId}"`);
      return;
    }

    if (transition === 'wipe' && this.activeScreen) {
      await this._wipeTransition();
    }

    this.activeScreen = next;
  }

  /**
   * Wipe transition: dark sweep across the grid
   */
  async _wipeTransition() {
    const cols = this.matrix.cols;
    const step = 4;

    for (let col = 0; col < cols; col += step) {
      for (let row = 0; row < this.matrix.rows; row++) {
        for (let dc = 0; dc < step && col + dc < cols; dc++) {
          this.matrix.setDot(col + dc, row, 0, 0, 0, 0);
        }
      }
      this.matrix.render();
      await new Promise(r => setTimeout(r, 8));
    }
  }

  /**
   * Start the render loop
   */
  start() {
    if (this.running) return;
    this.running = true;
    let lastTime = performance.now();

    const loop = (now) => {
      if (!this.running) return;

      const dt = now - lastTime;
      lastTime = now;

      if (this.activeScreen) {
        this.activeScreen.render(this.gameState, dt);
        this.matrix.render();
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  /**
   * Stop the render loop
   */
  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Resize the display (when params change in workbench)
   */
  resize(opts) {
    this.stop();
    this.matrix = new DotMatrixDisplay(this.matrix.canvas, opts);
    // Re-create screens with new matrix
    const screenClasses = [];
    for (const [id, screen] of this.screens) {
      screenClasses.push(screen.constructor);
    }
    this.screens.clear();
    for (const SC of screenClasses) {
      this.addScreen(SC);
    }
    if (this.activeScreen) {
      this.switchTo(this.activeScreen.constructor.id);
    }
    this.start();
  }
}

// Static metadata for workbench compatibility
Jumbotron.id = 'jumbotron';
Jumbotron.displayName = 'Jumbotron';
Jumbotron.description = 'Dot matrix LED scoreboard display';
