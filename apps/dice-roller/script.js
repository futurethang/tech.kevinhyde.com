import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  diceSize: 1,
  diceRestitution: 0.3,
  diceFriction: 0.4,
  diceMass: 1,
  wallRestitution: 0.5,
  wallFriction: 0.3,
  throwForce: { min: 5, max: 8 },
  spinForce: { min: 10, max: 20 },
  gravity: -40,
  settleVelocityThreshold: 0.05,
  shakeThreshold: 20,
  shakeTimeout: 500
};

// ============================================
// GLOBAL STATE
// ============================================
let scene, camera, renderer;
let world;
let dice = [];
let wallBodies = [];
let diceCount = 2;
let isRolling = false;
let animationId = null;

// Shake detection
let shakeEnabled = false;
let lastShakeTime = 0;
let motionPermissionGranted = false;

// DOM elements
const canvas = document.getElementById('diceCanvas');
const rollButton = document.getElementById('rollButton');
const resultDisplay = document.getElementById('result');
const diceButtons = document.querySelectorAll('.dice-btn');
const shakeToggle = document.getElementById('shakeToggle');
const shakeStatus = document.getElementById('shakeStatus');

// ============================================
// INITIALIZATION
// ============================================
function init() {
  initThreeJS();
  initCannonWorld();
  initWalls();
  initDice();
  initEventListeners();
  initShakeDetection();
  registerServiceWorker();
  animate();
}

function initThreeJS() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a472a);

  // Camera - orthographic for consistent sizing
  const aspect = window.innerWidth / window.innerHeight;
  const viewSize = 10;
  camera = new THREE.OrthographicCamera(
    -viewSize * aspect / 2,
    viewSize * aspect / 2,
    viewSize / 2,
    -viewSize / 2,
    0.1,
    100
  );
  camera.position.set(0, 20, 0);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Lighting - softer for cleaner look
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(3, 15, 3);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -15;
  directionalLight.shadow.camera.right = 15;
  directionalLight.shadow.camera.top = 15;
  directionalLight.shadow.camera.bottom = -15;
  scene.add(directionalLight);

  // Floor (felt surface)
  const floorGeometry = new THREE.PlaneGeometry(30, 30);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a472a,
    roughness: 0.95,
    metalness: 0
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
}

function initCannonWorld() {
  world = new CANNON.World();
  world.gravity.set(0, CONFIG.gravity, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 15;
  world.allowSleep = true;

  // Floor body
  const floorBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
    material: new CANNON.Material({
      friction: 0.5,
      restitution: 0.3
    })
  });
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floorBody);
}

function getViewBounds() {
  const aspect = window.innerWidth / window.innerHeight;
  const viewSize = 10;
  // Add padding for dice size and wall thickness
  const padding = CONFIG.diceSize + 0.5;
  return {
    halfWidth: (viewSize * aspect) / 2 - padding,
    halfHeight: viewSize / 2 - padding
  };
}

function initWalls() {
  // Remove old walls
  wallBodies.forEach(body => world.removeBody(body));
  wallBodies = [];

  const { halfWidth, halfHeight } = getViewBounds();
  const wallHeight = 8;
  const wallThickness = 1;

  const wallMaterial = new CANNON.Material({
    friction: CONFIG.wallFriction,
    restitution: CONFIG.wallRestitution
  });

  const walls = [
    { pos: [0, wallHeight / 2, -halfHeight - wallThickness / 2], size: [halfWidth * 2 + wallThickness * 2, wallHeight, wallThickness] },
    { pos: [0, wallHeight / 2, halfHeight + wallThickness / 2], size: [halfWidth * 2 + wallThickness * 2, wallHeight, wallThickness] },
    { pos: [-halfWidth - wallThickness / 2, wallHeight / 2, 0], size: [wallThickness, wallHeight, halfHeight * 2 + wallThickness * 2] },
    { pos: [halfWidth + wallThickness / 2, wallHeight / 2, 0], size: [wallThickness, wallHeight, halfHeight * 2 + wallThickness * 2] }
  ];

  walls.forEach(wall => {
    const wallBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(wall.size[0] / 2, wall.size[1] / 2, wall.size[2] / 2)),
      material: wallMaterial
    });
    wallBody.position.set(...wall.pos);
    world.addBody(wallBody);
    wallBodies.push(wallBody);
  });
}

