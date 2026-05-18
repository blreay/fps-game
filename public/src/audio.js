const _ctx = typeof AudioContext !== 'undefined' ? new AudioContext() : null;

function _synth(type, freq, duration, opts = {}) {
  if (!_ctx) return;
  const t = _ctx.currentTime;
  const gain = _ctx.createGain();
  gain.connect(_ctx.destination);
  gain.gain.setValueAtTime(opts.volume ?? 0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  if (type === 'noise') {
    const bufSize = _ctx.sampleRate * duration;
    const buf = _ctx.createBuffer(1, bufSize, _ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = _ctx.createBufferSource();
    src.buffer = buf;
    if (opts.filter) {
      const filt = _ctx.createBiquadFilter();
      filt.type = opts.filter;
      filt.frequency.value = freq;
      filt.Q.value = opts.Q ?? 1;
      src.connect(filt);
      filt.connect(gain);
    } else {
      src.connect(gain);
    }
    src.start(t);
    src.stop(t + duration);
  } else {
    const osc = _ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + duration);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + duration);
  }
}

function _rifleShot() {
  _synth('noise', 2000, 0.12, { volume: 0.6, filter: 'lowpass', Q: 2 });
  _synth('noise', 5000, 0.06, { volume: 0.4, filter: 'highpass' });
  _synth('sawtooth', 120, 0.08, { volume: 0.3, freqEnd: 40 });
}
function _sniperShot() {
  _synth('noise', 1500, 0.25, { volume: 0.7, filter: 'lowpass', Q: 3 });
  _synth('noise', 8000, 0.04, { volume: 0.5, filter: 'highpass' });
  _synth('sawtooth', 80, 0.15, { volume: 0.4, freqEnd: 20 });
}
function _pistolShot() {
  _synth('noise', 3000, 0.08, { volume: 0.4, filter: 'lowpass', Q: 2 });
  _synth('square', 200, 0.05, { volume: 0.2, freqEnd: 60 });
}
function _shotgunShot() {
  _synth('noise', 1200, 0.2, { volume: 0.7, filter: 'lowpass', Q: 1.5 });
  _synth('noise', 6000, 0.08, { volume: 0.3, filter: 'highpass' });
  _synth('sawtooth', 60, 0.15, { volume: 0.4, freqEnd: 20 });
}
function _deagleShot() {
  _synth('noise', 1800, 0.15, { volume: 0.65, filter: 'lowpass', Q: 2.5 });
  _synth('sawtooth', 150, 0.1, { volume: 0.35, freqEnd: 30 });
}
function _knifeSlash() {
  _synth('noise', 6000, 0.1, { volume: 0.25, filter: 'highpass' });
}
function _reload() {
  setTimeout(() => _synth('noise', 4000, 0.05, { volume: 0.2, filter: 'bandpass', Q: 3 }), 0);
  setTimeout(() => _synth('noise', 3000, 0.08, { volume: 0.25, filter: 'bandpass', Q: 2 }), 200);
  setTimeout(() => _synth('noise', 5000, 0.04, { volume: 0.15, filter: 'highpass' }), 500);
}
function _emptyClick() {
  _synth('noise', 8000, 0.03, { volume: 0.15, filter: 'highpass', Q: 5 });
}
function _explosion() {
  _synth('noise', 400, 0.6, { volume: 0.8, filter: 'lowpass', Q: 1 });
  _synth('sawtooth', 60, 0.4, { volume: 0.5, freqEnd: 15 });
}
function _hurt() {
  _synth('sawtooth', 300, 0.15, { volume: 0.25, freqEnd: 100 });
}
function _alert() {
  _synth('square', 500, 0.1, { volume: 0.2 });
  setTimeout(() => _synth('square', 700, 0.1, { volume: 0.2 }), 150);
}
function _pickup() {
  _synth('sine', 600, 0.08, { volume: 0.2 });
  setTimeout(() => _synth('sine', 900, 0.08, { volume: 0.2 }), 100);
}
function _heartbeat() {
  _synth('sine', 50, 0.15, { volume: 0.3 });
  setTimeout(() => _synth('sine', 45, 0.12, { volume: 0.25 }), 200);
}

