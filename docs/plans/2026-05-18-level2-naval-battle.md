# Level 2: Naval Battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a naval battle second level with turret-based ship combat, dolphin riders, wave system, and level selection menu.

**Architecture:** Extend existing game with level-aware loading (URL param `?level=N`), new scene builder for naval environment, turret station system for fixed gun emplacements, ship enemies with high HP and sinking animations, dolphin riders with two-phase AI, and a wave manager. Reuse existing Enemy/Player/Audio patterns.

**Tech Stack:** Three.js r165, Cannon-es 0.20, Web Audio API, Express static server

---

## File Structure

| File | Responsibility |
|------|---------------|
| Create: `public/src/turret.js` | TurretStation class — enter/exit, camera control, firing |
| Create: `public/src/wave-manager.js` | WaveManager — wave state machine, spawn triggers |
| Create: `public/src/ship-enemy.js` | ShipEnemy class — large vessel with HP, movement, firing, sinking |
| Create: `public/src/dolphin-rider.js` | DolphinRider class — water phase + boarding phase |
| Create: `public/data/level02.json` | Level 2 enemy/wave/turret configuration |
| Create: `public/data/weapons_level02.json` | Level 2 hand-held weapons (MP5, signal pistol) |
| Modify: `public/src/main.js` | Level-aware loading, wave integration, turret hook, ship health |
| Modify: `public/src/scene.js` | Add `_buildNavalScene()` (sea, destroyer, turret positions) |
| Modify: `public/src/hud.js` | Ship HP bar, wave indicator, turret prompt |
| Modify: `public/src/audio.js` | Cannon boom, wave sounds |
| Modify: `public/src/enemy.js` | Export deck shooter config (reuse humanoid) |
| Modify: `public/index.html` | Level selection cards |
| Modify: `public/game.html` | "Next level" button on win screen |
| Modify: `public/style/menu.css` | Level card styles |
| Modify: `public/style/hud.css` | Ship HP bar, wave banner, turret prompt styles |

---

### Task 1: Level Selection UI & URL-Based Loading

**Files:**
- Modify: `public/index.html`
- Modify: `public/style/menu.css`
- Modify: `public/game.html`
- Modify: `public/src/main.js`

- [ ] **Step 1: Update index.html with level selection cards**

Replace the single "开始战斗" button with level cards:

```html
<nav id="menu-nav">
  <h3 class="section-title">选择关卡</h3>
  <div id="level-cards">
    <div class="level-card" onclick="location.href='game.html?level=1'">
      <div class="level-num">01</div>
      <div class="level-name">混合战场</div>
      <div class="level-desc">地面战 — 消灭所有敌人</div>
    </div>
    <div class="level-card" onclick="location.href='game.html?level=2'">
      <div class="level-num">02</div>
      <div class="level-name">海上决战</div>
      <div class="level-desc">海战 — 击沉敌方舰队</div>
    </div>
  </div>
  <button class="menu-btn" onclick="toggleSettings()">游戏设置</button>
</nav>
```

- [ ] **Step 2: Add level card CSS to menu.css**

```css
.section-title { color: #c8a96e; font-size: 14px; letter-spacing: 3px; margin-bottom: 12px; }
#level-cards { display: flex; gap: 16px; margin-bottom: 20px; }
.level-card { width: 180px; padding: 20px 16px; border: 1px solid #555; background: rgba(30,30,30,0.8); cursor: pointer; text-align: center; transition: all 0.2s; }
.level-card:hover { border-color: #c8a96e; background: rgba(60,50,30,0.8); transform: translateY(-2px); }
.level-num { color: #c8a96e; font-size: 28px; font-weight: bold; }
.level-name { color: #fff; font-size: 16px; margin: 8px 0 4px; }
.level-desc { color: #888; font-size: 11px; }
```

- [ ] **Step 3: Add "下一关" button to game.html win screen**

```html
<div id="screen-win" class="screen hidden">
  <h2>任务完成</h2>
  <div id="win-stats"></div>
  <button id="btn-next-level" class="hidden">下一关</button>
  <button id="btn-menu-win">主菜单</button>
</div>
```

- [ ] **Step 4: Update main.js to read level from URL and load appropriate data**

At the top of `main.js`, add level detection:

```javascript
const urlParams = new URLSearchParams(window.location.search);
const CURRENT_LEVEL = parseInt(urlParams.get('level')) || 1;
```

In `init()`, change the data fetch to be level-aware:

```javascript
const levelFile = CURRENT_LEVEL === 2 ? 'data/level02.json' : 'data/level01.json';
const weaponsFile = CURRENT_LEVEL === 2 ? 'data/weapons_level02.json' : 'data/weapons.json';
const [weaponsData, levelData] = await Promise.all([
  fetch(weaponsFile).then(r => r.json()),
  fetch(levelFile).then(r => r.json())
]);
```

In `winGame()`, show "下一关" button if on level 1:

