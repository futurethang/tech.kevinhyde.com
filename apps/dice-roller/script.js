import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  diceSize: 1,
  diceRestitution: 0.4,
  diceFriction: 0.3,
  diceMass: 1,
  wallRestitution: 0.6,
  wallFriction: 0.2,
  throwForce: { min: 8, max: 12 },
  spinForce: { min: 15, max: 25 },
  gravity: -30,
  settleDuration: 3000,
  settleVelocityThreshold: 0.1
};

// ============================================
// GLOBAL STATE
// ============================================
let scene, camera, renderer;
let world;
let dice = [];
let diceCount = 2;
let isRolling = false;
let animationId = null;

// DOM elements
const canvas = document.getElementById('diceCanvas');
const rollButton = document.getElementById('rollButton');
const resultDisplay = document.getElementById('result');
const diceButtons = document.querySelectorAll('.dice-btn');

// ============================================
// INITIALIZATION
// ============================================
function init() {
  initThreeJS();
  initCannonWorld();
  initWalls();
  initDice();
  initEventListeners();
  registerServiceWorker();
  animate();
}

function initThreeJS() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a472a);

  // Camera - orthographic for consistent sizing
  const aspect = window.innerWidth / window.innerHeight;
  const viewSize = 8;
  camera = new THREE.OrthographicCamera(
    -viewSize * aspect / 2,
    viewSize * aspect / 2,
    viewSize / 2,
    -viewSize / 2,
    0.1,
    100
  );
  camera.position.set(0, 15, 0);
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

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 20, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -10;
  directionalLight.shadow.camera.right = 10;
  directionalLight.shadow.camera.top = 10;
  directionalLight.shadow.camera.bottom = -10;
  scene.add(directionalLight);

  // Floor (felt surface)
  const floorGeometry = new THREE.PlaneGeometry(20, 20);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a472a,
    roughness: 0.9,
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
  world.solver.iterations = 10;
  world.allowSleep = true;

  // Floor body
  const floorBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
    material: new CANNON.Material({
      friction: CONFIG.wallFriction,
      restitution: CONFIG.wallRestitution
    })
  });
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floorBody);
}

function initWalls() {
  const aspect = window.innerWidth / window.innerHeight;
  const viewSize = 8;
  const halfWidth = (viewSize * aspect) / 2 - 0.3;
  const halfHeight = viewSize / 2 - 0.3;
  const wallHeight = 5;
  const wallThickness = 0.5;

  const wallMaterial = new CANNON.Material({
    friction: CONFIG.wallFriction,
    restitution: CONFIG.wallRestitution
  });

  const walls = [
    { pos: [0, wallHeight / 2, -halfHeight], size: [halfWidth * 2, wallHeight, wallThickness] }, // Back
    { pos: [0, wallHeight / 2, halfHeight], size: [halfWidth * 2, wallHeight, wallThickness] },  // Front
    { pos: [-halfWidth, wallHeight / 2, 0], size: [wallThickness, wallHeight, halfHeight * 2] }, // Left
    { pos: [halfWidth, wallHeight / 2, 0], size: [wallThickness, wallHeight, halfHeight * 2] }   // Right
  ];

  walls.forEach(wall => {
    const wallBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(wall.size[0] / 2, wall.size[1] / 2, wall.size[2] / 2)),
      material: wallMaterial
    });
    wallBody.position.set(...wall.pos);
    world.addBody(wallBody);
  });
}

