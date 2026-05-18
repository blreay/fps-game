import { ShipEnemy } from './ship-enemy.js';
import { DolphinRider } from './dolphin-rider.js';

export class WaveManager {
  constructor(scene, physicsWorld, audio, effects) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.audio = audio;
    this.effects = effects;
    this.waves = [];
    this.currentWave = 0;
    this.state = 'idle';
    this.ships = [];
    this.dolphins = [];
    this._transitionTimer = 0;
    this.onWaveComplete = null;
    this.onAllComplete = null;
  }

  loadFromConfig(wavesConfig) {
    this.waves = wavesConfig;
    this._startWave(0);
  }

  _startWave(idx) {
    if (idx >= this.waves.length) {
      this.state = 'complete';
      if (this.onAllComplete) this.onAllComplete();
      return;
    }
    this.currentWave = idx;
    this.state = 'active';
    const wave = this.waves[idx];

    if (idx > 0) {
      this.audio?.playBossAlarm?.();
    }

    wave.ships.forEach(cfg => {
      const ship = new ShipEnemy(this.scene, cfg, this.audio, this.effects);
      this.ships.push(ship);
    });

    wave.dolphins.forEach(cfg => {
      const dolphin = new DolphinRider(this.scene, this.physicsWorld, { x: cfg.x, z: cfg.z }, this.audio);
      this.dolphins.push(dolphin);
    });
  }

  update(delta, playerPos) {
    if (this.state === 'complete') return;

    if (this.state === 'transition') {
      this._transitionTimer += delta;
      if (this._transitionTimer >= 3) {
        this._startWave(this.currentWave + 1);
      }
      return;
    }

    this.ships.forEach(s => s.update(delta));
    this.dolphins.forEach(d => d.update(delta, playerPos));

    if (this._isCurrentWaveDone()) {
      if (this.currentWave >= this.waves.length - 1) {
        this.state = 'complete';
        if (this.onAllComplete) this.onAllComplete();
      } else {
        this.state = 'transition';
        this._transitionTimer = 0;
        if (this.onWaveComplete) this.onWaveComplete(this.currentWave);
      }
    }
  }

  _isCurrentWaveDone() {
    const waveConfig = this.waves[this.currentWave];
    const waveShipCount = waveConfig.ships.length;
    const waveDolphinCount = waveConfig.dolphins.length;

    let startShipIdx = 0;
    let startDolphinIdx = 0;
    for (let i = 0; i < this.currentWave; i++) {
      startShipIdx += this.waves[i].ships.length;
      startDolphinIdx += this.waves[i].dolphins.length;
    }

    const waveShips = this.ships.slice(startShipIdx, startShipIdx + waveShipCount);
    const waveDolphins = this.dolphins.slice(startDolphinIdx, startDolphinIdx + waveDolphinCount);

    return waveShips.every(s => s.isDead) && waveDolphins.every(d => d.isDead);
  }

  getDamageToPlayerShip() {
    let total = 0;
    this.ships.forEach(s => { total += s.getDamageToPlayerShip(); });
    return total;
  }

  getPlayerDamage() {
    let total = 0;
    this.dolphins.forEach(d => { total += d.getAttackDamage(); });
    return total;
  }

  get allEnemies() {
    return [...this.dolphins];
  }

  get allShips() {
    return this.ships;
  }
}