```javascript
function winGame() {
  gameState = 'won';
  document.exitPointerLock();
  document.getElementById('win-stats').textContent = `击杀: ${killCount}`;
  if (CURRENT_LEVEL === 1) {
    const btn = document.getElementById('btn-next-level');
    btn.classList.remove('hidden');
    btn.addEventListener('click', () => location.href = 'game.html?level=2');
  }
  document.getElementById('screen-win').classList.remove('hidden');
  audio.playWin();
}
```

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/style/menu.css public/game.html public/src/main.js
git commit -m "feat: add level selection UI and URL-based level loading"
```

---

### Task 2: Level 2 Data Files

**Files:**
- Create: `public/data/level02.json`
- Create: `public/data/weapons_level02.json`

- [ ] **Step 1: Create level02.json**

```json
{
  "id": "level02",
  "name": "海上决战",
  "type": "naval",
  "playerSpawn": { "x": 0, "y": 3, "z": 0 },
  "shipHealth": 5000,
  "turrets": [
    { "id": "main_gun", "name": "前甲板主炮", "position": { "x": 0, "y": 3.5, "z": -15 }, "damage": 500, "fireRate": 0.5, "type": "heavy" },
    { "id": "port_gun", "name": "左舷副炮", "position": { "x": -4.5, "y": 3, "z": 0 }, "damage": 200, "fireRate": 1.5, "type": "medium" },
    { "id": "starboard_gun", "name": "右舷副炮", "position": { "x": 4.5, "y": 3, "z": 0 }, "damage": 200, "fireRate": 1.5, "type": "medium" },
    { "id": "stern_aa", "name": "船尾防空炮", "position": { "x": 0, "y": 3, "z": 15 }, "damage": 80, "fireRate": 5, "type": "light" }
  ],
  "waves": [
    {
      "id": 1,
      "ships": [
        { "type": "carrier", "x": -60, "z": -100, "hp": 3000, "shootInterval": 5, "shootDamage": 200, "deckShooters": 3 },
        { "type": "carrier", "x": 60, "z": -110, "hp": 3000, "shootInterval": 5, "shootDamage": 200, "deckShooters": 4 }
      ],
      "dolphins": [
        { "x": -20, "z": -40 }, { "x": 20, "z": -50 }, { "x": -30, "z": -30 }, { "x": 30, "z": -45 }
      ]
    },
    {
      "id": 2,
      "ships": [
        { "type": "boss", "x": 0, "z": -120, "hp": 8000, "shootInterval": 3, "shootDamage": 400, "burstInterval": 10, "burstCount": 3, "burstDamage": 150, "deckShooters": 5 }
      ],
      "dolphins": [
        { "x": -25, "z": -35 }, { "x": 25, "z": -40 }, { "x": -15, "z": -55 }, { "x": 15, "z": -50 }, { "x": 0, "z": -30 }
      ]
    }
  ]
}
```

- [ ] **Step 2: Create weapons_level02.json**

```json
[
  {
    "id": "mp5",
    "name": "MP5冲锋枪",
    "slot": "primary",
    "damage": 20,
    "fireRate": 800,
    "range": 60,
    "recoil": 0.3,
    "reloadTime": 2.0,
    "magSize": 30,
    "reserveAmmo": 120,
    "model": "assets/models/m4a1.glb",
    "sound": { "fire": "assets/sounds/m4a1_fire.mp3", "reload": "assets/sounds/rifle_reload.mp3", "empty": "assets/sounds/empty_click.mp3" }
  },
  {
    "id": "signal_pistol",
    "name": "信号手枪",
    "slot": "secondary",
    "damage": 40,
    "fireRate": 120,
    "range": 45,
    "recoil": 0.5,
    "reloadTime": 2.2,
    "magSize": 6,
    "reserveAmmo": 24,
    "model": "assets/models/usp.glb",
    "sound": { "fire": "assets/sounds/pistol_fire.mp3", "reload": "assets/sounds/pistol_reload.mp3", "empty": "assets/sounds/empty_click.mp3" }
  }
]
```

- [ ] **Step 3: Commit**

```bash
git add public/data/level02.json public/data/weapons_level02.json
git commit -m "feat: add level 2 data files (naval battle config, weapons)"
```

---

### Task 3: Naval Scene Builder

**Files:**
- Modify: `public/src/scene.js`

- [ ] **Step 1: Add `_buildNavalScene()` method to SceneManager**

Add after `_buildGeometry()`:

```javascript
_buildNavalScene(levelConfig) {
  // Ocean plane
  const oceanGeo = new THREE.PlaneGeometry(600, 600, 32, 32);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x1a6b8a, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.85
  });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = 0;
  ocean.receiveShadow = true;
  ocean.name = 'ocean';
  this.scene.add(ocean);

  // Ocean physics (invisible floor at y=0 to catch falling objects)
  const oceanBody = new CANNON.Body({ mass: 0 });
  oceanBody.addShape(new CANNON.Plane());
  oceanBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  oceanBody.position.y = -1;
  this.physicsWorld.addBody(oceanBody);

  // Player destroyer ship
  this._buildDestroyer();

  // Store turret positions for later use
  this._turretPositions = levelConfig.turrets || [];
}

