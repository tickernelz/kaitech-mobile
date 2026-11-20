import { initials } from '../src/ui/initials';

describe('initials', () => {
  it.each([
    ['Budi Santoso', 'BS'],
    ['Uji Chat Web (ZHA-7238)', 'UW'],
    ['Uji Aplikasi HP (ZHA-7242)', 'UH'],
    ['rina', 'R'],
    ['PT 123 Maju', 'PM'],
    ['  ', 'K'],
    ['', 'K'],
  ])('turns %p into %p', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
