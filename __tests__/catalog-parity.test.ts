import { catalogParity } from '../src/i18n/catalog-parity';

describe('catalogParity', () => {
  it('accepts catalogs with the same nested keys and placeholders', () => {
    expect(
      catalogParity({
        en: { auth: { hello: 'Hi {{name}}', retry: 'Retry' } },
        id: { auth: { hello: 'Halo {{ name }}', retry: 'Coba lagi' } },
      }),
    ).toEqual([]);
  });

  it('reports a key missing from one language and an extra key in the other', () => {
    expect(
      catalogParity({
        en: { a: 'A', b: 'B' },
        id: { a: 'A', c: 'C' },
      }),
    ).toEqual([
      { kind: 'missing', key: 'b', language: 'id' },
      { kind: 'missing', key: 'c', language: 'en' },
    ]);
  });

  it('reports a leaf in one language that is an object in the other', () => {
    expect(
      catalogParity({
        en: { error: 'Failed' },
        id: { error: { title: 'Gagal' } },
      }),
    ).toEqual([
      { kind: 'missing', key: 'error', language: 'id' },
      { kind: 'missing', key: 'error.title', language: 'en' },
    ]);
  });

  it('reports empty and non-string values', () => {
    expect(
      catalogParity({
        en: { a: 'A', b: 'B' },
        id: { a: '  ', b: 3 },
      }),
    ).toEqual([
      { kind: 'empty', key: 'a', language: 'id' },
      { kind: 'not-string', key: 'b', language: 'id' },
    ]);
  });

  it('reports mismatched interpolation placeholders', () => {
    expect(
      catalogParity({
        en: { greet: 'Hi {{name}}, {{count}} new' },
        id: { greet: 'Halo {{nama}}, {{count}} baru' },
      }),
    ).toEqual([
      {
        kind: 'placeholders',
        key: 'greet',
        language: 'id',
        expected: ['count', 'name'],
        actual: ['count', 'nama'],
      },
    ]);
  });
});
