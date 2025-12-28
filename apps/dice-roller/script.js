import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  diceSize: 1,
  diceMass: 1,
  // Lower gravity = solver converges better, more realistic tumbles
  gravity: -20,
  // Throw parameters - base values, scaled by intensity
  throwForce: { min: 8, max: 22 },  // Wider range for intensity scaling
  throwHeight: 3,
  spinForce: { min: 6, max: 18 },
  // Very low damping = dice roll longer, don't feel sticky
  linearDamping: 0.1,
  angularDamping: 0.1,
  // Settle detection
  settleVelocityThreshold: 0.08,
  settleAngularThreshold: 0.1,
  // Dice separation - minimum distance between dice centers
  minDiceSeparation: 1.3,  // Slightly larger than dice size
  // Shake detection
  shakeThreshold: 20,
  shakeTimeout: 500,
  // Shake intensity mapping
  shakeIntensity: {
    min: 20,   // Minimum acceleration to trigger
    max: 60,   // Acceleration for maximum throw force
    smoothing: 0.3  // How much to blend with previous reading
  }
};

// Physics materials - tuned for realistic behavior
const PHYSICS = {
  // Dice: moderate friction, low bounce
  dice: { friction: 0.3, restitution: 0.25 },
  // Felt floor: high friction (felt grips), very low bounce
  floor: { friction: 0.7, restitution: 0.1 },
  // Walls: low friction, moderate bounce
  wall: { friction: 0.1, restitution: 0.4 },
  // Dice-to-dice: lower friction so they don't stick
  diceToDice: { friction: 0.2, restitution: 0.3 },
  // Dice-to-floor: high friction (felt), low bounce
  diceToFloor: { friction: 0.6, restitution: 0.15 },
  // Dice-to-wall: slides along wall, decent bounce
  diceToWall: { friction: 0.1, restitution: 0.5 }
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

// Materials for contact definitions
let diceMaterial, floorMaterial, wallMaterial;

// Shake detection
let shakeEnabled = false;
let lastShakeTime = 0;
let motionPermissionGranted = false;
let currentShakeIntensity = 0;  // 0.0 to 1.0, based on shake force
let peakAcceleration = 0;       // Track peak during shake gesture

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
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a472a);

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

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Lighting
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
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1a472a,
    roughness: 0.95,
    metalness: 0
  });
  const floor = new THREE.Mesh(floorGeometry, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
}

function initCannonWorld() {
  world = new CANNON.World();
  world.gravity.set(0, CONFIG.gravity, 0);

  // Use SAPBroadphase for better performance with multiple dice
  world.broadphase = new CANNON.SAPBroadphase(world);

  // More iterations = better constraint solving, less energy gain
  world.solver.iterations = 20;
  world.solver.tolerance = 0.001;

  world.allowSleep = true;
  world.sleepSpeedLimit = 0.1;
  world.sleepTimeLimit = 0.5;

  // Create materials
  diceMaterial = new CANNON.Material('dice');
  floorMaterial = new CANNON.Material('floor');
  wallMaterial = new CANNON.Material('wall');

  // Define contact behaviors between materials
  // Dice-to-Floor: felt grips dice, minimal bounce
  const diceFloorContact = new CANNON.ContactMaterial(diceMaterial, floorMaterial, {
    friction: PHYSICS.diceToFloor.friction,
    restitution: PHYSICS.diceToFloor.restitution,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3
  });
  world.addContactMaterial(diceFloorContact);

  // Dice-to-Dice: should slide off each other, not stick
  const diceDiceContact = new CANNON.ContactMaterial(diceMaterial, diceMaterial, {
    friction: PHYSICS.diceToDice.friction,
    restitution: PHYSICS.diceToDice.restitution,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3
  });
  world.addContactMaterial(diceDiceContact);

  // Dice-to-Wall: bouncy, slides along
  const diceWallContact = new CANNON.ContactMaterial(diceMaterial, wallMaterial, {
    friction: PHYSICS.diceToWall.friction,
    restitution: PHYSICS.diceToWall.restitution,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3
  });
  world.addContactMaterial(diceWallContact);

  // Floor body
  const floorBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
    material: floorMaterial
  });
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floorBody);
}

function getViewBounds() {
  const aspect = window.innerWidth / window.innerHeight;
  const viewSize = 10;
  const padding = CONFIG.diceSize + 0.5;
  return {
    halfWidth: (viewSize * aspect) / 2 - padding,
    halfHeight: viewSize / 2 - padding
  };
}

