/**
 * Phaser rendering of the hex map.
 *
 * The scene is a dumb display: it is handed a MapViewModel and draws it, and it
 * reports hex clicks back out. It holds no game state and never calls into the
 * rules engine. Redrawing rebuilds the display objects outright — with ~100
 * hexes that is cheap, and it keeps the renderer free of pooling bugs.
 */

import Phaser from 'phaser';

import { hexAtPoint, layoutHexes, tokenOffsets, type MapLayoutResult } from './layout';
import { hexCorners } from '../core/hex';
import type { MapViewModel } from '../ui/viewModel';

export interface MapSceneCallbacks {
  onHexClick?: (hexId: string) => void;
}

const COLORS = {
  background: 0x11150f,
  grid: 0x2c3328,
  label: '#e9e4d6',
  overlay: '#ffe082',
  legal: 0xffffff,
  selected: 0xffd54f,
  inspected: 0x4fc3f7,
  trailhead: 0xf2f0e6,
  trailheadClosed: 0x7a6f63,
};

export class MapScene extends Phaser.Scene {
  static readonly KEY = 'map';

  private layout!: MapLayoutResult;
  private viewModel: MapViewModel | null = null;
  private hexLayer!: Phaser.GameObjects.Container;
  private tokenLayer!: Phaser.GameObjects.Container;
  private graphics!: Phaser.GameObjects.Graphics;
  private callbacks: MapSceneCallbacks = {};
  private created = false;
  private readyHandler: (() => void) | null = null;

  constructor() {
    super(MapScene.KEY);
  }

