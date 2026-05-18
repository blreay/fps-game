import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player } from './player.js';
import { WeaponSystem } from './weapons.js';
import { EnemyManager } from './enemy.js';
import { SceneManager } from './scene.js';
import { HUD } from './hud.js';
import { AudioManager } from './audio.js';
import { Effects } from './effects.js';

let renderer, scene, physicsWorld, clock;
let player, weaponSystem, enemyManager, sceneManager, hud, audio, effects;
let gameState = 'menu';
let killCount = 0;
const TOTAL_ENEMIES = 30;

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
  scene.fog = new THREE.FogExp2(0x8b9a6b, 0.008);
  scene.background = new THREE.Color(0x6b7a5a);

  physicsWorld = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
  physicsWorld.broadphase = new CANNON.SAPBroadphase(physicsWorld);
  physicsWorld.allowSleep = true;

  clock = new THREE.Clock();

  const [weaponsData, levelData] = await Promise.all([
    fetch('data/weapons.json').then(r => r.json()),
    fetch('data/level01.json').then(r => r.json())
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

  try {
    player.update(delta);
    physicsWorld.step(1 / 60, delta, 3);
    player.syncFromPhysics();

    enemyManager.update(delta, player.position);
    enemyManager.enemies.forEach(e => {
      if (e.isDead) return;
      const dmg = e.getAttackDamage?.();
      if (dmg > 0) { player.takeDamage(dmg); hud.flashDamage(); audio.playHurt(); }
    });

    weaponSystem.update(delta, player.camera, (hit) => {
      if (hit.enemy) {
        hit.enemy.takeDamage(hit.damage);
        hud.showHitMarker();
        effects.spawnBlood(hit.point);
        if (hit.enemy.isDead) {
          killCount++;
          hud.showKillFeed(hit.enemy.type);
          if (killCount >= TOTAL_ENEMIES) winGame();
        }
      } else if (hit.surface) {
        effects.spawnBulletDecal(hit.point, hit.normal, hit.object);
      }
    }, player.input);

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

    hud.update(player, weaponSystem, killCount, TOTAL_ENEMIES);
    audio.setListenerPosition(player.position);
  } catch (err) {
    console.error('Game loop error:', err);
  }

  renderer.render(scene, player.camera);
}

function winGame() {
  gameState = 'won';
  document.exitPointerLock();
  document.getElementById('win-stats').textContent = `击杀: ${killCount} / ${TOTAL_ENEMIES}`;
  document.getElementById('screen-win').classList.remove('hidden');
  audio.playWin();
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  player.camera.aspect = window.innerWidth / window.innerHeight;
  player.camera.updateProjectionMatrix();
}

init().catch(err => {
  console.error(err);
  const el = document.getElementById('screen-lock');
  if (el) el.innerHTML = `<h2 style="color:#ff4444">加载失败</h2><p style="color:#aaa;max-width:600px;word-break:break-all">${err.message}<br><br>${err.stack || ''}</p><button onclick="location.reload()" style="margin-top:20px;padding:8px 24px;border:1px solid #c8a96e;background:transparent;color:#c8a96e;cursor:pointer">重试</button>`;
});
