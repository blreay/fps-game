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
  }

  _buildMesh(config) {
    const group = new THREE.Group();
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

    if (config.type === 'carrier') {
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
