export class AudioManager {
  constructor() {
    this._sounds = {};
    this._bgm = null;
  }

  _load(id, src, options = {}) {
    if (this._sounds[id]) return;
    this._sounds[id] = new Howl({
      src: [src],
      volume: options.volume ?? 0.7,
      loop: options.loop ?? false,
      preload: true,
      onloaderror: () => console.warn(`Audio load failed: ${src}`)
    });
  }

  async loadSounds(weaponsConfig) {
    weaponsConfig.forEach(w => {
      if (w.sound?.fire) this._load(`${w.id}_fire`, w.sound.fire, { volume: 0.8 });
      if (w.sound?.reload) this._load(`${w.id}_reload`, w.sound.reload, { volume: 0.6 });
      if (w.sound?.empty) this._load(`${w.id}_empty`, w.sound.empty, { volume: 0.5 });
      if (w.sound?.hit) this._load(`${w.id}_hit`, w.sound.hit, { volume: 0.6 });
    });
    this._load('empty_click', 'assets/sounds/empty_click.mp3', { volume: 0.5 });
    this._load('enemy_alert', 'assets/sounds/enemy_alert.mp3', { volume: 0.6 });
    this._load('enemy_hurt', 'assets/sounds/enemy_hurt.mp3', { volume: 0.5 });
    this._load('explosion', 'assets/sounds/explosion.mp3', { volume: 0.9 });
    this._load('pickup_medkit', 'assets/sounds/pickup_medkit.mp3', { volume: 0.6 });
    this._load('pickup_ammo', 'assets/sounds/pickup_ammo.mp3', { volume: 0.5 });
    this._load('player_hurt', 'assets/sounds/player_hurt.mp3', { volume: 0.7 });
    this._load('win_music', 'assets/music/win.mp3', { volume: 0.7 });
    this._load('death_music', 'assets/music/death.mp3', { volume: 0.7 });
  }

  playFire(weaponId) { this._play(`${weaponId}_fire`); }
  playReload(weaponId) { this._play(`${weaponId}_reload`); }
  playEmpty(weaponId) { this._play('empty_click'); }
  playHit(position) { this._play3d('enemy_hurt', position); }
  playAlert(position) { this._play3d('enemy_alert', position); }
  playHurt() { this._play('player_hurt'); }
  playPickup(type) { this._play(`pickup_${type}`); }
  playWin() { if (this._bgm) this._bgm.stop(); this._play('win_music'); }
  playDeath() { if (this._bgm) this._bgm.stop(); this._play('death_music'); }

  playMusic(src) {
    if (this._bgm) this._bgm.stop();
    this._bgm = new Howl({ src: [src], loop: true, volume: 0.3 });
    this._bgm.play();
  }

  setListenerPosition(pos) { Howler.pos(pos.x, pos.y || 0, pos.z); }

  _play(id) { const s = this._sounds[id]; if (s) s.play(); }

  _play3d(id, position) {
    const s = this._sounds[id];
    if (!s) return;
    const soundId = s.play();
    if (position) s.pos(position.x, 0, position.z, soundId);
  }
}
