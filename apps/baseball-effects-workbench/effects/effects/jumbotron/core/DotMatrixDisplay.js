/**
 * DotMatrixDisplay — Canvas-based LED scoreboard renderer.
 *
 * Everything the jumbotron displays goes through this engine.
 * It maintains a grid of virtual "LED dots" and renders them
 * as circles with glow effects on a canvas.
 *
 * Content gets onto the grid via:
 *   - setDot(col, row, r, g, b, brightness) — individual pixel
 *   - drawText(text, col, row, color, fontKey) — bitmap font text
 *   - drawScore(value, col, row, color) — large scoreboard digits
 *   - sampleSource(imageSource, ...) — sample any canvas/image onto the grid
 *   - fillRect(col, row, w, h, r, g, b, brightness) — filled rectangle
 */

import { BITMAP_FONTS } from './BitmapFonts.js';

export class DotMatrixDisplay {
  constructor(canvas, opts = {}) {
    const {
      cols = 128,
      rows = 64,
      dotSize = 3,
      gap = 1,
      bgColor = '#0a0a0a',
      dimColor = '#1a1a1a',
      glowIntensity = 0.15,
    } = opts;

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cols = cols;
    this.rows = rows;
    this.dotSize = dotSize;
    this.gap = gap;
    this.bgColor = bgColor;
    this.dimColor = dimColor;
    this.glowIntensity = glowIntensity;

    // Grid buffer: [r, g, b, brightness] per dot
    this.grid = new Float32Array(cols * rows * 4);

    // Offscreen canvas for sampling external sources
    this._offscreen = document.createElement('canvas');
    this._offscreen.width = cols;
    this._offscreen.height = rows;
    this._offCtx = this._offscreen.getContext('2d', { willReadFrequently: true });

    // Size the visible canvas
    const cellSize = dotSize * 2 + gap;
    canvas.width = cols * cellSize + gap;
    canvas.height = rows * cellSize + gap;

    // Pixel ratio for sharp rendering
    canvas.style.imageRendering = 'pixelated';
  }

  // ============================================================
  // Grid operations
  // ============================================================

  clear() {
    this.grid.fill(0);
  }

  setDot(col, row, r, g, b, brightness = 1.0) {
    col = Math.floor(col);
    row = Math.floor(row);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const i = (row * this.cols + col) * 4;
    this.grid[i] = r;
    this.grid[i + 1] = g;
    this.grid[i + 2] = b;
    this.grid[i + 3] = Math.max(this.grid[i + 3], brightness); // Additive brightness
  }

  fillRect(col, row, w, h, r, g, b, brightness = 1.0) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.setDot(col + dx, row + dy, r, g, b, brightness);
      }
    }
  }

  // ============================================================
  // Text rendering with bitmap fonts
  // ============================================================

  drawText(text, col, row, color = [255, 200, 50], fontKey = '5x7') {
    const font = BITMAP_FONTS[fontKey];
    if (!font) {
      console.warn(`DotMatrixDisplay: unknown font "${fontKey}"`);
      return 0;
    }

    let cursor = Math.floor(col);
    const [r, g, b] = color;

    for (const char of String(text).toUpperCase()) {
      const glyph = font.glyphs[char] || font.glyphs['?'] || [];

      for (let gy = 0; gy < glyph.length; gy++) {
        const rowData = glyph[gy];
        for (let gx = 0; gx < font.width; gx++) {
          if (rowData & (1 << (font.width - 1 - gx))) {
            this.setDot(cursor + gx, row + gy, r, g, b, 1.0);
          }
        }
      }

      cursor += font.width + 1; // 1-dot kerning gap
    }

    return cursor - Math.floor(col); // Width consumed
  }

  drawScore(value, col, row, color = [255, 220, 60]) {
    const text = String(value).padStart(2, ' ');
    return this.drawText(text, col, row, color, '8x12');
  }

  /**
   * Measure text width in dots (for centering)
   */
  measureText(text, fontKey = '5x7') {
    const font = BITMAP_FONTS[fontKey];
    if (!font) return 0;
    return text.length * (font.width + 1) - 1;
  }

  /**
   * Draw centered text
   */
  drawTextCentered(text, row, color, fontKey = '5x7') {
    const width = this.measureText(text, fontKey);
    const col = Math.floor((this.cols - width) / 2);
    return this.drawText(text, col, row, color, fontKey);
  }

  // ============================================================
  // Image sampling — for sprite sheets and Lottie frames
  // ============================================================

  sampleSource(source, destCol, destRow, destCols, destRows) {
    this._offCtx.clearRect(0, 0, this.cols, this.rows);
    this._offCtx.drawImage(source, 0, 0, destCols, destRows);

    const imageData = this._offCtx.getImageData(0, 0, destCols, destRows);
    const pixels = imageData.data;

    for (let y = 0; y < destRows; y++) {
      for (let x = 0; x < destCols; x++) {
        const pi = (y * destCols + x) * 4;
        const r = pixels[pi];
        const g = pixels[pi + 1];
        const b = pixels[pi + 2];
        const a = pixels[pi + 3];

        if (a > 20) {
          const brightness = a / 255;
          this.setDot(destCol + x, destRow + y, r, g, b, brightness);
        }
      }
    }
  }

  // ============================================================
  // Render the grid to the visible canvas
  // ============================================================

  render() {
    const { ctx, cols, rows, dotSize, gap, bgColor, dimColor, glowIntensity } = this;
    const cellSize = dotSize * 2 + gap;

    // Clear background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const i = (row * cols + col) * 4;
        const r = this.grid[i];
        const g = this.grid[i + 1];
        const b = this.grid[i + 2];
        const brightness = this.grid[i + 3];

        const cx = gap + col * cellSize + dotSize;
        const cy = gap + row * cellSize + dotSize;

        if (brightness > 0.05) {
          // Glow layer (larger, dimmer circle behind the main dot)
          if (glowIntensity > 0) {
            ctx.beginPath();
            ctx.arc(cx, cy, dotSize * 1.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${brightness * glowIntensity})`;
            ctx.fill();
          }

          // Main dot
          ctx.beginPath();
          ctx.arc(cx, cy, dotSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`;
          ctx.fill();
        } else {
          // Unlit LED — visible but dark (realistic scoreboard look)
          ctx.beginPath();
          ctx.arc(cx, cy, dotSize * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = dimColor;
          ctx.fill();
        }
      }
    }
  }
}
