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

  update(camera) {
    if (!this.activeTurret) return;
    const camPos = this.activeTurret.getCamera();
    camera.position.set(camPos.x, camPos.y, camPos.z);
    const euler = new THREE.Euler(this.activeTurret._pitch, this.activeTurret._yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
  }
}
