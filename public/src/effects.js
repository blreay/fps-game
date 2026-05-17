import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this._decalMat = new THREE.MeshStandardMaterial({
      color: 0x333333, transparent: true, opacity: 0.8,
      depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4
    });
    this._bloodMat = new THREE.MeshStandardMaterial({
      color: 0x880000, transparent: true, opacity: 0.7,
      depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4
    });
  }

  spawnMuzzleFlash(camera) {
    const light = new THREE.PointLight(0xffaa44, 4, 3);
    light.position.set(0, -0.1, -0.4);
    camera.add(light);
    setTimeout(() => camera.remove(light), 60);
  }

  spawnBlood(position) {
    for (let i = 0; i < 6; i++) {
      const size = 0.05 + Math.random() * 0.08;
      const geo = new THREE.SphereGeometry(size, 4, 4);
      const mesh = new THREE.Mesh(geo, this._bloodMat.clone());
      mesh.position.copy(position).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.3, Math.random() * 0.3, (Math.random() - 0.5) * 0.3
      ));
      this.scene.add(mesh);
      setTimeout(() => { this.scene.remove(mesh); mesh.geometry.dispose(); }, 800);
    }
  }

  spawnBulletDecal(point, normal, mesh) {
    if (!mesh?.isMesh || !normal) return;
    try {
      const size = new THREE.Vector3(0.15, 0.15, 0.15);
      const decalGeo = new DecalGeometry(mesh, point, new THREE.Euler(), size);
      const decal = new THREE.Mesh(decalGeo, this._decalMat.clone());
      this.scene.add(decal);
      setTimeout(() => { this.scene.remove(decal); decalGeo.dispose(); }, 15000);
    } catch (e) {}
  }

  spawnExplosion(position) {
    const light = new THREE.PointLight(0xff6600, 8, 20);
    light.position.copy(position);
    this.scene.add(light);
    for (let i = 0; i < 20; i++) {
      const geo = new THREE.SphereGeometry(0.08 + Math.random() * 0.12, 4, 4);
      const mat = new THREE.MeshStandardMaterial({
        color: Math.random() > 0.5 ? 0xff4400 : 0xffaa00,
        emissive: 0xff4400, emissiveIntensity: 1
      });
      const particle = new THREE.Mesh(geo, mat);
      particle.position.copy(position);
      const vel = new THREE.Vector3((Math.random()-0.5)*10, Math.random()*8, (Math.random()-0.5)*10);
      this.scene.add(particle);
      let t = 0;
      const animate = () => {
        t += 0.016;
        particle.position.addScaledVector(vel, 0.016);
        vel.y -= 9.8 * 0.016;
        if (t < 1) requestAnimationFrame(animate);
        else { this.scene.remove(particle); particle.geometry.dispose(); }
      };
      requestAnimationFrame(animate);
    }
    setTimeout(() => this.scene.remove(light), 300);
  }
}