  setCallbacks(callbacks: MapSceneCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Runs once the scene exists and can draw. Called immediately if the scene
   * is already up, so the caller never has to race Phaser's boot sequence.
   */
  onReady(handler: () => void): void {
    this.readyHandler = handler;
    if (this.created) handler();
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.graphics = this.add.graphics();
    this.hexLayer = this.add.container(0, 0);
    this.tokenLayer = this.add.container(0, 0);

    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (this.layout === undefined) return;
      // A drag is a pan, not a click.
      if (pointer.getDistance() > 6) return;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const hexId = hexAtPoint(this.layout, world.x, world.y);
      if (hexId !== null) this.callbacks.onHexClick?.(hexId);
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      const camera = this.cameras.main;
      camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
      camera.scrollY -= (pointer.y - pointer.prevPosition.y) / camera.zoom;
    });

    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_pointer: unknown, _over: unknown, _dx: number, dy: number) => {
        const camera = this.cameras.main;
        camera.setZoom(Phaser.Math.Clamp(camera.zoom * (dy > 0 ? 0.9 : 1.1), 0.3, 3));
      },
    );

    this.created = true;
    if (this.viewModel) this.redraw();
    this.readyHandler?.();
  }

  /** Replaces the whole display. Safe to call before `create` has run. */
  render(viewModel: MapViewModel): void {
    const isNewMap =
      this.viewModel === null ||
      this.viewModel.hexes.length !== viewModel.hexes.length ||
      this.viewModel.hexes[0]?.id !== viewModel.hexes[0]?.id;
    this.viewModel = viewModel;
    if (!this.created || this.graphics === undefined) return;
    if (isNewMap) {
      this.layout = layoutHexes(viewModel.hexes, viewModel.hexSize);
      this.centerCamera();
    }
    this.redraw();
  }

  /** Fits the whole map in view. */
  centerCamera(): void {
    if (this.layout === undefined) return;
    const camera = this.cameras.main;
    const { width, height } = this.layout.bounds;
    const zoom = Math.min(camera.width / width, camera.height / height, 1.4);
    camera.setZoom(zoom > 0 ? zoom : 1);
    camera.centerOn(width / 2, height / 2);
  }

  private redraw(): void {
    const vm = this.viewModel;
    if (!vm) return;
    if (this.layout === undefined) this.layout = layoutHexes(vm.hexes, vm.hexSize);

    this.graphics.clear();
    this.hexLayer.removeAll(true);
    this.tokenLayer.removeAll(true);

    const size = this.layout.size;

    for (const hex of vm.hexes) {
      const centre = this.layout.centers.get(hex.id)!;
      const points = hexCorners(centre.x, centre.y, size - 1.5);
      const fill = Phaser.Display.Color.HexStringToColor(hex.fill).color;
      const unexplored = !hex.explored;

      this.graphics.fillStyle(fill, hex.impassable ? 0.95 : unexplored ? 0.55 : 1);
      this.graphics.beginPath();
      points.forEach((p, i) => (i === 0 ? this.graphics.moveTo(p.x, p.y) : this.graphics.lineTo(p.x, p.y)));
      this.graphics.closePath();
      this.graphics.fillPath();

      const outline =
        hex.highlight === 'selected'
          ? { color: COLORS.selected, width: 4 }
          : hex.highlight === 'inspected'
            ? { color: COLORS.inspected, width: 3 }
            : hex.highlight === 'legal'
              ? { color: COLORS.legal, width: 2 }
              : { color: COLORS.grid, width: 1 };
      this.graphics.lineStyle(outline.width, outline.color, hex.highlight === 'none' ? 0.8 : 1);
      this.graphics.strokePoints(points, true, true);

      if (hex.impassable) {
        this.graphics.lineStyle(2, 0x000000, 0.35);
        this.graphics.lineBetween(centre.x - size * 0.4, centre.y - size * 0.4, centre.x + size * 0.4, centre.y + size * 0.4);
        this.graphics.lineBetween(centre.x - size * 0.4, centre.y + size * 0.4, centre.x + size * 0.4, centre.y - size * 0.4);
      }

      if (hex.trailhead) {
        this.graphics.lineStyle(3, hex.trailhead.closed ? COLORS.trailheadClosed : COLORS.trailhead, 1);
        this.graphics.strokeCircle(centre.x, centre.y, size * 0.62);
      }

      if (hex.secretContent || hex.revealedContent) {
        this.graphics.fillStyle(hex.secretContent ? 0xff8a65 : 0xfff59d, 0.95);
        this.graphics.fillCircle(centre.x + size * 0.45, centre.y - size * 0.45, size * 0.12);
      }

      this.hexLayer.add(
        this.add
          .text(centre.x, centre.y + size * 0.42, hex.label, {
            fontFamily: 'ui-monospace, monospace',
            fontSize: `${Math.max(9, Math.round(size * 0.26))}px`,
            color: COLORS.label,
          })
          .setOrigin(0.5),
      );

      if (hex.overlayText !== null) {
        this.hexLayer.add(
          this.add
            .text(centre.x, centre.y - size * 0.44, hex.overlayText, {
              fontFamily: 'ui-monospace, monospace',
              fontSize: `${Math.max(10, Math.round(size * 0.3))}px`,
              color: COLORS.overlay,
            })
            .setOrigin(0.5),
        );
      }
    }

    // Tokens, and the pending-move arrow for the team being handled.
    const perHex = new Map<string, number>();
    for (const token of vm.tokens) perHex.set(token.hexId, (perHex.get(token.hexId) ?? 0) + 1);
    const seen = new Map<string, number>();

    for (const token of vm.tokens) {
      const centre = this.layout.centers.get(token.hexId)!;
      const count = perHex.get(token.hexId) ?? 1;
      const index = seen.get(token.hexId) ?? 0;
      seen.set(token.hexId, index + 1);
      const offset = tokenOffsets(count, size)[index]!;
      const x = centre.x + offset.dx;
      const y = centre.y + offset.dy - size * 0.1;
      const radius = size * (count > 1 ? 0.22 : 0.3);
      const color = Phaser.Display.Color.HexStringToColor(token.color).color;

      this.graphics.fillStyle(color, 1);
      this.graphics.fillCircle(x, y, radius);
      this.graphics.lineStyle(
        token.status === 'at_trailhead' ? 3 : 1.5,
        token.status === 'at_trailhead' ? COLORS.selected : 0x000000,
        0.9,
      );
      this.graphics.strokeCircle(x, y, radius);

      this.tokenLayer.add(
        this.add
          .text(x, y, token.label, {
            fontFamily: 'ui-monospace, monospace',
            fontSize: `${Math.max(8, Math.round(radius * 0.9))}px`,
            color: '#10140f',
            fontStyle: 'bold',
          })
          .setOrigin(0.5),
      );

      if (token.pendingHexId !== null && token.pendingHexId !== token.hexId) {
        const target = this.layout.centers.get(token.pendingHexId)!;
        this.graphics.lineStyle(3, COLORS.selected, 0.9);
        this.graphics.lineBetween(x, y, target.x, target.y);
        this.graphics.fillStyle(COLORS.selected, 0.9);
        this.graphics.fillCircle(target.x, target.y, size * 0.12);
      }
    }
  }
}