// ============================================
// DICE CREATION
// ============================================
function createDiceMesh() {
  const size = CONFIG.diceSize;
  const radius = 0.1;

  // Create rounded box geometry
  const geometry = new THREE.BoxGeometry(size, size, size, 4, 4, 4);

  // Apply slight rounding to vertices
  const positionAttr = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < positionAttr.count; i++) {
    vertex.fromBufferAttribute(positionAttr, i);
    const length = vertex.length();
    if (length > size * 0.8) {
      vertex.normalize().multiplyScalar(size * 0.5 + radius * 0.3);
      positionAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
  }

  geometry.computeVertexNormals();

  // Create dice material
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.1
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
  const dotRadius = size * 0.08;
  const dotGeometry = new THREE.SphereGeometry(dotRadius, 8, 8);
  const dotMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a472a,
    roughness: 0.5
  });

  // Dot positions for each face (1-6)
  const dotPatterns = {
    1: [[0, 0]], // Center
    2: [[-0.25, -0.25], [0.25, 0.25]], // Diagonal
    3: [[-0.25, -0.25], [0, 0], [0.25, 0.25]], // Diagonal + center
    4: [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]], // Corners
    5: [[-0.25, -0.25], [0.25, -0.25], [0, 0], [-0.25, 0.25], [0.25, 0.25]], // Corners + center
    6: [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0], [0.25, 0], [-0.25, 0.25], [0.25, 0.25]] // 2 columns of 3
  };

  // Face configurations: [axis, sign, rotationAxis, rotationAngle]
  const faces = [
    { value: 1, normal: [0, 0, 1], offset: size / 2 + 0.01 },   // Front - 1
    { value: 6, normal: [0, 0, -1], offset: size / 2 + 0.01 },  // Back - 6
    { value: 3, normal: [1, 0, 0], offset: size / 2 + 0.01 },   // Right - 3
    { value: 4, normal: [-1, 0, 0], offset: size / 2 + 0.01 },  // Left - 4
    { value: 2, normal: [0, 1, 0], offset: size / 2 + 0.01 },   // Top - 2
    { value: 5, normal: [0, -1, 0], offset: size / 2 + 0.01 }   // Bottom - 5
  ];

  faces.forEach(face => {
    const pattern = dotPatterns[face.value];
    pattern.forEach(([x, y]) => {
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);

      // Position dot based on face normal
      if (face.normal[2] !== 0) { // Front/Back
        dot.position.set(x * size, y * size, face.normal[2] * face.offset);
      } else if (face.normal[0] !== 0) { // Left/Right
        dot.position.set(face.normal[0] * face.offset, y * size, x * size);
      } else { // Top/Bottom
        dot.position.set(x * size, face.normal[1] * face.offset, y * size);
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
    linearDamping: 0.3,
    angularDamping: 0.3
  });

  return body;
}

function initDice() {
  clearDice();

  for (let i = 0; i < diceCount; i++) {
    const mesh = createDiceMesh();
    const body = createDiceBody();

    // Position off-screen initially
    const x = (i - (diceCount - 1) / 2) * 1.5;
    body.position.set(x, 0.5, 0);
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

  // Reset and throw each die
  dice.forEach((die, index) => {
    // Starting position - scattered above the play area
    const angle = (index / diceCount) * Math.PI * 2 + Math.random() * 0.5;
    const radius = 1 + Math.random();
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    die.body.position.set(x, 4 + Math.random() * 2, z);
    die.body.velocity.set(0, 0, 0);
    die.body.angularVelocity.set(0, 0, 0);

    // Random initial rotation
    die.body.quaternion.setFromEuler(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    // Apply throw force
    const throwForce = CONFIG.throwForce.min + Math.random() * (CONFIG.throwForce.max - CONFIG.throwForce.min);
    const throwAngle = Math.random() * Math.PI * 2;

    die.body.velocity.set(
      Math.cos(throwAngle) * throwForce,
      -throwForce * 0.5,
      Math.sin(throwAngle) * throwForce
    );

    // Apply spin
    const spinForce = CONFIG.spinForce.min + Math.random() * (CONFIG.spinForce.max - CONFIG.spinForce.min);
    die.body.angularVelocity.set(
      (Math.random() - 0.5) * spinForce,
      (Math.random() - 0.5) * spinForce,
      (Math.random() - 0.5) * spinForce
    );

    // Wake up the body
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
  // Get the up vector in world space
  const upVector = new THREE.Vector3(0, 1, 0);
  const dieUp = new THREE.Vector3();

  // Check each face normal
  const faceNormals = [
    { normal: new THREE.Vector3(0, 0, 1), value: 1 },   // Front
    { normal: new THREE.Vector3(0, 0, -1), value: 6 },  // Back
    { normal: new THREE.Vector3(1, 0, 0), value: 3 },   // Right
    { normal: new THREE.Vector3(-1, 0, 0), value: 4 },  // Left
    { normal: new THREE.Vector3(0, 1, 0), value: 2 },   // Top
    { normal: new THREE.Vector3(0, -1, 0), value: 5 }   // Bottom
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
  const viewSize = 8;

  camera.left = -viewSize * aspect / 2;
  camera.right = viewSize * aspect / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);

  // Rebuild walls for new aspect ratio
  // Remove old wall bodies (indices 1-4, keeping floor at 0)
  while (world.bodies.length > 1) {
    world.removeBody(world.bodies[1]);
  }
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
