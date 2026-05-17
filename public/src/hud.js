export class HUD {
  constructor() {
    this.healthFill = document.getElementById('health-fill');
    this.healthNum = document.getElementById('health-num');
    this.staminaFill = document.getElementById('stamina-fill');
    this.weaponName = document.getElementById('weapon-name');
    this.ammoCur = document.getElementById('ammo-cur');
    this.ammoRes = document.getElementById('ammo-res');
    this.killProgress = document.getElementById('kill-progress');
    this.killFeed = document.getElementById('kill-feed');
    this.hitMarker = document.getElementById('hit-marker');
    this.damageOverlay = document.getElementById('damage-overlay');
    this.minimap = document.getElementById('minimap');
    this.minimapCtx = this.minimap.getContext('2d');
    this.crosshair = document.getElementById('crosshair');
    this._hitTimeout = null;
    this._damageTimeout = null;
  }

  update(player, weaponSystem, killCount, totalEnemies) {
    const hpPct = player.hp / 100;
    this.healthFill.style.width = `${hpPct * 100}%`;
    this.healthFill.style.background = hpPct > 0.5 ? '#00cc44' : hpPct > 0.25 ? '#ffcc00' : '#ff3333';
    this.healthNum.textContent = Math.ceil(player.hp);
    this.staminaFill.style.width = `${player.stamina}%`;

    const w = weaponSystem.currentWeapon;
    if (w) {
      this.weaponName.textContent = w.name;
      const ammo = weaponSystem.currentAmmo;
      if (w.slot === 'melee') {
        this.ammoCur.textContent = '—';
        this.ammoRes.textContent = '—';
      } else {
        this.ammoCur.textContent = ammo.current;
        this.ammoRes.textContent = ammo.reserve;
        this.ammoCur.style.color = ammo.current <= 5 ? '#ff4444' : '#ffffff';
      }
    }

    if (player.input?.ads) this.crosshair.classList.add('ads');
    else this.crosshair.classList.remove('ads');

    this.killProgress.textContent = `${killCount} / ${totalEnemies}`;
    this._drawMinimap(player);
  }

  _drawMinimap(player) {
    const ctx = this.minimapCtx;
    const W = 150, H = 150;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#00ff78';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    const yaw = player._yaw || 0;
    ctx.strokeStyle = '#00ff78';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2, H / 2);
    ctx.lineTo(W / 2 + Math.sin(-yaw) * 10, H / 2 - Math.cos(-yaw) * 10);
    ctx.stroke();
  }

  showHitMarker() {
    this.hitMarker.classList.add('active');
    clearTimeout(this._hitTimeout);
    this._hitTimeout = setTimeout(() => this.hitMarker.classList.remove('active'), 150);
  }

  flashDamage() {
    this.damageOverlay.classList.add('active');
    clearTimeout(this._damageTimeout);
    this._damageTimeout = setTimeout(() => this.damageOverlay.classList.remove('active'), 300);
  }

  showKillFeed(enemyType) {
    const labels = { infantry: '步兵', heavy: '重甲兵', sniper: '狙击手' };
    const el = document.createElement('div');
    el.className = 'kill-entry';
    el.textContent = `KILLED ${labels[enemyType] || enemyType}`;
    this.killFeed.appendChild(el);
    setTimeout(() => el.remove(), 3100);
  }
}
