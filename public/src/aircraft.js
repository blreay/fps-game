import * as THREE from 'three';

export class Aircraft {
  constructor(scene, spawnPos, audio) {
    this.scene = scene;
    this.audio = audio;
    this.hp = 1;
    this.isDead = false;
    this._pos = new THREE.Vector3(spawnPos.x, spawnPos.y, spawnPos.z);
    this._speed = 8 + Math.random() * 4;
    this._phase = Math.random() * Math.PI * 2;
    this._attackTimer = 2 + Math.random() * 3;
    this._attackInterval = 3 + Math.random() * 2;
    this._pendingDamage = 0;
    this._orbitRadius = 30 + Math.random() * 20;
    this._orbitCenter = new THREE.Vector3(0, spawnPos.y, 0);

    this.mesh = this._buildMesh();
    this.mesh.position.copy(this._pos);
    this.mesh.userData.enemy = this;
    this.mesh.traverse(c => { c.userData.enemy = this; });
    scene.add(this.mesh);
  }

  _buildMesh() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.6 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.7 });

    // Fuselage
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 4, 6), bodyMat);
    fuselage.rotation.x = Math.PI / 2;
    group.add(fuselage);

    // Wings
    const wingGeo = new THREE.BoxGeometry(6, 0.1, 1.2);
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.z = -0.3;
    group.add(wings);

    // Tail
    const tailGeo = new THREE.BoxGeometry(2, 0.1, 0.6);
    const tail = new THREE.Mesh(tailGeo, wingMat);
    tail.position.z = 1.8;
    group.add(tail);

    // Vertical stabilizer
    const stabGeo = new THREE.BoxGeometry(0.1, 1, 0.6);
    const stab = new THREE.Mesh(stabGeo, wingMat);
    stab.position.set(0, 0.5, 1.8);
    group.add(stab);

    // Cockpit
    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 6, 4),
      new THREE.MeshStandardMaterial({ color: 0x88aacc, metalness: 0.5 })
    );
    cockpit.position.z = -1;
    cockpit.position.y = 0.2;
    group.add(cockpit);

    return group;
  }

  getAttackDamage() {
    const d = this._pendingDamage;
    this._pendingDamage = 0;
    return d;
  }

  update(delta) {
    if (this.isDead) return;

    // Orbit around the player ship area
    this._phase += delta * this._speed * 0.03;
    this._pos.x = this._orbitCenter.x + Math.cos(this._phase) * this._orbitRadius;
    this._pos.z = this._orbitCenter.z + Math.sin(this._phase) * this._orbitRadius;
    this._pos.y = this._orbitCenter.y + Math.sin(this._phase * 2) * 3;

    this.mesh.position.copy(this._pos);
    this.mesh.rotation.y = -this._phase + Math.PI / 2;
    this.mesh.rotation.z = Math.sin(this._phase) * 0.15;

    // Strafe attack
    this._attackTimer -= delta;
    if (this._attackTimer <= 0) {
      this._attackTimer = this._attackInterval;
      this._pendingDamage = 20;
      this.audio?.playExplosion?.();
    }
  }

  takeDamage(amount) {
    if (this.isDead) return;
    this.hp -= amount;
    if (this.hp <= 0) this._die();
  }

  _die() {
    this.isDead = true;
    // Explosion + fall animation
    const startY = this._pos.y;
    let t = 0;
    const fall = () => {
      t += 0.016;
      this.mesh.position.y = startY - t * 10;
      this.mesh.rotation.x += 0.05;
      this.mesh.rotation.z += 0.03;
      this.mesh.scale.setScalar(Math.max(0, 1 - t * 0.5));
      if (t < 2) requestAnimationFrame(fall);
      else {
        this.scene.remove(this.mesh);
        this.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); });
      }
    };
    fall();
  }
}
