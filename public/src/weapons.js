import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class WeaponSystem {
  constructor(scene, physicsWorld, camera, effects, audio) {
    this.scene = scene;
    this.camera = camera;
    this.effects = effects;
    this.audio = audio;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 200;
    this.weapons = {};
    this.slots = { melee: null, primary: null, secondary: null };
    this.equippedSlot = 'primary';
    this.ammo = {};
    this._lastFired = 0;
    this._isReloading = false;
    this._reloadTimeout = null;
    this._loader = new GLTFLoader();
    this._bindKeys();
  }

  _bindKeys() {
    document.addEventListener('keydown', e => {
      if (e.code === 'Digit1') this.equip('melee');
      if (e.code === 'Digit2') this.equip('primary');
      if (e.code === 'Digit3') this.equip('secondary');
      if (e.code === 'KeyR') this.reload();
    });
    document.addEventListener('wheel', e => {
      const order = ['melee','primary','secondary'];
      const idx = order.indexOf(this.equippedSlot);
      this.equip(order[(idx + (e.deltaY > 0 ? 1 : -1) + 3) % 3]);
    });
  }

  async loadWeapons(configs) {
    for (const cfg of configs) {
      this.weapons[cfg.id] = cfg;
      if (cfg.slot !== 'melee') this.ammo[cfg.id] = { current: cfg.magSize, reserve: cfg.reserveAmmo };
      if (!this.slots[cfg.slot]) this.slots[cfg.slot] = cfg.id;
      this._createPlaceholderModel(cfg);
      this._loadModel(cfg).catch(() => {});
    }
    this.scene.add(this.camera);
    this._showCurrentWeapon();
  }

  async _loadModel(cfg) {
    try {
      const gltf = await this._loader.loadAsync(cfg.model);
      const mesh = gltf.scene;
      mesh.name = `viewmodel_${cfg.id}`;
      mesh.visible = false;
      mesh.scale.setScalar(0.05);
      mesh.position.set(0.15, -0.15, -0.35);
      if (cfg._mesh) this.camera.remove(cfg._mesh);
      this.camera.add(mesh);
      cfg._mesh = mesh;
      if (this.slots[this.equippedSlot] === cfg.id) mesh.visible = true;
    } catch(e) {}
  }

  _createPlaceholderModel(cfg) {
    const geo = new THREE.BoxGeometry(0.05, 0.05, 0.3);
    const mat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `viewmodel_${cfg.id}`;
    mesh.position.set(0.15, -0.15, -0.35);
    mesh.visible = false;
    this.camera.add(mesh);
    cfg._mesh = mesh;
  }

  _showCurrentWeapon() {
    Object.values(this.weapons).forEach(w => { if (w._mesh) w._mesh.visible = false; });
    const cur = this.currentWeapon;
    if (cur?._mesh) cur._mesh.visible = true;
  }

  equip(slot) {
    if (!this.slots[slot]) return;
    this.equippedSlot = slot;
    this._isReloading = false;
    if (this._reloadTimeout) clearTimeout(this._reloadTimeout);
    this._showCurrentWeapon();
  }

  get currentWeapon() { return this.weapons[this.slots[this.equippedSlot]] || null; }

  get currentAmmo() {
    const w = this.currentWeapon;
    if (!w || w.slot === 'melee') return { current: Infinity, reserve: Infinity };
    return this.ammo[w.id] || { current: 0, reserve: 0 };
  }

  reload() {
    const w = this.currentWeapon;
    if (!w || w.slot === 'melee' || this._isReloading) return;
    const ammo = this.ammo[w.id];
    if (ammo.current >= w.magSize || ammo.reserve <= 0) return;
    this._isReloading = true;
    this.audio.playReload(w.id);
    this._reloadTimeout = setTimeout(() => {
      const needed = w.magSize - ammo.current;
      const take = Math.min(needed, ammo.reserve);
      ammo.current += take;
      ammo.reserve -= take;
      this._isReloading = false;
    }, w.reloadTime * 1000);
  }

  addAmmo(amount) {
    const w = this.currentWeapon;
    if (!w || w.slot === 'melee') return;
    this.ammo[w.id].reserve += amount;
  }

  update(delta, camera, onHit, playerInput) {
    const w = this.currentWeapon;
    if (!w) return;
    const now = performance.now();

    const isFiring = playerInput.fire;
    const isAds = playerInput.ads;

    const targetFOV = isAds ? 45 : 75;
    camera.fov += (targetFOV - camera.fov) * 0.15;
    camera.updateProjectionMatrix();

    if (isFiring && !this._isReloading) {
      const ammo = w.slot === 'melee' ? { current: 1 } : this.ammo[w.id];
      const interval = w.slot === 'melee' ? (1000 / w.attackRate) : (60000 / w.fireRate);
      if (ammo.current > 0 && (now - this._lastFired) >= interval) {
        this._fire(w, camera, onHit, now);
      } else if (ammo.current <= 0 && w.slot !== 'melee') {
        this.audio.playEmpty(w.id);
        this._lastFired = now;
      }
    }
  }

  _fire(weapon, camera, onHit, now) {
    const ammo = weapon.slot !== 'melee' ? this.ammo[weapon.id] : null;
    if (weapon.id === 'shotgun') {
      for (let i = 0; i < (weapon.pellets || 8); i++) this._doRaycast(weapon, camera, onHit, true);
    } else {
      this._doRaycast(weapon, camera, onHit, false);
    }
    if (ammo) ammo.current--;
    this.audio.playFire(weapon.id);
    this.effects.spawnMuzzleFlash(camera);
    this._lastFired = now;
    if (ammo && ammo.current <= 0) setTimeout(() => this.reload(), 300);
  }

  _doRaycast(weapon, camera, onHit, spread) {
    const sx = spread ? (Math.random() - 0.5) * 0.1 : 0;
    const sy = spread ? (Math.random() - 0.5) * 0.05 : 0;
    const dir = new THREE.Vector3(sx, sy, -1).normalize();
    dir.applyQuaternion(camera.quaternion);
    this.raycaster.set(camera.position, dir);
    this.raycaster.far = weapon.range || 200;
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    if (intersects.length === 0) return;
    const hit = intersects[0];
    const enemy = hit.object.userData?.enemy;
    const dist = hit.distance;
    const falloff = Math.max(0, 1 - dist / weapon.range);
    const damage = weapon.slot === 'melee' ? weapon.damage : Math.round(weapon.damage * (0.5 + 0.5 * falloff));
    onHit({ enemy, damage, point: hit.point, normal: hit.face?.normal, object: hit.object, surface: !enemy });
  }
}
