function parseWeaponsConfig(json) {
  if (!Array.isArray(json)) throw new Error('weapons.json must be an array');
  return json.map((w, i) => {
    if (!w.id) throw new Error(`Weapon at index ${i} missing id`);
    if (!w.slot) throw new Error(`Weapon ${w.id} missing slot`);
    if (!['melee','primary','secondary'].includes(w.slot))
      throw new Error(`Weapon ${w.id} invalid slot: ${w.slot}`);
    return w;
  });
}

function parseLevelConfig(json) {
  if (!json.id) throw new Error('level config missing id');
  if (!Array.isArray(json.enemies)) throw new Error('level config missing enemies array');
  if (json.enemies.length === 0) throw new Error('level has no enemies');
  return json;
}

function getPickupsNearPosition(pickups, pos, radius) {
  return pickups.filter(p => {
    const dx = p.x - pos.x, dz = p.z - pos.z;
    return Math.sqrt(dx * dx + dz * dz) <= radius;
  });
}

module.exports = { parseWeaponsConfig, parseLevelConfig, getPickupsNearPosition };