const FIRE_SYNTH = {
  ak47: _rifleShot, m4a1: _rifleShot, awp: _sniperShot,
  usp: _pistolShot, deagle: _deagleShot, shotgun: _shotgunShot,
  dagger: _knifeSlash, combat_knife: _knifeSlash
};

let _howlAvailable = typeof Howl !== 'undefined';
let _bgm = null;
let _bgmSrc = null;

export class AudioManager {
  constructor() {
    this._sounds = {};
    this._smallFiles = new Set();
  }

  _load(id, src, options = {}) {
    if (this._sounds[id] || !_howlAvailable) return;
    this._sounds[id] = new Howl({
      src: [src],
      volume: options.volume ?? 0.7,
      loop: options.loop ?? false,
      preload: true,
      onloaderror: () => { this._smallFiles.add(id); },
      onload: function() {
        if (this.duration() < 0.05) {
          // Placeholder file — mark as silent
        }
      }
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

  _play(id) {
    if (_ctx && _ctx.state === 'suspended') _ctx.resume();
    const s = this._sounds[id];
    if (s) s.play();
  }

  playFire(weaponId) {
    this._play(`${weaponId}_fire`);
    const fn = FIRE_SYNTH[weaponId];
    if (fn) fn();
  }

  playReload(weaponId) {
    this._play(`${weaponId}_reload`);
    _reload();
  }

  playEmpty(weaponId) {
    this._play('empty_click');
    _emptyClick();
  }

  playHit(position) { this._play('enemy_hurt'); }
  playAlert(position) { this._play('enemy_alert'); _alert(); }
  playHurt() { this._play('player_hurt'); _hurt(); }

  playPickup(type) {
    this._play(`pickup_${type}`);
    _pickup();
  }

  playExplosion() { this._play('explosion'); _explosion(); }
  playWin() { this._stopBgm(); this._play('win_music'); _synth('sine', 523, 0.3, { volume: 0.3 }); setTimeout(() => _synth('sine', 659, 0.3, { volume: 0.3 }), 300); setTimeout(() => _synth('sine', 784, 0.5, { volume: 0.3 }), 600); }
  playDeath() { this._stopBgm(); this._play('death_music'); _synth('sawtooth', 200, 0.5, { volume: 0.2, freqEnd: 50 }); }

  playMusic(src) {
    if (_ctx && _ctx.state === 'suspended') _ctx.resume();
    this._stopBgm();
    if (!_howlAvailable) {
      this._playBgmSynth();
      return;
    }
    _bgm = new Howl({
      src: [src], loop: true, volume: 0.25,
      onloaderror: () => { this._playBgmSynth(); }
    });
    _bgm.play();
    _bgmSrc = src;
  }

  _playBgmSynth() {
    if (!_ctx) return;
    const loop = () => {
      if (!_bgmSrc) return;
      const notes = [65, 73, 82, 87, 82, 73];
      notes.forEach((freq, i) => {
        setTimeout(() => {
          if (!_bgmSrc) return;
          _synth('triangle', freq, 0.8, { volume: 0.08 });
          _synth('sine', freq * 2, 0.6, { volume: 0.04 });
        }, i * 900);
      });
      setTimeout(loop, notes.length * 900);
    };
    _bgmSrc = 'synth';
    loop();
  }

  _stopBgm() {
    if (_bgm) { _bgm.stop(); _bgm = null; }
    _bgmSrc = null;
  }

  setListenerPosition(pos) {
    if (_howlAvailable && typeof Howler !== 'undefined') Howler.pos(pos.x, pos.y || 0, pos.z);
  }
}