function initWalls() {
  wallBodies.forEach(body => world.removeBody(body));
  wallBodies = [];

  const { halfWidth, halfHeight } = getViewBounds();
  const wallHeight = 10;
  const wallThickness = 1;

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
  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshStandardMaterial({
    color: 0xf5f5f5,
    roughness: 0.4,
    metalness: 0.05
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
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

  const dotPatterns = {
    1: [[0, 0]],
    2: [[-0.25, -0.25], [0.25, 0.25]],
    3: [[-0.25, -0.25], [0, 0], [0.25, 0.25]],
    4: [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]],
    5: [[-0.25, -0.25], [0.25, -0.25], [0, 0], [-0.25, 0.25], [0.25, 0.25]],
    6: [[-0.25, -0.3], [0.25, -0.3], [-0.25, 0], [0.25, 0], [-0.25, 0.3], [0.25, 0.3]]
  };

  const faces = [
    { value: 1, normal: [0, 0, 1] },
    { value: 6, normal: [0, 0, -1] },
    { value: 3, normal: [1, 0, 0] },
    { value: 4, normal: [-1, 0, 0] },
    { value: 2, normal: [0, 1, 0] },
    { value: 5, normal: [0, -1, 0] }
  ];

  faces.forEach(face => {
    const pattern = dotPatterns[face.value];
    const offset = size / 2 + dotDepth;

    pattern.forEach(([x, y]) => {
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);

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
    material: diceMaterial,
    linearDamping: CONFIG.linearDamping,
    angularDamping: CONFIG.angularDamping,
    allowSleep: true,
    sleepSpeedLimit: 0.1,
    sleepTimeLimit: 0.5
  });

  return body;
}

function initDice() {
  clearDice();

  const { halfWidth } = getViewBounds();

  for (let i = 0; i < diceCount; i++) {
    const mesh = createDiceMesh();
    const body = createDiceBody();

    // Position dice spread out at bottom
    const spacing = Math.min(2.0, (halfWidth * 2) / (diceCount + 1));
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
function rollDice(intensity = 0.5) {
  if (isRolling) return;

  isRolling = true;
  rollButton.disabled = true;
  resultDisplay.classList.remove('visible');

  // Clamp intensity to valid range
  intensity = Math.max(0.2, Math.min(1.0, intensity));

  const { halfWidth, halfHeight } = getViewBounds();

  // Scale throw force based on intensity (0.2 to 1.0 maps to min-max range)
  const intensityScale = (intensity - 0.2) / 0.8;  // Normalize to 0-1
  const baseThrowForce = CONFIG.throwForce.min + intensityScale * (CONFIG.throwForce.max - CONFIG.throwForce.min);
  const baseSpinForce = CONFIG.spinForce.min + intensityScale * (CONFIG.spinForce.max - CONFIG.spinForce.min);

  // Dice originate from bottom of screen (positive Z = toward viewer/bottom)
  // and are thrown forward (negative Z = away from viewer/toward top)
  dice.forEach((die, index) => {
    // Starting position: bottom of view, spread horizontally
    // Add randomness so dice don't start at exact same spot
    const spreadX = (halfWidth * 1.5) / Math.max(diceCount, 2);
    const startX = (index - (diceCount - 1) / 2) * spreadX + (Math.random() - 0.5) * 0.5;
    const startZ = halfHeight * 0.7 + Math.random() * 0.3; // Near bottom edge
    const startY = CONFIG.throwHeight + Math.random() * 1.5;

    die.body.position.set(startX, startY, startZ);
    die.body.velocity.set(0, 0, 0);
    die.body.angularVelocity.set(0, 0, 0);

    // Random initial rotation for variety
    die.body.quaternion.setFromEuler(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    // Throw force - scaled by intensity, with some randomness
    const throwForce = baseThrowForce * (0.9 + Math.random() * 0.2);

    // Target: spread across the play area, biased toward opposite corners
    const targetX = (Math.random() - 0.5) * halfWidth * 1.2;
    const targetZ = -halfHeight * (0.3 + Math.random() * 0.5); // Toward top of screen

    // Direction vector
    const dirX = targetX - startX;
    const dirZ = targetZ - startZ;
    const dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ);

    die.body.velocity.set(
      (dirX / dirLen) * throwForce * 0.6,  // Some sideways spread
      throwForce * 0.15,                     // Slight upward arc
      (dirZ / dirLen) * throwForce          // Primary forward motion
    );

    // Tumbling spin - scaled by intensity
    const spinForce = baseSpinForce * (0.8 + Math.random() * 0.4);
    die.body.angularVelocity.set(
      spinForce * (0.5 + Math.random() * 0.5),  // Roll forward (around X axis)
      (Math.random() - 0.5) * spinForce * 0.5,  // Some yaw
      (Math.random() - 0.5) * spinForce * 0.3   // Some sideways tilt
    );

    die.body.wakeUp();
  });

  // Start checking for settle after dice have had time to land
  setTimeout(checkSettled, 800);
}

function checkSettled() {
  const allSettled = dice.every(die => {
    const vel = die.body.velocity.length();
    const angVel = die.body.angularVelocity.length();
    const isAsleep = die.body.sleepState === CANNON.Body.SLEEPING;
    return isAsleep || (vel < CONFIG.settleVelocityThreshold && angVel < CONFIG.settleAngularThreshold);
  });

  if (allSettled) {
    // Separate overlapping dice before showing result
    separateDice();
    // Give a moment for separation to complete
    setTimeout(finishRoll, 200);
  } else {
    setTimeout(checkSettled, 100);
  }
}

// Separate dice that are too close or overlapping
function separateDice() {
  if (dice.length < 2) return;

  const minDist = CONFIG.minDiceSeparation;
  const { halfWidth, halfHeight } = getViewBounds();

  // First, force all dice to floor level (no stacking)
  dice.forEach(die => {
    die.body.position.y = CONFIG.diceSize / 2;
    die.body.velocity.set(0, 0, 0);
    die.body.angularVelocity.set(0, 0, 0);
  });

  // Then separate horizontally if too close
  for (let iterations = 0; iterations < 10; iterations++) {
    let needsMoreSeparation = false;

    for (let i = 0; i < dice.length; i++) {
      for (let j = i + 1; j < dice.length; j++) {
        const posA = dice[i].body.position;
        const posB = dice[j].body.position;

        // Distance in XZ plane only (horizontal)
        const dx = posB.x - posA.x;
        const dz = posB.z - posA.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < minDist) {
          needsMoreSeparation = true;

          // Calculate separation vector
          const overlap = minDist - dist;
          let nx, nz;

          if (dist > 0.01) {
            nx = dx / dist;
            nz = dz / dist;
          } else {
            // If exactly overlapping, push in random direction
            const angle = Math.random() * Math.PI * 2;
            nx = Math.cos(angle);
            nz = Math.sin(angle);
          }

          // Push both dice apart equally
          const push = overlap / 2 + 0.1;
          posA.x -= nx * push;
          posA.z -= nz * push;
          posB.x += nx * push;
          posB.z += nz * push;

          // Keep within bounds
          posA.x = Math.max(-halfWidth + 0.5, Math.min(halfWidth - 0.5, posA.x));
          posA.z = Math.max(-halfHeight + 0.5, Math.min(halfHeight - 0.5, posA.z));
          posB.x = Math.max(-halfWidth + 0.5, Math.min(halfWidth - 0.5, posB.x));
          posB.z = Math.max(-halfHeight + 0.5, Math.min(halfHeight - 0.5, posB.z));
        }
      }
    }

    if (!needsMoreSeparation) break;
  }

  // Sync mesh positions
  dice.forEach(die => {
    die.mesh.position.copy(die.body.position);
  });
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
  shakeEnabled = localStorage.getItem('diceRoller_shakeEnabled') === 'true';
  updateShakeUI();

  if (shakeEnabled) {
    requestMotionPermission().then(granted => {
      if (granted) startShakeListening();
    });
  }

  shakeToggle.addEventListener('click', toggleShake);
}

async function toggleShake() {
  if (!shakeEnabled) {
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
  const now = Date.now();

  // Track peak acceleration during shake gesture
  if (total > CONFIG.shakeThreshold) {
    // Smooth the peak reading
    peakAcceleration = Math.max(
      peakAcceleration * (1 - CONFIG.shakeIntensity.smoothing),
      total
    );

    // Check if enough time has passed since last roll
    if (now - lastShakeTime > CONFIG.shakeTimeout) {
      lastShakeTime = now;

      // Map acceleration to intensity (0.2 to 1.0)
      const { min, max } = CONFIG.shakeIntensity;
      const normalizedAcc = Math.min(1, Math.max(0, (peakAcceleration - min) / (max - min)));
      const intensity = 0.2 + normalizedAcc * 0.8;

      // Roll with calculated intensity
      rollDice(intensity);

      // Reset peak for next shake
      peakAcceleration = 0;
    }
  } else {
    // Decay peak when not shaking
    peakAcceleration *= 0.9;
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
  rollButton.addEventListener('click', rollDice);
  rollButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    rollDice();
  });

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

  window.addEventListener('resize', onResize);

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
  initWalls();
}

// ============================================
// ANIMATION LOOP
// ============================================
function animate() {
  animationId = requestAnimationFrame(animate);

  // Fixed timestep for consistent physics
  world.step(1 / 60);

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
