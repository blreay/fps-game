function calculateDamage(weapon, distance) {
  if (!weapon || distance < 0) return 0;
  if (weapon.slot === 'melee') return weapon.damage;
  const falloff = Math.max(0, 1 - distance / weapon.range);
  return Math.round(weapon.damage * (0.5 + 0.5 * falloff));
}

function getShotgunDamage(weapon, distance) {
  const pelletDamage = calculateDamage(weapon, distance);
  const pellets = weapon.pellets || 1;
  return pelletDamage * pellets;
}

function getFireIntervalMs(weapon) {
  if (!weapon.fireRate || weapon.fireRate === 0) return Infinity;
  return 60000 / weapon.fireRate;
}

function applyRecoil(pitch, recoil) {
  const newPitch = pitch - recoil * 0.02;
  return Math.max(-Math.PI / 2, Math.min(Math.PI / 2, newPitch));
}

function canFire(weapon, ammoState, lastFiredMs, nowMs) {
  if (ammoState.current <= 0) return false;
  if (weapon.slot === 'melee') return (nowMs - lastFiredMs) >= (1000 / weapon.attackRate);
  return (nowMs - lastFiredMs) >= getFireIntervalMs(weapon);
}

module.exports = { calculateDamage, getShotgunDamage, getFireIntervalMs, applyRecoil, canFire };