// ============================================
// DICE CREATION
// ============================================
function createDiceMesh() {
  const size = CONFIG.diceSize;

  // Clean box geometry - no vertex manipulation
  const geometry = new THREE.BoxGeometry(size, size, size);

  // Simple white material
  const material = new THREE.MeshStandardMaterial({
    color: 0xf5f5f5,
    roughness: 0.4,
    metalness: 0.05
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Add dots
  addDots(mesh);

  return mesh;
}

function addDots(diceMesh) {
  const size = CONFIG.diceSize;
  const dotRadius = size * 0.09;
  const dotDepth = 0.02;
  const dotGeometry = new THREE.CircleGeometry(dotRadius, 16);
  const dotMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.8
  });

  // Dot positions for each face (1-6)
  const dotPatterns = {
    1: [[0, 0]],
    2: [[-0.25, -0.25], [0.25, 0.25]],
    3: [[-0.25, -0.25], [0, 0], [0.25, 0.25]],
    4: [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]],
    5: [[-0.25, -0.25], [0.25, -0.25], [0, 0], [-0.25, 0.25], [0.25, 0.25]],
    6: [[-0.25, -0.3], [0.25, -0.3], [-0.25, 0], [0.25, 0], [-0.25, 0.3], [0.25, 0.3]]
  };

  // Standard die opposite faces sum to 7
  const faces = [
    { value: 1, normal: [0, 0, 1], rotation: [0, 0, 0] },
    { value: 6, normal: [0, 0, -1], rotation: [0, Math.PI, 0] },
    { value: 3, normal: [1, 0, 0], rotation: [0, Math.PI / 2, 0] },
    { value: 4, normal: [-1, 0, 0], rotation: [0, -Math.PI / 2, 0] },
    { value: 2, normal: [0, 1, 0], rotation: [-Math.PI / 2, 0, 0] },
    { value: 5, normal: [0, -1, 0], rotation: [Math.PI / 2, 0, 0] }
  ];

  faces.forEach(face => {
    const pattern = dotPatterns[face.value];
    const offset = size / 2 + dotDepth;

    pattern.forEach(([x, y]) => {
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);

      // Position based on face
      if (face.normal[2] !== 0) {
        dot.position.set(x * size, y * size, face.normal[2] * offset);
        if (face.normal[2] < 0) dot.rotation.y = Math.PI;
      } else if (face.normal[0] !== 0) {
        dot.position.set(face.normal[0] * offset, y * size, -x * size * face.normal[0]);
        dot.rotation.y = face.normal[0] * Math.PI / 2;
      } else {
        dot.position.set(x * size, face.normal[1] * offset, -y * size * face.normal[1]);
        dot.rotation.x = -face.normal[1] * Math.PI / 2;
      }

      diceMesh.add(dot);
    });
  });
}

function createDiceBody() {
  const size = CONFIG.diceSize;

  const body = new CANNON.Body({
    mass: CONFIG.diceMass,
    shape: new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2)),
    material: new CANNON.Material({
      friction: CONFIG.diceFriction,
      restitution: CONFIG.diceRestitution
    }),
    linearDamping: 0.4,
    angularDamping: 0.4
  });

  return body;
}

function initDice() {
  clearDice();

  const { halfWidth, halfHeight } = getViewBounds();

  for (let i = 0; i < diceCount; i++) {
    const mesh = createDiceMesh();
    const body = createDiceBody();

    // Position dice in center, spread out
    const spacing = Math.min(1.5, (halfWidth * 2) / (diceCount + 1));
    const x = (i - (diceCount - 1) / 2) * spacing;
    body.position.set(x, CONFIG.diceSize / 2, 0);
    mesh.position.copy(body.position);

    scene.add(mesh);
    world.addBody(body);

    dice.push({ mesh, body });
  }
}

function clearDice() {
  dice.forEach(die => {
    scene.remove(die.mesh);
    world.removeBody(die.body);
  });
  dice = [];
}

