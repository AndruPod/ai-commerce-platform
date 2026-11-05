import { toLookupKey } from './lookup-key';

describe('toLookupKey', () => {
  it.each([
    ['VSA', 'vsa'],
    ['vsa', 'vsa'],
    ['Victory Skating', 'victory skating'],
    ['  VICTORY   skating ', 'victory skating'],
    ['victory-skating', 'victory skating'],
    ['Victory Skating Academy', 'victory skating academy'],
    ['victory-skating-academy', 'victory skating academy'],
  ])('%p -> %p', (input, key) => expect(toLookupKey(input)).toBe(key));
});
