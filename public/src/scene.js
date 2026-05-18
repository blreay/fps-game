import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class SceneManager {
  constructor(scene, physicsWorld) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.pickups = [];
    this._pickupMeshes = {};
    this._setupLights();
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
    sun.position.set(50, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.5));
  }

  async loadLevel(levelConfig) {
    this._buildGeometry();
    this._spawnPickups(levelConfig.pickups);
  }

  _buildGeometry() {
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 0.9 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.8 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.85 });

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const gBody = new CANNON.Body({ mass: 0 });
    gBody.addShape(new CANNON.Plane());
    gBody.quaternion.setFromEuler(-Math.PI/2, 0, 0);
    this.physicsWorld.addBody(gBody);

    // Urban zone
    [{x:20,z:0,w:8,h:10,d:8},{x:30,z:12,w:6,h:7,d:6},{x:38,z:-5,w:10,h:14,d:8},{x:25,z:-18,w:6,h:8,d:10}].forEach(b => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), wallMat);
      m.position.set(b.x, b.h/2, b.z); m.castShadow = m.receiveShadow = true; this.scene.add(m);
      const body = new CANNON.Body({mass:0}); body.addShape(new CANNON.Box(new CANNON.Vec3(b.w/2,b.h/2,b.d/2)));
      body.position.set(b.x, b.h/2, b.z); this.physicsWorld.addBody(body);
    });

    // Barriers
    [{x:15,z:5,w:4,h:1.2,d:0.5},{x:22,z:-8,w:0.5,h:1.5,d:4},{x:28,z:3,w:3,h:1,d:0.5}].forEach(b => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), concreteMat);
      m.position.set(b.x, b.h/2, b.z); m.castShadow = m.receiveShadow = true; this.scene.add(m);
      const body = new CANNON.Body({mass:0}); body.addShape(new CANNON.Box(new CANNON.Vec3(b.w/2,b.h/2,b.d/2)));
      body.position.set(b.x, b.h/2, b.z); this.physicsWorld.addBody(body);
    });

    // Jungle zone
    const jungleMat = new THREE.MeshStandardMaterial({ color: 0x2d4a2d, roughness: 1 });
    for (let i = 0; i < 20; i++) {
      const h = 5 + Math.random() * 8, x = -15 - Math.random() * 30, z = 20 + Math.random() * 40;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, h), jungleMat);
      trunk.position.set(x, h/2, z); trunk.castShadow = true; this.scene.add(trunk);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.5 + Math.random()), jungleMat);
      canopy.position.set(x, h + 1.5, z); this.scene.add(canopy);
    }

    // Desert zone
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xc8a96e, roughness: 0.95 });
    for (let i = 0; i < 5; i++) {
      const r = 2 + Math.random() * 3;
      const dune = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), sandMat);
      dune.scale.y = 0.4; dune.position.set(45 + Math.random() * 25, r * 0.4 - 0.2, -20 - Math.random() * 30);
      dune.receiveShadow = true; this.scene.add(dune);
    }
    const bunker = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 8), sandMat);
    bunker.position.set(55, 1.5, -35); bunker.castShadow = bunker.receiveShadow = true; this.scene.add(bunker);
    const bBody = new CANNON.Body({mass:0}); bBody.addShape(new CANNON.Box(new CANNON.Vec3(6,1.5,4)));
    bBody.position.set(55, 1.5, -35); this.physicsWorld.addBody(bBody);
  }

  _spawnPickups(pickupsConfig) {
    pickupsConfig.forEach((p, i) => {
      const color = p.type === 'medkit' ? 0xff4444 : 0xffcc00;
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat);
      mesh.position.set(p.x, p.y, p.z); this.scene.add(mesh);
      const id = `pickup_${i}`;
      this._pickupMeshes[id] = mesh;
      this.pickups.push({ ...p, id });
    });
  }

  getPickupsNear(playerPos, radius) {
    return this.pickups.filter(p => {
      if (p._removed) return false;
      const dx = p.x - playerPos.x, dz = p.z - playerPos.z;
      return Math.sqrt(dx*dx + dz*dz) <= radius;
    });
  }

  removePickup(id) {
    const mesh = this._pickupMeshes[id];
    if (mesh) { this.scene.remove(mesh); mesh.geometry.dispose(); }
    const p = this.pickups.find(x => x.id === id);
    if (p) p._removed = true;
  }
}
