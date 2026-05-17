const STATES = { PATROL: 'PATROL', ALERT: 'ALERT', CHASE: 'CHASE', ATTACK: 'ATTACK', DEAD: 'DEAD' };

const ENEMY_CONFIGS = {
  infantry: { hp: 80, speed: 4, attackDamage: 20, fovDeg: 60, fovRange: 20, attackRange: 8 },
  heavy: { hp: 200, speed: 2.5, attackDamage: 35, fovDeg: 45, fovRange: 15, attackRange: 6 },
  sniper: { hp: 50, speed: 2, attackDamage: 60, fovDeg: 80, fovRange: 40, attackRange: 35 }
};

function canSeePlayer(enemyPos, enemyForward, playerPos, fovDeg, fovRange) {
  const dx = playerPos.x - enemyPos.x;
  const dz = playerPos.z - enemyPos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > fovRange) return false;
  const angleToPlayer = Math.atan2(dx, dz);
  const enemyAngle = Math.atan2(enemyForward.x, enemyForward.z);
  let angleDiff = Math.abs(angleToPlayer - enemyAngle);
  if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
  return angleDiff <= (fovDeg * Math.PI / 180) / 2;
}

function distanceTo(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function getNextState(currentState, { hp, seePlayer, distToPlayer, attackRange, alertTimer, lostPlayerTimer }) {
  if (hp <= 0) return STATES.DEAD;
  switch (currentState) {
    case STATES.PATROL:
      return seePlayer ? STATES.ALERT : STATES.PATROL;
    case STATES.ALERT:
      return alertTimer >= 0.8 ? STATES.CHASE : STATES.ALERT;
    case STATES.CHASE:
      if (distToPlayer <= attackRange) return STATES.ATTACK;
      if (!seePlayer && lostPlayerTimer >= 5) return STATES.PATROL;
      return STATES.CHASE;
    case STATES.ATTACK:
      if (distToPlayer > attackRange * 1.5) return STATES.CHASE;
      return STATES.ATTACK;
    default:
      return currentState;
  }
}

module.exports = { STATES, ENEMY_CONFIGS, canSeePlayer, distanceTo, getNextState };
