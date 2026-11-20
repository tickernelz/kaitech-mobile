import { effectiveLanguage, parsePreference, resolveLanguage } from '../src/i18n/language';

describe('resolveLanguage', () => {
  it.each(['id', 'id-ID', 'id_ID', 'ID-id', 'in-ID', 'in'])('picks Indonesian for %p', (tag) => {
    expect(resolveLanguage(tag)).toBe('id');
  });

  it.each(['en-US', 'en', 'ms-MY', 'jv-ID', 'ind', '', undefined])('falls back to English for %p', (tag) => {
    expect(resolveLanguage(tag)).toBe('en');
  });
});

describe('effectiveLanguage', () => {
  it('follows the device while the preference is system', () => {
    expect(effectiveLanguage('system', 'id-ID')).toBe('id');
    expect(effectiveLanguage('system', 'fr-FR')).toBe('en');
  });

  it('lets the chosen language override the device', () => {
    expect(effectiveLanguage('en', 'id-ID')).toBe('en');
    expect(effectiveLanguage('id', 'en-US')).toBe('id');
  });

  it.each([null, undefined, '', 'fr', 'ID'])('treats stored value %p as the device language', (stored) => {
    expect(parsePreference(stored)).toBe('system');
  });
});
