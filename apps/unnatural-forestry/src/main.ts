/**
 * Boot: load the default scenario, start Phaser, hand the scene to the panel.
 */

import Phaser from 'phaser';

import { MapScene } from './render/MapScene';
import { SimulatorApp } from './ui/app';
import { DEFAULT_SCENARIO_ID } from './data/registry';

const board = document.getElementById('board');
const panel = document.getElementById('panel');
if (!board || !panel) throw new Error('index.html is missing #board or #panel');

const scene = new MapScene();

scene.onReady(() => {
  new SimulatorApp(panel, scene, DEFAULT_SCENARIO_ID);
});

new Phaser.Game({
  type: Phaser.AUTO,
  parent: board,
  backgroundColor: '#11150f',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  scene: [scene],
});
