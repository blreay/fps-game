import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player, playerSettings } from './player.js';
import { WeaponSystem } from './weapons.js';
import { EnemyManager } from './enemy.js';
import { SceneManager } from './scene.js';
import { HUD } from './hud.js';
import { AudioManager } from './audio.js';
import { Effects } from './effects.js';
import { TurretManager } from './turret.js';
import { WaveManager } from './wave-manager.js';

const urlParams = new URLSearchParams(window.location.search);
const CURRENT_LEVEL = parseInt(urlParams.get('level')) || 1;

let renderer, scene, physicsWorld, clock;
let player, weaponSystem, enemyManager, sceneManager, hud, audio, effects;
let turretManager = null;
let waveManager = null;
let shipHealth = 0;
let maxShipHealth = 0;
let gameState = 'menu';
let killCount = 0;
let TOTAL_ENEMIES = 30;

let _ready = false;

async function init() {
  // Register UI event listeners first so buttons always work
  document.getElementById('btn-enter').addEventListener('click', startGame);
  document.getElementById('btn-resume').addEventListener('click', resumeGame);
  document.getElementById('btn-retry').addEventListener('click', () => location.reload());
  document.getElementById('btn-menu').addEventListener('click', () => location.href = '/');
  document.getElementById('btn-menu-dead').addEventListener('click', () => location.href = '/');
  document.getElementById('btn-menu-win').addEventListener('click', () => location.href = '/');
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && gameState === 'playing') pauseGame();
  });
  window.addEventListener('resize', onResize);
  _initVolumeSliders();

  const btnEnter = document.getElementById('btn-enter');
  btnEnter.textContent = '加载中...';
  btnEnter.disabled = true;

  try {
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
  } catch (e) {
    document.getElementById('screen-lock').innerHTML = '<h2 style="color:red">WebGL 不可用</h2><p>' + e.message + '</p>';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x87ceeb, 0.004);
  scene.background = new THREE.Color(0x4a90d9);

  physicsWorld = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
  physicsWorld.broadphase = new CANNON.SAPBroadphase(physicsWorld);
  physicsWorld.allowSleep = true;

  clock = new THREE.Clock();

  const levelFile = CURRENT_LEVEL === 2 ? 'data/level02.json' : 'data/level01.json';
  const weaponsFile = CURRENT_LEVEL === 2 ? 'data/weapons_level02.json' : 'data/weapons.json';
  const [weaponsData, levelData] = await Promise.all([
    fetch(weaponsFile).then(r => r.json()),
    fetch(levelFile).then(r => r.json())
  ]);

  hud = new HUD();
  audio = new AudioManager();
  effects = new Effects(scene);
  sceneManager = new SceneManager(scene, physicsWorld);
  player = new Player(scene, physicsWorld, renderer.domElement);
  weaponSystem = new WeaponSystem(scene, physicsWorld, player.camera, effects, audio);
  enemyManager = new EnemyManager(scene, physicsWorld, audio, effects);

  await sceneManager.loadLevel(levelData);
  await weaponSystem.loadWeapons(weaponsData);
  enemyManager.spawnFromConfig(levelData);
  await audio.loadSounds(weaponsData);

  if (CURRENT_LEVEL === 2 && levelData.type === 'naval') {
    turretManager = new TurretManager(scene, audio);
    turretManager.loadFromConfig(levelData.turrets);
    waveManager = new WaveManager(scene, physicsWorld, audio, effects);
    shipHealth = levelData.shipHealth;
    maxShipHealth = levelData.shipHealth;
    TOTAL_ENEMIES = 0;
    waveManager.onWaveComplete = () => { audio.playWaveComplete(); };
    waveManager.onAllComplete = () => winGame();
    waveManager.loadFromConfig(levelData.waves);
    document.getElementById('ship-health-block')?.classList.remove('hidden');
    document.getElementById('wave-indicator')?.classList.remove('hidden');
  }

  document.addEventListener('mousemove', e => {
    if (turretManager?.isInTurret() && document.pointerLockElement) {
      turretManager.activeTurret.rotate(e.movementX, e.movementY, 0.002);
    }
  });

  renderer.setAnimationLoop(gameLoop);
  _ready = true;
  btnEnter.textContent = '进入战场';
  btnEnter.disabled = false;
}

function startGame() {
  if (!_ready) return;
  document.getElementById('screen-lock').classList.add('hidden');
  renderer.domElement.requestPointerLock();
  gameState = 'playing';
  audio.playMusic('assets/music/battle_bgm.mp3');
}

function pauseGame() {
  gameState = 'paused';
  document.getElementById('screen-pause').classList.remove('hidden');
}

function resumeGame() {
  document.getElementById('screen-pause').classList.add('hidden');
  renderer.domElement.requestPointerLock();
  gameState = 'playing';
}