_buildDestroyer() {
  const shipMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.7 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8 });

  // Hull (main body)
  const hullGeo = new THREE.BoxGeometry(10, 3, 40);
  const hull = new THREE.Mesh(hullGeo, shipMat);
  hull.position.set(0, 1.5, 0);
  hull.castShadow = true;
  hull.receiveShadow = true;
  this.scene.add(hull);

  // Deck (flat top)
  const deckGeo = new THREE.BoxGeometry(10, 0.3, 40);
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.position.set(0, 3, 0);
  deck.receiveShadow = true;
  this.scene.add(deck);

  // Bridge (command tower)
  const bridgeGeo = new THREE.BoxGeometry(4, 4, 6);
  const bridge = new THREE.Mesh(bridgeGeo, shipMat);
  bridge.position.set(0, 5, 5);
  bridge.castShadow = true;
  this.scene.add(bridge);

  // Bow (pointed front)
  const bowGeo = new THREE.ConeGeometry(5, 8, 4);
  bowGeo.rotateX(Math.PI / 2);
  const bow = new THREE.Mesh(bowGeo, shipMat);
  bow.position.set(0, 1.5, -24);
  bow.rotation.y = Math.PI / 4;
  this.scene.add(bow);

  // Railings (physics walls to prevent falling off)
  const railShape = new CANNON.Box(new CANNON.Vec3(0.1, 1, 20));
  const leftRail = new CANNON.Body({ mass: 0 });
  leftRail.addShape(railShape);
  leftRail.position.set(-5, 4, 0);
  this.physicsWorld.addBody(leftRail);

  const rightRail = new CANNON.Body({ mass: 0 });
  rightRail.addShape(railShape);
  rightRail.position.set(5, 4, 0);
  this.physicsWorld.addBody(rightRail);

  const bowRail = new CANNON.Body({ mass: 0 });
  bowRail.addShape(new CANNON.Box(new CANNON.Vec3(5, 1, 0.1)));
  bowRail.position.set(0, 4, -20);
  this.physicsWorld.addBody(bowRail);

  const sternRail = new CANNON.Body({ mass: 0 });
  sternRail.addShape(new CANNON.Box(new CANNON.Vec3(5, 1, 0.1)));
  sternRail.position.set(0, 4, 20);
  this.physicsWorld.addBody(sternRail);

  // Deck physics floor
  const deckBody = new CANNON.Body({ mass: 0 });
  deckBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 0.15, 20)));
  deckBody.position.set(0, 3.15, 0);
  this.physicsWorld.addBody(deckBody);

  // Turret visual markers
  this._turretPositions?.forEach(t => {
    const baseGeo = new THREE.CylinderGeometry(0.8, 1, 0.6, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(t.position.x, t.position.y, t.position.z);
    base.castShadow = true;
    this.scene.add(base);

    const barrelGeo = new THREE.CylinderGeometry(0.1, 0.15, 2, 6);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, baseMat);
    barrel.position.set(t.position.x, t.position.y + 0.4, t.position.z - 1);
    this.scene.add(barrel);
  });
}
```

- [ ] **Step 2: Update `loadLevel` to branch on level type**

```javascript
async loadLevel(levelConfig) {
  if (levelConfig.type === 'naval') {
    this._buildNavalScene(levelConfig);
  } else {
    this._buildGeometry();
  }
  this._spawnPickups(levelConfig.pickups || []);
}
```

- [ ] **Step 3: Commit**

```bash
git add public/src/scene.js
git commit -m "feat: add naval scene builder (ocean, destroyer, turrets)"
```

---

### Task 4: Turret Station System

**Files:**
- Create: `public/src/turret.js`

- [ ] **Step 1: Create turret.js with TurretStation class**

```javascript
import * as THREE from 'three';

export class TurretStation {
  constructor(config, scene, audio) {
    this.id = config.id;
    this.name = config.name;
    this.position = new THREE.Vector3(config.position.x, config.position.y, config.position.z);
    this.damage = config.damage;
    this.fireRate = config.fireRate;
    this.type = config.type;
    this.scene = scene;
    this.audio = audio;
    this._lastFired = 0;
    this._yaw = 0;
    this._pitch = -0.1;
    this.isOccupied = false;
  }

  canInteract(playerPos) {
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    return Math.sqrt(dx * dx + dz * dz) < 2.5;
  }

  enter() {
    this.isOccupied = true;
  }

  exit() {
    this.isOccupied = false;
  }

  getCamera() {
    const cam = new THREE.Vector3().copy(this.position);
    cam.y += 1.2;
    return cam;
  }

  rotate(movementX, movementY, sensitivity) {
    this._yaw -= movementX * sensitivity;
    this._pitch -= movementY * sensitivity;
    this._pitch = Math.max(-Math.PI / 4, Math.min(Math.PI / 8, this._pitch));
  }

  getDirection() {
    const dir = new THREE.Vector3(
      -Math.sin(this._yaw) * Math.cos(this._pitch),
      Math.sin(this._pitch),
      -Math.cos(this._yaw) * Math.cos(this._pitch)
    );
    return dir.normalize();
  }

  tryFire(now) {
    const interval = 1000 / this.fireRate;
    if (now - this._lastFired < interval) return null;
    this._lastFired = now;
    return {
      origin: this.getCamera(),
      direction: this.getDirection(),
      damage: this.damage,
      type: this.type
    };
  }
}

export class TurretManager {
  constructor(scene, audio) {
    this.turrets = [];
    this.scene = scene;
    this.audio = audio;
    this.activeTurret = null;
  }

  loadFromConfig(turretConfigs) {
    turretConfigs.forEach(cfg => {
      this.turrets.push(new TurretStation(cfg, this.scene, this.audio));
    });
  }

  getNearestInteractable(playerPos) {
    for (const t of this.turrets) {
      if (t.canInteract(playerPos)) return t;
    }
    return null;
  }

