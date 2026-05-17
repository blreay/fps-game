import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const STATES = { PATROL: 'PATROL', ALERT: 'ALERT', CHASE: 'CHASE', ATTACK: 'ATTACK', DEAD: 'DEAD' };
const ENEMY_CONFIGS = {
  infantry: { hp: 80, speed: 4, attackDamage: 20, fovDeg: 60, fovRange: 20, attackRange: 8 },
  heavy: { hp: 200, speed: 2.5, attackDamage: 35, fovDeg: 45, fovRange: 15, attackRange: 6 },
  sniper: { hp: 50, speed: 2, attackDamage: 60, fovDeg: 80, fovRange: 40, attackRange: 35 }
};

export class Enemy {
  constructor(scene, physicsWorld, type, position, audio) {
    this.scene = scene;
    this.type = type;
    this.audio = audio;
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

    const colors = { infantry: 0x556644, heavy: 0x664444, sniper: 0x446666 };
    const h = type === 'heavy' ? 2.0 : 1.8;
    const geo = new THREE.BoxGeometry(0.6, h, 0.6);
    const mat = new THREE.MeshStandardMaterial({ color: colors[type] });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.userData.enemy = this;
    scene.add(this.mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(0.3, h / 2, 0.3));
    this.body = new CANNON.Body({ mass: 70, linearDamping: 0.99, angularDamping: 1 });
    this.body.addShape(shape);
    this.body.position.set(position.x, position.y + h / 2, position.z);
    this.body.fixedRotation = true;
    physicsWorld.addBody(this.body);
  }

  setPatrolPoints(points) { this._patrolPoints = points; }

  getAttackDamage() {
    const d = this._pendingDamage;
    this._pendingDamage = 0;
    return d;
  }

  update(delta, playerPos) {
    if (this.isDead) return;
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
    const dx = target.x - this.body.position.x, dz = target.z - this.body.position.z;
    if (Math.sqrt(dx*dx + dz*dz) < 1.5) this._patrolIdx = (this._patrolIdx + 1) % this._patrolPoints.length;
    this._moveTo(delta, target, 3);
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
      this._attackCooldown = 1.5;
      this._pendingDamage = this.config.attackDamage;
    }
  }

  takeDamage(amount) {
    if (this.isDead) return;
    this.hp -= amount;
    this.audio?.playHurt?.({ x: this.body.position.x, z: this.body.position.z });
    if (this.hp <= 0) this._die();
  }

  _die() {
    this.isDead = true;
    this.state = STATES.DEAD;
    this.mesh.rotation.z = Math.PI / 2;
    this.body.velocity.set(0, 0, 0);
    setTimeout(() => { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); }, 2000);
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
      const e = new Enemy(this.scene, this.physicsWorld, cfg.type, { x: cfg.x, y: cfg.y ?? 0, z: cfg.z }, this.audio);
      const groupIdx = Math.floor(i / 5) % (levelConfig.patrolPoints?.length || 1);
      if (levelConfig.patrolPoints?.[groupIdx]) e.setPatrolPoints(levelConfig.patrolPoints[groupIdx]);
      this.enemies.push(e);
    });
  }

  update(delta, playerPos) { this.enemies.forEach(e => e.update(delta, playerPos)); }
  get aliveCount() { return this.enemies.filter(e => !e.isDead).length; }
}