function gameLoop() {
  const delta = Math.min(clock.getDelta(), 0.05);
  if (gameState !== 'playing') { renderer.render(scene, player.camera); return; }

  if (!turretManager?.isInTurret()) {
    player.update(delta);
    try { physicsWorld.step(1 / 60, delta, 3); } catch (e) { console.error('Physics error:', e); }
    player.syncFromPhysics();
  } else {
    turretManager.update(player.camera);
  }

  try {
    enemyManager.update(delta, player.position);
    enemyManager.enemies.forEach(e => {
      if (e.isDead) return;
      const dmg = e.getAttackDamage?.();
      if (dmg > 0) { player.takeDamage(dmg); hud.flashDamage(); audio.playHurt(); }
    });
  } catch (err) { console.error('Enemy error:', err); }

  try {
    weaponSystem.update(delta, player.camera, (hit) => {
      if (hit.enemy) {
        hit.enemy.takeDamage(hit.damage);
        hud.showHitMarker();
        effects.spawnBlood(hit.point);
        if (hit.enemy.isDead) {
          killCount++;
          hud.showKillFeed(hit.enemy.type);
          if (TOTAL_ENEMIES > 0 && killCount >= TOTAL_ENEMIES) winGame();
        }
      } else if (hit.object?.userData?.shipEnemy) {
        hit.object.userData.shipEnemy.takeDamage(hit.damage);
        hud.showHitMarker();
        effects.spawnExplosion(hit.point);
      } else if (hit.surface) {
        effects.spawnBulletDecal(hit.point, hit.normal, hit.object);
      }
    }, player.input);
  } catch (err) { console.error('Weapon error:', err); }

  if (player.isDead && gameState === 'playing') {
    gameState = 'dead';
    document.exitPointerLock();
    audio.playDeath();
    setTimeout(() => document.getElementById('screen-dead').classList.remove('hidden'), 1500);
  }

  const nearPickups = sceneManager.getPickupsNear(player.position, 1.5);
  if (nearPickups.length > 0 && player.input.pickup) {
    nearPickups.forEach(p => {
      if (p.type === 'medkit') player.heal(30);
      else if (p.type === 'ammo') weaponSystem.addAmmo(30);
      sceneManager.removePickup(p.id);
      audio.playPickup(p.type);
    });
  }

  // Naval level systems
  if (turretManager) {
    if (turretManager.isInTurret()) {
      if (player.input.fire) {
        const shot = turretManager.activeTurret.tryFire(performance.now());
        if (shot) {
          audio.playCannon();
          const raycaster = new THREE.Raycaster(shot.origin, shot.direction, 0, 300);
          const hits = raycaster.intersectObjects(scene.children, true);
          for (const hit of hits) {
            const ship = hit.object.userData?.shipEnemy;
            if (ship) {
              ship.takeDamage(shot.damage);
              effects.spawnExplosion(hit.point);
              hud.showHitMarker();
              break;
            }
            const enemy = hit.object.userData?.enemy;
            if (enemy) {
              enemy.takeDamage(shot.damage);
              effects.spawnBlood(hit.point);
              hud.showHitMarker();
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
    const shipDmg = waveManager.getDamageToPlayerShip();
    if (shipDmg > 0) {
      shipHealth = Math.max(0, shipHealth - shipDmg);
      hud.flashDamage();
      if (shipHealth <= 0 && gameState === 'playing') {
        gameState = 'dead';
        document.exitPointerLock();
        audio.playDeath();
        setTimeout(() => document.getElementById('screen-dead').classList.remove('hidden'), 1500);
      }
    }
    const playerDmg = waveManager.getPlayerDamage();
    if (playerDmg > 0) {
      player.takeDamage(playerDmg);
      hud.flashDamage();
      audio.playHurt();
    }
  }

  if (CURRENT_LEVEL === 2) {
    const nearTurret = turretManager?.getNearestInteractable(player.position);
    hud.updateNaval?.(shipHealth, maxShipHealth, (waveManager?.currentWave || 0) + 1, nearTurret?.name);
  }

  hud.update(player, weaponSystem, killCount, TOTAL_ENEMIES);
  audio.setListenerPosition(player.position);
  renderer.render(scene, player.camera);
}

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

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  player.camera.aspect = window.innerWidth / window.innerHeight;
  player.camera.updateProjectionMatrix();
}

function _initVolumeSliders() {
  const volIds = ['master', 'fire', 'reload', 'enemy', 'effects', 'music'];
  volIds.forEach(cat => {
    const slider = document.getElementById(`vol-${cat}`);
    if (!slider) return;
    slider.addEventListener('input', () => {
      const val = parseInt(slider.value) / 100;
      if (audio) audio.setVolume(cat, val);
      const span = slider.nextElementSibling;
      if (span) span.textContent = slider.value + '%';
    });
  });

  const gameMap = {
    'set-walk': { key: 'walkSpeed', mult: 1 },
    'set-sprint': { key: 'sprintSpeed', mult: 1 },
    'set-crouch': { key: 'crouchSpeed', mult: 1 },
    'set-jump': { key: 'jumpForce', mult: 1 },
    'set-sens': { key: 'mouseSensitivity', mult: 0.0005 },
    'set-stamdr': { key: 'staminaDrain', mult: 1 },
    'set-stamrg': { key: 'staminaRegen', mult: 1 }
  };
  Object.entries(gameMap).forEach(([id, cfg]) => {
    const slider = document.getElementById(id);
    if (!slider) return;
    slider.addEventListener('input', () => {
      const raw = parseInt(slider.value);
      playerSettings[cfg.key] = raw * cfg.mult;
      const span = slider.nextElementSibling;
      if (span) span.textContent = raw;
    });
  });
}

init().catch(err => {
  console.error(err);
  const el = document.getElementById('screen-lock');
  if (el) el.innerHTML = `<h2 style="color:#ff4444">加载失败</h2><p style="color:#aaa;max-width:600px;word-break:break-all">${err.message}<br><br>${err.stack || ''}</p><button onclick="location.reload()" style="margin-top:20px;padding:8px 24px;border:1px solid #c8a96e;background:transparent;color:#c8a96e;cursor:pointer">重试</button>`;
});