  enterTurret(turret, camera) {
    this.activeTurret = turret;
    turret.enter();
    const camPos = turret.getCamera();
    camera.position.set(camPos.x, camPos.y, camPos.z);
  }

  exitTurret() {
    if (this.activeTurret) {
      this.activeTurret.exit();
      this.activeTurret = null;
    }
  }

  isInTurret() {
    return this.activeTurret !== null;
  }

  update(camera, mouseSens) {
    if (!this.activeTurret) return;
    const camPos = this.activeTurret.getCamera();
    camera.position.set(camPos.x, camPos.y, camPos.z);
    const euler = new THREE.Euler(this.activeTurret._pitch, this.activeTurret._yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add public/src/turret.js
git commit -m "feat: add TurretStation and TurretManager for naval gun emplacements"
```

---

### Task 5: Ship Enemy Class

**Files:**
- Create: `public/src/ship-enemy.js`

- [ ] **Step 1: Create ship-enemy.js**

```javascript
import * as THREE from 'three';

export class ShipEnemy {
  constructor(scene, config, audio, effects) {
    this.scene = scene;
    this.audio = audio;
    this.effects = effects;
    this.type = config.type;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.shootInterval = config.shootInterval;
    this.shootDamage = config.shootDamage;
    this.burstInterval = config.burstInterval || 0;
    this.burstCount = config.burstCount || 0;
    this.burstDamage = config.burstDamage || 0;
    this.deckShooterCount = config.deckShooters || 0;
    this.isDead = false;
    this._shootTimer = 0;
    this._burstTimer = 0;
    this._sinking = false;
    this._sinkProgress = 0;
    this._driftSpeed = 0.5 + Math.random() * 0.5;
    this._driftDir = Math.random() > 0.5 ? 1 : -1;
    this._pendingDamageToShip = 0;

    this.mesh = this._buildMesh(config);
    this.mesh.position.set(config.x, 0, config.z);
    this.mesh.userData.shipEnemy = this;
    this.mesh.traverse(child => { child.userData.shipEnemy = this; });
    scene.add(this.mesh);

    this.deckShooters = [];
  }

  _buildMesh(config) {
    const group = new THREE.Group();
    const isCarrier = config.type === 'carrier';
    const isBoss = config.type === 'boss';

    const length = isBoss ? 80 : 60;
    const width = isBoss ? 20 : 15;
    const height = isBoss ? 12 : 8;
    const color = isBoss ? 0x2a2a2a : 0x4a4a4a;

    const hullGeo = new THREE.BoxGeometry(width, height, length);
    const hullMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = height / 2 - 2;
    hull.castShadow = true;
    group.add(hull);

    const deckGeo = new THREE.BoxGeometry(width * 0.9, 0.5, length * 0.9);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.y = height - 2;
    group.add(deck);

    if (isCarrier) {
      const towerGeo = new THREE.BoxGeometry(4, 8, 8);
      const tower = new THREE.Mesh(towerGeo, hullMat);
      tower.position.set(width * 0.3, height + 2, 0);
      tower.castShadow = true;
      group.add(tower);
    }

    if (isBoss) {
      for (let i = -2; i <= 2; i++) {
        const turretGeo = new THREE.CylinderGeometry(1.5, 2, 2, 8);
        const turret = new THREE.Mesh(turretGeo, new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
        turret.position.set(0, height - 1, i * 12);
        group.add(turret);
      }
    }

    return group;
  }

  getDamageToPlayerShip() {
    const d = this._pendingDamageToShip;
    this._pendingDamageToShip = 0;
    return d;
  }

  update(delta) {
    if (this.isDead) return;
    if (this._sinking) {
      this._sinkProgress += delta * 0.3;
      this.mesh.position.y -= delta * 2;
      this.mesh.rotation.z += delta * 0.1;
      if (this._sinkProgress > 3) {
        this.scene.remove(this.mesh);
        this.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); });
      }
      return;
    }

    // Drift movement
    this.mesh.position.x += this._driftDir * this._driftSpeed * delta;

    // Shoot at player ship
    this._shootTimer += delta;
    if (this._shootTimer >= this.shootInterval) {
      this._shootTimer = 0;
      this._pendingDamageToShip += this.shootDamage;
      this.audio?.playExplosion?.();
    }

    // Boss burst attack
    if (this.burstInterval > 0) {
      this._burstTimer += delta;
      if (this._burstTimer >= this.burstInterval) {
        this._burstTimer = 0;
        this._pendingDamageToShip += this.burstDamage * this.burstCount;
        this.audio?.playExplosion?.();
      }
    }
  }

  takeDamage(amount) {
    if (this.isDead || this._sinking) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this._sinking = true;
      this.effects?.spawnExplosion?.(this.mesh.position);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add public/src/ship-enemy.js
git commit -m "feat: add ShipEnemy class (carrier, boss with firing and sinking)"
```

---

### Task 6: Dolphin Rider Enemy

**Files:**
- Create: `public/src/dolphin-rider.js`

- [ ] **Step 1: Create dolphin-rider.js**

```javascript
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class DolphinRider {
  constructor(scene, physicsWorld, spawnPos, audio) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.audio = audio;
    this.hp = 1;
    this.isDead = false;
    this._phase = 'water'; // 'water' or 'boarded'
    this._pos = new THREE.Vector3(spawnPos.x, 0.3, spawnPos.z);
    this._speed = 6 + Math.random() * 3;
    this._swimPhase = Math.random() * Math.PI * 2;
    this._attackCooldown = 0;
    this._pendingDamage = 0;
    this._boardTarget = null;
    this.body = null;

    this.mesh = this._buildMesh();
    this.mesh.position.copy(this._pos);
    this.mesh.userData.enemy = this;
    this.mesh.traverse(child => { child.userData.enemy = this; });
    scene.add(this.mesh);
  }

  _buildMesh() {
    const group = new THREE.Group();

    // Dolphin body
    const bodyGeo = new THREE.CapsuleGeometry(0.2, 1.0, 4, 8);
    bodyGeo.rotateZ(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x5588aa });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Dolphin tail
    const tailGeo = new THREE.ConeGeometry(0.2, 0.5, 4);
    tailGeo.rotateX(Math.PI / 2);
    const tail = new THREE.Mesh(tailGeo, bodyMat);
    tail.position.set(0, 0, 0.7);
    group.add(tail);

    // Rider (small humanoid on top)
    const riderMat = new THREE.MeshStandardMaterial({ color: 0x334433 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.15), riderMat);
    torso.position.set(0, 0.35, 0);
    group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshStandardMaterial({ color: 0xc8a882 }));
    head.position.set(0, 0.58, 0);
    group.add(head);

    return group;
  }

