const { canSeePlayer, getNextState, distanceTo, STATES } = require('../public/src/utils/ai-logic');

describe('canSeePlayer', () => {
  const enemyPos = { x: 0, z: 0 };
  const forward = { x: 0, z: 1 };

  test('detects player directly in front within range', () => {
    expect(canSeePlayer(enemyPos, forward, { x: 0, z: 10 }, 60, 20)).toBe(true);
  });
  test('does not detect player beyond range', () => {
    expect(canSeePlayer(enemyPos, forward, { x: 0, z: 25 }, 60, 20)).toBe(false);
  });
  test('does not detect player outside FOV', () => {
    expect(canSeePlayer(enemyPos, forward, { x: 15, z: 0 }, 60, 20)).toBe(false);
  });
});

describe('getNextState', () => {
  const base = { hp: 80, seePlayer: false, distToPlayer: 50, attackRange: 8, alertTimer: 0, lostPlayerTimer: 0 };

  test('PATROL stays PATROL when player not seen', () => {
    expect(getNextState(STATES.PATROL, base)).toBe(STATES.PATROL);
  });
  test('PATROL transitions to ALERT when player seen', () => {
    expect(getNextState(STATES.PATROL, { ...base, seePlayer: true })).toBe(STATES.ALERT);
  });
  test('ALERT transitions to CHASE after 0.8s', () => {
    expect(getNextState(STATES.ALERT, { ...base, alertTimer: 0.8 })).toBe(STATES.CHASE);
  });
  test('CHASE transitions to ATTACK when in range', () => {
    expect(getNextState(STATES.CHASE, { ...base, distToPlayer: 5, attackRange: 8 })).toBe(STATES.ATTACK);
  });
  test('any state transitions to DEAD when hp 0', () => {
    expect(getNextState(STATES.CHASE, { ...base, hp: 0 })).toBe(STATES.DEAD);
  });
});
