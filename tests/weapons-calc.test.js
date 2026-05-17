const { calculateDamage, getFireIntervalMs, applyRecoil, canFire, getShotgunDamage } = require('../public/src/utils/weapons-calc');

const ak47 = { id: 'ak47', slot: 'primary', damage: 35, fireRate: 600, range: 80, recoil: 0.8 };
const dagger = { id: 'dagger', slot: 'melee', damage: 40, attackRate: 3 };
const shotgun = { id: 'shotgun', slot: 'secondary', damage: 15, pellets: 8, fireRate: 60, range: 20 };

describe('calculateDamage', () => {
  test('melee always returns full damage', () => {
    expect(calculateDamage(dagger, 0)).toBe(40);
    expect(calculateDamage(dagger, 100)).toBe(40);
  });
  test('ranged returns full damage at zero distance', () => {
    expect(calculateDamage(ak47, 0)).toBe(35);
  });
  test('ranged returns half damage at max range', () => {
    expect(calculateDamage(ak47, 80)).toBe(18);
  });
  test('ranged returns 0 for negative distance', () => {
    expect(calculateDamage(ak47, -1)).toBe(0);
  });
});

describe('getFireIntervalMs', () => {
  test('600 RPM = 100ms interval', () => {
    expect(getFireIntervalMs(ak47)).toBeCloseTo(100);
  });
});

describe('applyRecoil', () => {
  test('recoil reduces pitch', () => {
    expect(applyRecoil(0, 0.8)).toBeLessThan(0);
  });
  test('pitch clamped at -PI/2', () => {
    expect(applyRecoil(-Math.PI / 2, 10)).toBeCloseTo(-Math.PI / 2);
  });
});

describe('canFire', () => {
  test('cannot fire with empty mag', () => {
    expect(canFire(ak47, { current: 0 }, 0, 1000)).toBe(false);
  });
  test('can fire after interval elapsed', () => {
    expect(canFire(ak47, { current: 30 }, 0, 200)).toBe(true);
  });
  test('cannot fire before interval elapsed', () => {
    expect(canFire(ak47, { current: 30 }, 0, 50)).toBe(false);
  });
});

describe('getShotgunDamage', () => {
  test('shotgun at close range = pellet damage * pellets', () => {
    expect(getShotgunDamage(shotgun, 0)).toBe(15 * 8);
  });
});
