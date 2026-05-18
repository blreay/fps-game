import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const STATES = { PATROL: 'PATROL', ALERT: 'ALERT', CHASE: 'CHASE', ATTACK: 'ATTACK', DEAD: 'DEAD' };
const ENEMY_CONFIGS = {
  infantry: { hp: 1, speed: 4, attackDamage: 20, fovDeg: 60, fovRange: 20, attackRange: 8 },
  heavy: { hp: 1, speed: 2.5, attackDamage: 35, fovDeg: 45, fovRange: 15, attackRange: 6 },
  sniper: { hp: 1, speed: 2, attackDamage: 60, fovDeg: 80, fovRange: 40, attackRange: 35 },
  bird: { hp: 1, speed: 6, attackDamage: 5, fovDeg: 360, fovRange: 30, attackRange: 3 },
  eagle: { hp: 1, speed: 8, attackDamage: 15, fovDeg: 360, fovRange: 50, attackRange: 5 },
  bat: { hp: 1, speed: 10, attackDamage: 8, fovDeg: 360, fovRange: 25, attackRange: 2 }
};

const FLYING_TYPES = new Set(['bird', 'eagle', 'bat']);

export class Enemy {
  constructor(scene, physicsWorld, type, position, audio, effects) {
    this.scene = scene;
    this.type = type;
    this.audio = audio;
    this.effects = effects;
    this.config = { ...ENEMY_CONFIGS[type] };
    this.hp = this.config.hp;
    this.state = STATES.PATROL;
    this._alertTimer = 0;
    this._lostTimer = 0;
    this._attackCooldown = 0;
    this._patrolPoints = [];
    this._patrolIdx = 0;
    this._yaw = 0;
    this.isDead = false;
    this._pendingDamage = 0;
    this._isFlying = FLYING_TYPES.has(type);
    this._flyHeight = position.y;
    this._flyPhase = Math.random() * Math.PI * 2;
    this._wingPhase = 0;

    const mesh = this._isFlying ? this._createFlyingMesh(type) : this._createGroundMesh(type);
    this.mesh = mesh;
    this.mesh.castShadow = true;
    this.mesh.userData.enemy = this;
    this.mesh.traverse(child => { child.userData.enemy = this; });
    scene.add(this.mesh);

    if (this._isFlying) {
      this.body = null;
      this._pos = new THREE.Vector3(position.x, position.y, position.z);
      this.mesh.position.copy(this._pos);
    } else {
      const h = type === 'heavy' ? 2.0 : 1.8;
      const shape = new CANNON.Box(new CANNON.Vec3(0.3, h / 2, 0.3));
      this.body = new CANNON.Body({ mass: 70, linearDamping: 0.99, angularDamping: 1 });
      this.body.addShape(shape);
      this.body.position.set(position.x, position.y + h / 2, position.z);
      this.body.fixedRotation = true;
      physicsWorld.addBody(this.body);
    }
  }

  _createGroundMesh(type) {
    const colors = { infantry: 0x556644, heavy: 0x664444, sniper: 0x446666 };
    const h = type === 'heavy' ? 2.0 : 1.8;
    const geo = new THREE.BoxGeometry(0.6, h, 0.6);
    const mat = new THREE.MeshStandardMaterial({ color: colors[type] });
    return new THREE.Mesh(geo, mat);
  }

