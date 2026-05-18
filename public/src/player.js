import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const WALK_SPEED = 8;
const SPRINT_SPEED = 13;
const CROUCH_SPEED = 4;
const JUMP_FORCE = 9;
const STAMINA_DRAIN = 30;
const STAMINA_REGEN = 20;
const MOUSE_SENSITIVITY = 0.002;

export class Player {
  constructor(scene, physicsWorld, canvas) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.hp = 5000;
    this.stamina = 100;
    this.isDead = false;
    this._onGround = false;

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 1.7, 0);

    const shape = new CANNON.Sphere(0.4);
    this.body = new CANNON.Body({ mass: 80, linearDamping: 0.99, angularDamping: 1 });
    this.body.addShape(shape);
    this.body.position.set(0, 2, 0);
    this.body.fixedRotation = true;
    this.body.updateMassProperties();
    physicsWorld.addBody(this.body);

    this.body.addEventListener('collide', (e) => {
      const normal = e.contact.ni;
      if (Math.abs(normal.y) > 0.5) this._onGround = true;
    });

    this.input = { forward:false, back:false, left:false, right:false, jump:false, sprint:false, crouch:false, pickup:false, fire:false, ads:false, reload:false, grenade:false };
    this._pitch = 0;
    this._yaw = 0;
    this._bindInputs(canvas);
  }

  _bindInputs(canvas) {
    const keys = this.input;
    const keyMap = { KeyW:'forward', KeyS:'back', KeyA:'left', KeyD:'right', Space:'jump', ShiftLeft:'sprint', ControlLeft:'crouch', KeyR:'reload', KeyG:'grenade', KeyF:'pickup' };
    document.addEventListener('keydown', e => { if (keyMap[e.code]) keys[keyMap[e.code]] = true; });
    document.addEventListener('keyup', e => { if (keyMap[e.code]) keys[keyMap[e.code]] = false; });
    document.addEventListener('mousemove', e => {
      if (!document.pointerLockElement) return;
      this._yaw -= e.movementX * MOUSE_SENSITIVITY;
      this._pitch -= e.movementY * MOUSE_SENSITIVITY;
      this._pitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this._pitch));
    });
    const onDown = e => { if (e.button === 0) keys.fire = true; if (e.button === 2) keys.ads = true; };
    const onUp = e => { if (e.button === 0) keys.fire = false; if (e.button === 2) keys.ads = false; };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointerup', onUp);
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  update(delta) {
    if (this.isDead) return;
    this._onGround = false;
    const isSprinting = this.input.sprint && !this.input.crouch && this.stamina > 0;
    const speed = this.input.crouch ? CROUCH_SPEED : (isSprinting ? SPRINT_SPEED : WALK_SPEED);
    if (isSprinting) this.stamina = Math.max(0, this.stamina - STAMINA_DRAIN * delta);
    else this.stamina = Math.min(100, this.stamina + STAMINA_REGEN * delta);

    const forward = new THREE.Vector3(-Math.sin(this._yaw), 0, -Math.cos(this._yaw));
    const right = new THREE.Vector3(Math.cos(this._yaw), 0, -Math.sin(this._yaw));
    const move = new THREE.Vector3();
    if (this.input.forward) move.add(forward);
    if (this.input.back) move.sub(forward);
    if (this.input.right) move.add(right);
    if (this.input.left) move.sub(right);
    if (move.length() > 0) move.normalize();

    this.body.velocity.x = move.x * speed;
    this.body.velocity.z = move.z * speed;

    if (this.input.jump && this._onGround) {
      this.body.velocity.y = JUMP_FORCE;
      this.input.jump = false;
    }
  }

  syncFromPhysics() {
    const { x, y, z } = this.body.position;
    const eyeHeight = this.input.crouch ? 1.1 : 1.7;
    this.camera.position.set(x, y + eyeHeight, z);
    const euler = new THREE.Euler(this._pitch, this._yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  get position() { return { x: this.body.position.x, y: this.body.position.y, z: this.body.position.z }; }

  takeDamage(amount) {
    if (this.isDead) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) this.isDead = true;
  }

  heal(amount) {
    if (this.isDead) return;
    this.hp = Math.min(5000, this.hp + amount);
  }
}