  getAttackDamage() {
    const d = this._pendingDamage;
    this._pendingDamage = 0;
    return d;
  }

  update(delta, playerPos) {
    if (this.isDead) return;
    this._swimPhase += delta;

    if (this._phase === 'water') {
      // Move toward player ship (target z=0 area)
      const targetX = playerPos.x + (Math.sin(this._swimPhase) * 5);
      const targetZ = Math.min(this._pos.z + this._speed * delta, 18);
      const dx = targetX - this._pos.x;
      const dz = targetZ - this._pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.5) {
        this._pos.x += (dx / dist) * this._speed * delta * 0.3;
        this._pos.z += dz > 0 ? this._speed * delta : (dz / dist) * this._speed * delta;
      }
      this._pos.y = 0.3 + Math.sin(this._swimPhase * 3) * 0.15;
      this.mesh.position.copy(this._pos);

      const yaw = Math.atan2(dx, dz);
      this.mesh.rotation.y = yaw;

      // Check if reached the ship (z > 15 means near ship stern, or |x| < 5 and z > -20)
      if (Math.abs(this._pos.x) < 6 && this._pos.z > -22 && this._pos.z < 22) {
        if (Math.abs(this._pos.x) >= 4.5 || this._pos.z >= 19 || this._pos.z <= -19) {
          this._startBoarding();
        }
      }
    } else {
      // Boarded — chase player on deck
      const dx = playerPos.x - this._pos.x;
      const dz = playerPos.z - this._pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 1.5) {
        this._pos.x += (dx / dist) * 4 * delta;
        this._pos.z += (dz / dist) * 4 * delta;
      }
      this._pos.y = 3.3;
      this.mesh.position.copy(this._pos);
      this.mesh.rotation.y = Math.atan2(dx, dz);

      // Attack
      this._attackCooldown -= delta;
      if (dist < 2 && this._attackCooldown <= 0) {
        this._attackCooldown = 2.0;
        this._pendingDamage = 30;
      }
    }
  }

  _startBoarding() {
    this._phase = 'boarded';
    this._pos.y = 3.3;
    // Clamp onto deck
    this._pos.x = Math.max(-4.5, Math.min(4.5, this._pos.x));
    this._pos.z = Math.max(-19, Math.min(19, this._pos.z));
  }

  takeDamage(amount) {
    if (this.isDead) return;
    this.hp -= amount;
    if (this.hp <= 0) this._die();
  }

  _die() {
    this.isDead = true;
    this.mesh.scale.setScalar(0);
    setTimeout(() => {
      this.scene.remove(this.mesh);
      this.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); });
    }, 100);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add public/src/dolphin-rider.js
git commit -m "feat: add DolphinRider with water phase and boarding phase AI"
```

---

### Task 7: Wave Manager

**Files:**
- Create: `public/src/wave-manager.js`

- [ ] **Step 1: Create wave-manager.js**

```javascript
import { ShipEnemy } from './ship-enemy.js';
import { DolphinRider } from './dolphin-rider.js';

