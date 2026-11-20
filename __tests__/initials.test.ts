import { initials } from '../src/screens/HeaderActions';

describe('initials', () => {
  it('takes the first and last words that carry letters', () => {
    expect(initials('Budi Santoso')).toBe('BS');
    expect(initials('Uji Aplikasi HP (ZHA-7242)')).toBe('UZ');
    expect(initials('  ')).toBe('K');
  });
});
