import * as THREE from 'three';

export class DolphinRider {
  constructor(scene, physicsWorld, spawnPos, audio) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.audio = audio;
    this.hp = 1;
    this.isDead = false;
    this._phase = 'water';
    this._pos = new THREE.Vector3(spawnPos.x, 0.3, spawnPos.z);
    this._speed = 6 + Math.random() * 3;
    this._swimPhase = Math.random() * Math.PI * 2;
    this._attackCooldown = 0;
    this._pendingDamage = 0;

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

      if (Math.abs(this._pos.x) < 6 && this._pos.z > -22 && this._pos.z < 22) {
        if (Math.abs(this._pos.x) >= 4.5 || this._pos.z >= 19 || this._pos.z <= -19) {
          this._startBoarding();
        }
      }
    } else {
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