export class WaveManager {
  constructor(scene, physicsWorld, audio, effects) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.audio = audio;
    this.effects = effects;
    this.waves = [];
    this.currentWave = 0;
    this.state = 'idle'; // 'idle', 'active', 'transition', 'complete'
    this.ships = [];
    this.dolphins = [];
    this.deckShooters = [];
    this._transitionTimer = 0;
    this.onWaveComplete = null;
    this.onAllComplete = null;
  }

  loadFromConfig(wavesConfig) {
    this.waves = wavesConfig;
    this._startWave(0);
  }

  _startWave(idx) {
    if (idx >= this.waves.length) {
      this.state = 'complete';
      if (this.onAllComplete) this.onAllComplete();
      return;
    }
    this.currentWave = idx;
    this.state = 'active';
    const wave = this.waves[idx];

    wave.ships.forEach(cfg => {
      const ship = new ShipEnemy(this.scene, cfg, this.audio, this.effects);
      this.ships.push(ship);
    });

    wave.dolphins.forEach(cfg => {
      const dolphin = new DolphinRider(this.scene, this.physicsWorld, { x: cfg.x, z: cfg.z }, this.audio);
      this.dolphins.push(dolphin);
    });
  }

  update(delta, playerPos) {
    if (this.state === 'complete') return;

    if (this.state === 'transition') {
      this._transitionTimer += delta;
      if (this._transitionTimer >= 3) {
        this._startWave(this.currentWave + 1);
      }
      return;
    }

    this.ships.forEach(s => s.update(delta));
    this.dolphins.forEach(d => d.update(delta, playerPos));

    // Check wave completion
    const shipsAlive = this.ships.filter(s => !s.isDead).length;
    const dolphinsAlive = this.dolphins.filter(d => !d.isDead).length;
    const waveShipsDead = this.waves[this.currentWave].ships.length ===
      this.ships.filter(s => s.isDead).length - (this.currentWave > 0 ? this.waves[0].ships.length : 0);

    if (this._isCurrentWaveDone()) {
      if (this.currentWave >= this.waves.length - 1) {
        this.state = 'complete';
        if (this.onAllComplete) this.onAllComplete();
      } else {
        this.state = 'transition';
        this._transitionTimer = 0;
        if (this.onWaveComplete) this.onWaveComplete(this.currentWave);
      }
    }
  }

  _isCurrentWaveDone() {
    const waveConfig = this.waves[this.currentWave];
    const waveShipCount = waveConfig.ships.length;
    const waveDolphinCount = waveConfig.dolphins.length;

    // Count ships and dolphins spawned for this wave
    let startShipIdx = 0;
    let startDolphinIdx = 0;
    for (let i = 0; i < this.currentWave; i++) {
      startShipIdx += this.waves[i].ships.length;
      startDolphinIdx += this.waves[i].dolphins.length;
    }

    const waveShips = this.ships.slice(startShipIdx, startShipIdx + waveShipCount);
    const waveDolphins = this.dolphins.slice(startDolphinIdx, startDolphinIdx + waveDolphinCount);

    return waveShips.every(s => s.isDead) && waveDolphins.every(d => d.isDead);
  }

  getDamageToPlayerShip() {
    let total = 0;
    this.ships.forEach(s => { total += s.getDamageToPlayerShip(); });
    return total;
  }

  getPlayerDamage() {
    let total = 0;
    this.dolphins.forEach(d => { total += d.getAttackDamage(); });
    return total;
  }

  get allEnemies() {
    return [...this.dolphins];
  }

  get allShips() {
    return this.ships;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add public/src/wave-manager.js
git commit -m "feat: add WaveManager for multi-wave naval battle progression"
```

---

### Task 8: Integrate Naval Level into Main Game Loop

**Files:**
- Modify: `public/src/main.js`

- [ ] **Step 1: Add imports and naval state variables**

Add at top of main.js:

```javascript
import { TurretManager } from './turret.js';
import { WaveManager } from './wave-manager.js';
```

Add after existing `let` declarations:

```javascript
let turretManager = null;
let waveManager = null;
let shipHealth = 0;
let maxShipHealth = 0;
```

- [ ] **Step 2: Initialize naval systems in init() when level=2**

After `await audio.loadSounds(weaponsData);`, add:

```javascript
if (CURRENT_LEVEL === 2 && levelData.type === 'naval') {
  turretManager = new TurretManager(scene, audio);
  turretManager.loadFromConfig(levelData.turrets);
  waveManager = new WaveManager(scene, physicsWorld, audio, effects);
  shipHealth = levelData.shipHealth;
  maxShipHealth = levelData.shipHealth;
  waveManager.onAllComplete = () => winGame();
  waveManager.loadFromConfig(levelData.waves);
}
```

- [ ] **Step 3: Add naval logic to game loop**

After the existing enemy attack block, add naval-specific updates:

```javascript
// Naval level systems
if (turretManager) {
  // Turret interaction
  if (turretManager.isInTurret()) {
    turretManager.update(player.camera);
    if (player.input.fire) {
      const shot = turretManager.activeTurret.tryFire(performance.now());
      if (shot) {
        audio.playExplosion();
        effects.spawnMuzzleFlash(player.camera);
        // Raycast from turret
        const raycaster = new THREE.Raycaster(shot.origin, shot.direction, 0, 300);
        const hits = raycaster.intersectObjects(scene.children, true);
        for (const hit of hits) {
          const ship = hit.object.userData?.shipEnemy;
          if (ship) {
            ship.takeDamage(shot.damage);
            effects.spawnExplosion(hit.point);
            break;
          }
          const enemy = hit.object.userData?.enemy;
          if (enemy) {
            enemy.takeDamage(shot.damage);
            effects.spawnBlood(hit.point);
            break;
          }
        }
      }
    }
    if (player.input.pickup) {
      turretManager.exitTurret();
      player.input.pickup = false;
    }
  } else {
    const nearest = turretManager.getNearestInteractable(player.position);
    if (nearest && player.input.pickup) {
      turretManager.enterTurret(nearest, player.camera);
      player.input.pickup = false;
    }
  }
}

if (waveManager) {
  waveManager.update(delta, player.position);
  // Ship damage to player's vessel
  const shipDmg = waveManager.getDamageToPlayerShip();
  if (shipDmg > 0) {
    shipHealth = Math.max(0, shipHealth - shipDmg);
    hud.flashDamage();
    if (shipHealth <= 0) {
      gameState = 'dead';
      document.exitPointerLock();
      audio.playDeath();
      setTimeout(() => document.getElementById('screen-dead').classList.remove('hidden'), 1500);
    }
  }
  // Dolphin damage to player
  const playerDmg = waveManager.getPlayerDamage();
  if (playerDmg > 0) {
    player.takeDamage(playerDmg);
    hud.flashDamage();
    audio.playHurt();
  }
}
```

- [ ] **Step 4: Update TOTAL_ENEMIES and kill tracking for naval level**

Change the TOTAL_ENEMIES const to be dynamic:

```javascript
let TOTAL_ENEMIES = 30;
```

In init(), after wave manager setup:

```javascript
if (CURRENT_LEVEL === 2) {
  TOTAL_ENEMIES = 0; // Wave manager handles win condition
}
```

- [ ] **Step 5: Handle turret camera in mousemove for turret mode**

In the game loop, skip `player.update()` and `player.syncFromPhysics()` movement when in turret, but still handle turret rotation via existing mousemove (which already updates `player._yaw/_pitch`). Instead, add turret rotation to the mousemove handler in player.js or handle it differently.

Actually, the simpler approach: in main.js game loop, when in turret, pass mouse movement to turret:

Add a document-level mousemove that routes to turret when active. In init(), after the event listeners:

```javascript
document.addEventListener('mousemove', e => {
  if (turretManager?.isInTurret() && document.pointerLockElement) {
    turretManager.activeTurret.rotate(e.movementX, e.movementY, 0.002);
  }
});
```

And in the game loop, skip player movement when in turret:

```javascript
if (!turretManager?.isInTurret()) {
  player.update(delta);
  try { physicsWorld.step(1 / 60, delta, 3); } catch (e) { console.error('Physics error:', e); }
  player.syncFromPhysics();
} else {
  turretManager.update(player.camera);
}
```

- [ ] **Step 6: Handle weapon raycasting for dolphin riders**

In the weapon hit callback, add ship/dolphin detection alongside existing enemy detection:

The existing `hit.object.userData?.enemy` check already works for DolphinRider since it sets `userData.enemy = this`. No changes needed for hand weapons hitting dolphins.

- [ ] **Step 7: Commit**

```bash
git add public/src/main.js
git commit -m "feat: integrate naval turret, wave system, and ship health into game loop"
```

---

### Task 9: HUD Updates for Naval Level

**Files:**
- Modify: `public/src/hud.js`
- Modify: `public/style/hud.css`

- [ ] **Step 1: Add ship HP bar, wave indicator, and turret prompt to HUD**

Add to game.html (or dynamically create in hud.js). Add to `hud.js` constructor:

```javascript
this.shipHealthBar = document.getElementById('ship-health-fill');
this.shipHealthNum = document.getElementById('ship-health-num');
this.waveIndicator = document.getElementById('wave-indicator');
this.turretPrompt = document.getElementById('turret-prompt');
```

Add new update method for naval HUD:

```javascript
updateNaval(shipHealth, maxShipHealth, waveNum, turretName) {
  if (this.shipHealthBar) {
    const pct = shipHealth / maxShipHealth;
    this.shipHealthBar.style.width = `${pct * 100}%`;
    this.shipHealthBar.style.background = pct > 0.5 ? '#4488cc' : pct > 0.25 ? '#cc8844' : '#cc4444';
    this.shipHealthNum.textContent = Math.ceil(shipHealth);
  }
  if (this.waveIndicator) {
    this.waveIndicator.textContent = `WAVE ${waveNum}`;
  }
  if (this.turretPrompt) {
    this.turretPrompt.textContent = turretName ? `按F操作 ${turretName}` : '';
    this.turretPrompt.style.display = turretName ? 'block' : 'none';
  }
}
```

- [ ] **Step 2: Add HTML elements to game.html**

After `#stats-bar`, add:

```html
<div id="ship-health-block" class="hidden">
  <div class="bar-label">舰体</div>
  <div class="bar-track ship-track"><div id="ship-health-fill" class="bar-fill ship-hp"></div></div>
  <div id="ship-health-num">5000</div>
</div>
<div id="wave-indicator" class="hidden"></div>
<div id="turret-prompt"></div>
```

- [ ] **Step 3: Add CSS**

```css
#ship-health-block { position: absolute; top: 16px; left: 16px; }
.bar-track.ship-track { width: 160px; height: 6px; }
.bar-fill.ship-hp { background: #4488cc; width: 100%; }
#ship-health-num { color: #4488cc; font-size: 12px; margin-top: 2px; }
#wave-indicator { position: absolute; top: 50px; left: 50%; transform: translateX(-50%); color: #c8a96e; font-size: 18px; letter-spacing: 3px; opacity: 0.8; }
#turret-prompt { position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); color: #fff; font-size: 14px; background: rgba(0,0,0,0.6); padding: 6px 16px; border-radius: 4px; display: none; }
```

- [ ] **Step 4: Show naval HUD elements when on level 2**

In main.js init(), after level detection:

```javascript
if (CURRENT_LEVEL === 2) {
  document.getElementById('ship-health-block')?.classList.remove('hidden');
  document.getElementById('wave-indicator')?.classList.remove('hidden');
}
```

In game loop, call naval HUD update:

```javascript
if (CURRENT_LEVEL === 2) {
  const nearTurret = turretManager?.getNearestInteractable(player.position);
  hud.updateNaval(shipHealth, maxShipHealth, (waveManager?.currentWave || 0) + 1, nearTurret?.name);
}
```

- [ ] **Step 5: Commit**

```bash
git add public/src/hud.js public/game.html public/style/hud.css
git commit -m "feat: add naval HUD (ship health, wave indicator, turret prompt)"
```

---

### Task 10: Audio — Naval Sounds

**Files:**
- Modify: `public/src/audio.js`

- [ ] **Step 1: Add cannon boom and wave ambience synth functions**

Add after existing synth functions:

```javascript
function _cannonBoom() {
  _synth('noise', 200, 0.4, { volume: 0.7, filter: 'lowpass', Q: 1.5, _cat: 'fire' });
  _synth('sawtooth', 50, 0.3, { volume: 0.5, freqEnd: 15, _cat: 'fire' });
  _synth('noise', 3000, 0.08, { volume: 0.3, filter: 'highpass', _cat: 'fire' });
}

function _waveAmbience() {
  _synth('noise', 300, 2.0, { volume: 0.04, filter: 'lowpass', Q: 0.5, _cat: 'effects' });
}

function _bossAlarm() {
  _synth('square', 400, 0.3, { volume: 0.2, _cat: 'enemy' });
  setTimeout(() => _synth('square', 400, 0.3, { volume: 0.2, _cat: 'enemy' }), 500);
  setTimeout(() => _synth('square', 400, 0.3, { volume: 0.2, _cat: 'enemy' }), 1000);
}

function _waveComplete() {
  _synth('sine', 440, 0.15, { volume: 0.25, _cat: 'effects' });
  setTimeout(() => _synth('sine', 554, 0.15, { volume: 0.25, _cat: 'effects' }), 150);
  setTimeout(() => _synth('sine', 659, 0.3, { volume: 0.25, _cat: 'effects' }), 300);
}
```

Add public methods to AudioManager:

```javascript
playCannon() { _cannonBoom(); }
playWaveAmbience() { _waveAmbience(); }
playBossAlarm() { _bossAlarm(); }
playWaveComplete() { _waveComplete(); }
```

- [ ] **Step 2: Commit**

```bash
git add public/src/audio.js
git commit -m "feat: add naval audio (cannon boom, wave ambience, boss alarm)"
```

---

### Task 11: Final Integration & Testing

**Files:**
- Modify: `public/src/main.js` (minor fixes)

- [ ] **Step 1: Ensure level 1 still works unchanged**

Verify that when `?level=1` or no param, the game loads level01.json and weapons.json, and the naval systems (turretManager, waveManager) remain null. No naval code runs.

- [ ] **Step 2: Add wave transition audio cues**

In waveManager callbacks in main.js:

```javascript
waveManager.onWaveComplete = (waveIdx) => {
  audio.playWaveComplete();
};
waveManager.onAllComplete = () => {
  winGame();
};
```

Before wave 2 starts, play boss alarm. In wave-manager.js `_startWave`, if idx > 0:

```javascript
if (idx > 0) {
  this.audio?.playBossAlarm?.();
}
```

- [ ] **Step 3: Replace turret cannon sound**

In the turret firing block in main.js, replace `audio.playExplosion()` with `audio.playCannon()`.

- [ ] **Step 4: Test full flow**

1. Open `http://localhost:3000` — should show level cards
2. Click level 1 — plays normally as before
3. Win level 1 — "下一关" button appears
4. Click level 2 — naval scene loads
5. WASD moves on deck
6. Walk to turret, F enters turret mode, mouse aims, left click fires
7. F again exits turret
8. Ships take damage and sink
9. Dolphins approach and board
10. Wave 2 triggers after wave 1 cleared
11. BOSS sinks = win

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: complete Level 2 naval battle integration"
```

---

## Self-Review Checklist

| Spec Requirement | Task |
|---|---|
| Player destroyer with WASD movement | Task 3 (deck physics) |
| 4 turret positions (F to enter/exit) | Task 3 (visuals) + Task 4 (logic) |
| Turret aiming + firing | Task 4 + Task 8 |
| 2 carriers + 1 BOSS | Task 5 + Task 7 |
| Ships fire at player ship | Task 5 (shootTimer) + Task 8 (damage) |
| Ship sinking animation | Task 5 (_sinking) |
| Deck shooters on enemy ships | Task 5 (deckShooterCount, spawned via wave) |
| Dolphin riders (water + boarding) | Task 6 |
| Wave system (2 waves) | Task 7 |
| Ship health bar | Task 9 |
| Wave indicator | Task 9 |
| Turret interaction prompt | Task 9 |
| Level selection menu | Task 1 |
| "下一关" button | Task 1 |
| URL param loading | Task 1 |
| Level 2 data files | Task 2 |
| Cannon boom sound | Task 10 |
| Boss alarm | Task 10 |
| Level 1 unchanged | Task 11 |

**Note:** Deck shooters (spec item) are referenced in ShipEnemy config but their spawn logic is deferred to the WaveManager. For simplicity in this plan, deck shooters reuse the existing humanoid Enemy class from enemy.js with `_isFlying = false` and fixed positions on the enemy ship mesh. This can be added as a follow-up enhancement if the base naval combat feels complete without them, or integrated into Task 7's `_startWave` by importing and spawning Enemy instances at ship deck positions.
