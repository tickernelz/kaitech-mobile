import { resolveLanguage, stringsFor } from '../src/i18n/language';

describe('resolveLanguage', () => {
  it.each(['id', 'id-ID', 'id_ID', 'ID-id', 'in-ID', 'in'])('picks Indonesian for %p', (tag) => {
    expect(resolveLanguage(tag)).toBe('id');
  });

  it.each(['en-US', 'en', 'ms-MY', 'jv-ID', 'ind', '', undefined])('falls back to English for %p', (tag) => {
    expect(resolveLanguage(tag)).toBe('en');
  });

  it('returns the catalog for the language', () => {
    expect(stringsFor('id').app.greeting).toBe('Selamat datang');
    expect(stringsFor('en').app.greeting).toBe('Welcome');
  });
});
