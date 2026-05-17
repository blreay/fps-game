const { parseWeaponsConfig, parseLevelConfig, getPickupsNearPosition } = require('../public/src/utils/level-parser');

describe('parseWeaponsConfig', () => {
  test('parses valid config', () => {
    const result = parseWeaponsConfig([{ id: 'ak47', slot: 'primary', damage: 35 }]);
    expect(result).toHaveLength(1);
  });
  test('throws on non-array', () => {
    expect(() => parseWeaponsConfig({})).toThrow();
  });
  test('throws on missing id', () => {
    expect(() => parseWeaponsConfig([{ slot: 'primary' }])).toThrow();
  });
  test('throws on invalid slot', () => {
    expect(() => parseWeaponsConfig([{ id: 'x', slot: 'rocket' }])).toThrow();
  });
});

describe('getPickupsNearPosition', () => {
  const pickups = [
    { id: 1, type: 'medkit', x: 1, z: 0 },
    { id: 2, type: 'ammo', x: 100, z: 0 }
  ];
  test('returns nearby pickups', () => {
    expect(getPickupsNearPosition(pickups, { x: 0, z: 0 }, 5)).toHaveLength(1);
  });
  test('returns empty when none in range', () => {
    expect(getPickupsNearPosition(pickups, { x: 0, z: 0 }, 0.5)).toHaveLength(0);
  });
});