// ============================================
// ROLLING MECHANICS
// ============================================
function rollDice() {
  if (isRolling) return;

  isRolling = true;
  rollButton.disabled = true;
  resultDisplay.classList.remove('visible');

  const { halfWidth, halfHeight } = getViewBounds();

  // Reset and throw each die
  dice.forEach((die, index) => {
    // Starting position - within bounds, above play area
    const startX = (Math.random() - 0.5) * halfWidth;
    const startZ = (Math.random() - 0.5) * halfHeight;

    die.body.position.set(startX, 5 + Math.random() * 2, startZ);
    die.body.velocity.set(0, 0, 0);
    die.body.angularVelocity.set(0, 0, 0);

    // Random initial rotation
    die.body.quaternion.setFromEuler(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    // Apply throw force - toward center
    const throwForce = CONFIG.throwForce.min + Math.random() * (CONFIG.throwForce.max - CONFIG.throwForce.min);
    const targetX = (Math.random() - 0.5) * halfWidth * 0.5;
    const targetZ = (Math.random() - 0.5) * halfHeight * 0.5;
    const dirX = targetX - startX;
    const dirZ = targetZ - startZ;
    const dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;

    die.body.velocity.set(
      (dirX / dirLen) * throwForce,
      -2,
      (dirZ / dirLen) * throwForce
    );

    // Apply spin
    const spinForce = CONFIG.spinForce.min + Math.random() * (CONFIG.spinForce.max - CONFIG.spinForce.min);
    die.body.angularVelocity.set(
      (Math.random() - 0.5) * spinForce,
      (Math.random() - 0.5) * spinForce,
      (Math.random() - 0.5) * spinForce
    );

    die.body.wakeUp();
  });

  // Check for settling
  setTimeout(checkSettled, 500);
}

function checkSettled() {
  const allSettled = dice.every(die => {
    const vel = die.body.velocity.length();
    const angVel = die.body.angularVelocity.length();
    return vel < CONFIG.settleVelocityThreshold && angVel < CONFIG.settleVelocityThreshold;
  });

  if (allSettled) {
    finishRoll();
  } else {
    setTimeout(checkSettled, 100);
  }
}

function finishRoll() {
  isRolling = false;
  rollButton.disabled = false;

  const results = dice.map(die => getDieValue(die));
  const total = results.reduce((sum, val) => sum + val, 0);

  resultDisplay.textContent = results.length > 1
    ? `${results.join(' + ')} = ${total}`
    : `${total}`;
  resultDisplay.classList.add('visible');
}

function getDieValue(die) {
  const upVector = new THREE.Vector3(0, 1, 0);
  const dieUp = new THREE.Vector3();

  // Standard die: opposite faces sum to 7
  const faceNormals = [
    { normal: new THREE.Vector3(0, 0, 1), value: 1 },
    { normal: new THREE.Vector3(0, 0, -1), value: 6 },
    { normal: new THREE.Vector3(1, 0, 0), value: 3 },
    { normal: new THREE.Vector3(-1, 0, 0), value: 4 },
    { normal: new THREE.Vector3(0, 1, 0), value: 2 },
    { normal: new THREE.Vector3(0, -1, 0), value: 5 }
  ];

  let maxDot = -Infinity;
  let result = 1;

  faceNormals.forEach(face => {
    dieUp.copy(face.normal);
    dieUp.applyQuaternion(die.mesh.quaternion);
    const dot = dieUp.dot(upVector);

    if (dot > maxDot) {
      maxDot = dot;
      result = face.value;
    }
  });

  return result;
}

// ============================================
// SHAKE DETECTION
// ============================================
function initShakeDetection() {
  // Load saved preference
  shakeEnabled = localStorage.getItem('diceRoller_shakeEnabled') === 'true';
  updateShakeUI();

  shakeToggle.addEventListener('click', toggleShake);
}

async function toggleShake() {
  if (!shakeEnabled) {
    // Try to enable
    const granted = await requestMotionPermission();
    if (granted) {
      shakeEnabled = true;
      startShakeListening();
    }
  } else {
    shakeEnabled = false;
    stopShakeListening();
  }

  localStorage.setItem('diceRoller_shakeEnabled', shakeEnabled);
  updateShakeUI();
}

async function requestMotionPermission() {
  // iOS 13+ requires permission
  if (typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const permission = await DeviceMotionEvent.requestPermission();
      motionPermissionGranted = permission === 'granted';
      return motionPermissionGranted;
    } catch (e) {
      console.log('Motion permission denied:', e);
      return false;
    }
  }

  // Non-iOS or older iOS - check if API exists
  if ('DeviceMotionEvent' in window) {
    motionPermissionGranted = true;
    return true;
  }

  return false;
}

function startShakeListening() {
  window.addEventListener('devicemotion', handleMotion, true);
}

function stopShakeListening() {
  window.removeEventListener('devicemotion', handleMotion, true);
}

function handleMotion(event) {
  if (!shakeEnabled || isRolling) return;

  const acc = event.accelerationIncludingGravity;
  if (!acc) return;

  const total = Math.abs(acc.x) + Math.abs(acc.y) + Math.abs(acc.z);

  if (total > CONFIG.shakeThreshold) {
    const now = Date.now();
    if (now - lastShakeTime > CONFIG.shakeTimeout) {
      lastShakeTime = now;
      rollDice();
    }
  }
}

function updateShakeUI() {
  if (shakeEnabled) {
    shakeToggle.classList.add('active');
    shakeStatus.textContent = 'ON';
  } else {
    shakeToggle.classList.remove('active');
    shakeStatus.textContent = 'OFF';
  }
}

// ============================================
// EVENT HANDLERS
// ============================================
function initEventListeners() {
  // Roll button
  rollButton.addEventListener('click', rollDice);
  rollButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    rollDice();
  });

  // Dice count buttons
  diceButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isRolling) return;

      diceButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      diceCount = parseInt(btn.dataset.count);
      initDice();
      resultDisplay.classList.remove('visible');
    });
  });

  // Window resize
  window.addEventListener('resize', onResize);

  // Prevent pull-to-refresh on mobile
  document.body.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      e.preventDefault();
    }
  }, { passive: false });
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;
  const viewSize = 10;

  camera.left = -viewSize * aspect / 2;
  camera.right = viewSize * aspect / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);

  // Rebuild walls for new aspect ratio
  initWalls();
}

// ============================================
// ANIMATION LOOP
// ============================================
function animate() {
  animationId = requestAnimationFrame(animate);

  // Step physics
  world.step(1 / 60);

  // Sync meshes with physics bodies
  dice.forEach(die => {
    die.mesh.position.copy(die.body.position);
    die.mesh.quaternion.copy(die.body.quaternion);
  });

  renderer.render(scene, camera);
}

// ============================================
// SERVICE WORKER
// ============================================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(registration => {
          console.log('SW registered:', registration.scope);
        })
        .catch(error => {
          console.log('SW registration failed:', error);
        });
    });
  }
}

// ============================================
// START
// ============================================
init();