  _createFlyingMesh(type) {
    const group = new THREE.Group();
    const colors = { bird: 0x8B4513, eagle: 0x4a3728, bat: 0x222222 };
    const sizes = { bird: 0.3, eagle: 0.5, bat: 0.25 };
    const wingSpans = { bird: 0.8, eagle: 1.4, bat: 0.7 };
    const color = colors[type];
    const size = sizes[type];
    const wingSpan = wingSpans[type];

    const bodyGeo = new THREE.ConeGeometry(size * 0.4, size * 1.5, 6);
    bodyGeo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color });
    const body = new THREE.Mesh(bodyGeo, mat);
    group.add(body);

    const wingGeo = new THREE.PlaneGeometry(wingSpan, size * 0.8);
    const wingMat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide });
    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.set(-wingSpan / 2, 0, 0);
    leftWing.name = 'leftWing';
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo.clone(), wingMat);
    rightWing.position.set(wingSpan / 2, 0, 0);
    rightWing.name = 'rightWing';
    group.add(rightWing);

    if (type === 'eagle') {
      const headGeo = new THREE.SphereGeometry(size * 0.35, 6, 6);
      const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xffffff }));
      head.position.set(0, 0.1, -size * 0.8);
      group.add(head);
    }

    return group;
  }

  setPatrolPoints(points) { this._patrolPoints = points; }

  getAttackDamage() {
    const d = this._pendingDamage;
    this._pendingDamage = 0;
    return d;
  }

  update(delta, playerPos) {
    if (this.isDead) return;

    if (this._isFlying) {
      this._updateFlying(delta, playerPos);
      return;
    }

    const myPos = { x: this.body.position.x, z: this.body.position.z };
    const forward = { x: Math.sin(this._yaw), z: Math.cos(this._yaw) };
    const dx = playerPos.x - myPos.x, dz = playerPos.z - myPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const angleToPlayer = Math.atan2(dx, dz);
    const enemyAngle = Math.atan2(forward.x, forward.z);
    let angleDiff = Math.abs(angleToPlayer - enemyAngle);
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
    const sees = dist <= this.config.fovRange && angleDiff <= (this.config.fovDeg * Math.PI / 180) / 2;

    if (this.state === STATES.ALERT) this._alertTimer += delta;
    else this._alertTimer = 0;
    if (this.state === STATES.CHASE && !sees) this._lostTimer += delta;
    else this._lostTimer = 0;

    const next = this._getNext(sees, dist);
    if (next !== this.state && next === STATES.ALERT) this.audio?.playAlert?.(myPos);
    this.state = next;

    switch (this.state) {
      case STATES.PATROL: this._doPatrol(delta); break;
      case STATES.CHASE: this._moveTo(delta, playerPos, this.config.speed); break;
      case STATES.ATTACK: this._doAttack(delta, playerPos); break;
    }

    const p = this.body.position;
    this.mesh.position.set(p.x, p.y, p.z);
    if (sees || this.state === STATES.CHASE || this.state === STATES.ATTACK) {
      this._yaw = Math.atan2(dx, dz);
    }
    this.mesh.rotation.y = this._yaw;
  }

  _updateFlying(delta, playerPos) {
    this._flyPhase += delta;
    this._wingPhase += delta * (this.type === 'bat' ? 15 : 8);

    const dx = playerPos.x - this._pos.x;
    const dz = playerPos.z - this._pos.z;
    const dy = (playerPos.y + 2) - this._pos.y;
    const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
    const sees = dist <= this.config.fovRange;

    if (this.state === STATES.ALERT) this._alertTimer += delta;
    else this._alertTimer = 0;

    const next = this._getNext(sees, dist);
    this.state = next;

    if (this.state === STATES.PATROL) {
      if (this._patrolPoints.length > 0) {
        const target = this._patrolPoints[this._patrolIdx % this._patrolPoints.length];
        const tdx = target.x - this._pos.x, tdz = target.z - this._pos.z;
        const tDist = Math.sqrt(tdx * tdx + tdz * tdz);
        if (tDist < 3) this._patrolIdx = (this._patrolIdx + 1) % this._patrolPoints.length;
        const speed = this.config.speed;
        if (tDist > 0.5) {
          this._pos.x += (tdx / tDist) * speed * delta;
          this._pos.z += (tdz / tDist) * speed * delta;
        }
      } else {
        this._pos.x += Math.sin(this._flyPhase * 0.5) * this.config.speed * delta * 0.3;
        this._pos.z += Math.cos(this._flyPhase * 0.3) * this.config.speed * delta * 0.3;
      }
      this._pos.y = this._flyHeight + Math.sin(this._flyPhase * 2) * 1.5;
    } else if (this.state === STATES.CHASE || this.state === STATES.ATTACK) {
      const speed = this.config.speed;
      if (dist > this.config.attackRange * 0.5) {
        this._pos.x += (dx / dist) * speed * delta;
        this._pos.y += (dy / dist) * speed * delta;
        this._pos.z += (dz / dist) * speed * delta;
      }
      if (this.state === STATES.ATTACK) this._doAttack(delta, playerPos);
    }

    this.mesh.position.copy(this._pos);
    this._yaw = Math.atan2(dx, dz);
    this.mesh.rotation.y = this._yaw;

    const leftWing = this.mesh.getObjectByName('leftWing');
    const rightWing = this.mesh.getObjectByName('rightWing');
    if (leftWing) leftWing.rotation.z = Math.sin(this._wingPhase) * 0.6;
    if (rightWing) rightWing.rotation.z = -Math.sin(this._wingPhase) * 0.6;
  }

  _getNext(sees, dist) {
    if (this.hp <= 0) return STATES.DEAD;
    switch (this.state) {
      case STATES.PATROL: return sees ? STATES.ALERT : STATES.PATROL;
      case STATES.ALERT: return this._alertTimer >= 0.8 ? STATES.CHASE : STATES.ALERT;
      case STATES.CHASE:
        if (dist <= this.config.attackRange) return STATES.ATTACK;
        if (!sees && this._lostTimer >= 5) return STATES.PATROL;
        return STATES.CHASE;
      case STATES.ATTACK: return dist > this.config.attackRange * 1.5 ? STATES.CHASE : STATES.ATTACK;
      default: return this.state;
    }
  }

  _doPatrol(delta) {
    if (this._patrolPoints.length === 0) return;
    const target = this._patrolPoints[this._patrolIdx % this._patrolPoints.length];
    const dx = target.x - (this.body ? this.body.position.x : this._pos.x);
    const dz = target.z - (this.body ? this.body.position.z : this._pos.z);
    if (Math.sqrt(dx*dx + dz*dz) < 1.5) this._patrolIdx = (this._patrolIdx + 1) % this._patrolPoints.length;
    if (this.body) this._moveTo(delta, target, 3);
  }

  _moveTo(delta, target, speed) {
    const dx = target.x - this.body.position.x, dz = target.z - this.body.position.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.5) return;
    this.body.velocity.x = (dx / len) * speed;
    this.body.velocity.z = (dz / len) * speed;
    this._yaw = Math.atan2(dx, dz);
  }

  _doAttack(delta, playerPos) {
    this._attackCooldown -= delta;
    if (this._attackCooldown <= 0) {
      this._attackCooldown = this._isFlying ? 2.0 : 1.5;
      this._pendingDamage = this.config.attackDamage;
    }
  }

  takeDamage(amount) {
    if (this.isDead) return;
    this.hp -= amount;
    this.audio?.playHurt?.({ x: this.mesh.position.x, z: this.mesh.position.z });
    if (this.hp <= 0) this._die();
  }

  _die() {
    this.isDead = true;
    this.state = STATES.DEAD;
    if (this.body) this.body.velocity.set(0, 0, 0);
    this._playDeathAnimation();
  }

  _playDeathAnimation() {
    const pos = this.mesh.position.clone();
    const scene = this.scene;
    const mesh = this.mesh;

    const isFlying = this._isFlying;
    const particles = [];
    const particleCount = isFlying ? 12 : 20;
    const colors = isFlying
      ? [0x8B4513, 0x654321, 0x3d2b1f, 0xffffff]
      : [0x880000, 0x556644, 0x664444, 0xff4400];

    for (let i = 0; i < particleCount; i++) {
      const size = 0.06 + Math.random() * 0.12;
      const geo = new THREE.SphereGeometry(size, 4, 4);
      const mat = new THREE.MeshStandardMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        emissive: 0xff2200,
        emissiveIntensity: 0.5,
        transparent: true, opacity: 1
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        Math.random() * 0.8,
        (Math.random() - 0.5) * 0.5
      ));
      p._vel = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        3 + Math.random() * 6,
        (Math.random() - 0.5) * 8
      );
      p._life = 0;
      scene.add(p);
      particles.push(p);
    }

    const flash = new THREE.PointLight(0xff4400, 5, 8);
    flash.position.copy(pos);
    scene.add(flash);

    let elapsed = 0;
    const duration = 1.2;
    const animate = () => {
      elapsed += 0.016;
      const t = elapsed / duration;

      mesh.position.y += 0.08;
      mesh.rotation.x += 0.15;
      mesh.rotation.z += 0.1;
      const s = Math.max(0, 1 - t * 1.5);
      mesh.scale.setScalar(s);

      particles.forEach(p => {
        p._life += 0.016;
        p.position.addScaledVector(p._vel, 0.016);
        p._vel.y -= 9.8 * 0.016;
        p.material.opacity = Math.max(0, 1 - p._life / duration);
        const ps = Math.max(0, 1 - p._life / duration);
        p.scale.setScalar(ps);
      });

      flash.intensity = Math.max(0, 5 * (1 - t * 3));

      if (elapsed < duration) {
        requestAnimationFrame(animate);
      } else {
        scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        particles.forEach(p => { scene.remove(p); p.geometry.dispose(); p.material.dispose(); });
        scene.remove(flash);
      }
    };
    requestAnimationFrame(animate);
  }
}

export class EnemyManager {
  constructor(scene, physicsWorld, audio, effects) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.audio = audio;
    this.effects = effects;
    this.enemies = [];
  }

  spawnFromConfig(levelConfig) {
    levelConfig.enemies.forEach((cfg, i) => {
      const e = new Enemy(this.scene, this.physicsWorld, cfg.type, { x: cfg.x, y: cfg.y ?? 0, z: cfg.z }, this.audio, this.effects);
      const groupIdx = Math.floor(i / 5) % (levelConfig.patrolPoints?.length || 1);
      if (levelConfig.patrolPoints?.[groupIdx]) e.setPatrolPoints(levelConfig.patrolPoints[groupIdx]);
      this.enemies.push(e);
    });
  }

  update(delta, playerPos) { this.enemies.forEach(e => e.update(delta, playerPos)); }
  get aliveCount() { return this.enemies.filter(e => !e.isDead).length; }
}
