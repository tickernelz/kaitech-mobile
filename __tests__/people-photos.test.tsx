import { render, screen } from '@testing-library/react-native';
import { createElement } from 'react';

const mockStore = new Map<string, string>();

jest.mock('expo-sqlite/kv-store', () => ({
  getItemSync: (key: string) => mockStore.get(key) ?? null,
  setItemSync: (key: string, value: string) => mockStore.set(key, value),
  removeItemSync: (key: string) => mockStore.delete(key),
}));
jest.mock('../src/auth/session', () => ({ onAccountForgotten: () => () => undefined }));
jest.mock('../src/features/chat/chat', () => ({ useChat: (select: (state: unknown) => unknown) => select({ origin: 'https://odoo.test', accountId: 'A' }) }));
jest.mock('../src/features/chat/ui/useCookie', () => ({ useCookie: () => ({ Cookie: 'session_id=s' }) }));

const { conversationPhotos } = require('../src/features/chat/odoo') as typeof import('../src/features/chat/odoo');
const pure = require('../src/features/people/photo') as typeof import('../src/features/people/photo');
const photos = require('../src/features/people/photos') as typeof import('../src/features/people/photos');
const { Avatar } = require('../src/features/chat/ui/Avatar') as typeof import('../src/features/chat/ui/Avatar');

const hidden = { includeHiddenElements: true };

const photo = (version: string, token = 't1') => ({
  version,
  small: `/web/image/res.partner/7/avatar_128?unique=${version}&access_token=${token}`,
  medium: `/web/image/res.partner/7/avatar_512?unique=${version}`,
});

describe('photoFrom', () => {
  it('reads the server shape, keeps null as no photo and refuses addresses outside the server', () => {
    expect(pure.photoFrom(photo('v1'))).toEqual(photo('v1'));
    expect(pure.photoFrom(null)).toBeNull();
    expect(pure.photoFrom({ version: 'v1', small: '//evil.test/a.png', medium: '/x' })).toBeUndefined();
    expect(pure.photoFrom({ version: 'v1', small: 'https://evil.test/a.png' })).toBeUndefined();
    expect(pure.photoFrom({ version: '', small: '/x' })).toBeUndefined();
    expect(pure.photoFrom({ version: 'v1', small: '/s', medium: 'https://evil.test/m' })).toEqual({ version: 'v1', small: '/s', medium: '/s' });
  });
});

describe('settle', () => {
  const now = 1_000_000_000;
  it('keeps the entry while the version stays and replaces it when the photo changes or ages out', () => {
    const entry = { photo: photo('v1'), at: now };
    expect(pure.settle(entry, photo('v1', 't2'), now + 1000)).toBeNull();
    expect(pure.settle(entry, photo('v2'), now + 1000)).toEqual({ photo: photo('v2'), at: now + 1000 });
    expect(pure.settle(entry, null, now + 1000)).toEqual({ photo: null, at: now + 1000 });
    expect(pure.settle({ photo: null, at: now }, null, now + 1000)).toBeNull();
    expect(pure.settle(entry, photo('v1', 't2'), now + 8 * 24 * 3600 * 1000)?.photo?.small).toContain('t2');
  });
});

describe('photosInStore', () => {
  it('takes every partner carrying the app photo, single or listed', () => {
    expect(pure.photosInStore({ 'res.partner': [{ id: 3, kaitech_mobile_photo: photo('a') }, { id: 4, name: 'No field' }, { id: 5, kaitech_mobile_photo: null }] })).toEqual([
      [3, photo('a')],
      [5, null],
    ]);
    expect(pure.photosInStore({ 'res.partner': { id: 6, kaitech_mobile_photo: photo('b') } })).toEqual([[6, photo('b')]]);
    expect(pure.photosInStore(null)).toEqual([]);
  });
});

describe('conversationPhotos', () => {
  it('credits a chat photo to the other person and the last author photo to its author, never a group image', () => {
    const body = {
      conversations: [
        { id: 1, type: 'chat', partner_id: 7, photo: photo('p7'), last_message: { id: 9, author_id: 8, author_photo: null } },
        { id: 2, type: 'group', partner_id: null, photo: photo('g2'), last_message: { id: 10, author_id: 7 } },
      ],
    };
    expect(conversationPhotos(body)).toEqual([
      [7, photo('p7')],
      [8, null],
    ]);
  });
});

describe('photo registry', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('keeps the same photo object across a token rotation so the image does not reload, and follows a new version', () => {
    photos.notePhotos('A', { 'res.partner': [{ id: 7, kaitech_mobile_photo: photo('v1', 't1') }] });
    const first = photos.partnerPhoto('A', 7);
    photos.notePhotos('A', { 'res.partner': [{ id: 7, kaitech_mobile_photo: photo('v1', 't2') }] });
    expect(photos.partnerPhoto('A', 7)).toBe(first);
    photos.notePhotos('A', { 'res.partner': [{ id: 7, kaitech_mobile_photo: photo('v2') }] });
    expect(photos.partnerPhoto('A', 7)?.version).toBe('v2');
    expect(photos.partnerPhoto('B', 7)).toBeUndefined();
    jest.runAllTimers();
    expect(mockStore.get('people.photos.A')).toContain('v2');
  });

  it('draws the photo of a known person in a list and the larger one on a call screen', async () => {
    photos.notePhoto('A', 11, { version: 'v9', small: '/web/image/res.partner/11/avatar_128?unique=v9', medium: '/web/image/res.partner/11/avatar_512?unique=v9' });
    const list = await render(createElement(Avatar, { name: 'Budi Santoso', seed: 11, partnerId: 11 }));
    expect(screen.getByTestId('avatar-small', hidden).props.source).toEqual({ uri: 'https://odoo.test/web/image/res.partner/11/avatar_128?unique=v9' });
    expect(screen.queryByTestId('avatar-medium', hidden)).toBeNull();
    await list.unmount();
    const call = await render(createElement(Avatar, { name: 'Budi Santoso', seed: 11, partnerId: 11, size: 112 }));
    expect(screen.getByTestId('avatar-medium', hidden).props.source).toEqual({ uri: 'https://odoo.test/web/image/res.partner/11/avatar_512?unique=v9', headers: { Cookie: 'session_id=s' } });
    await call.unmount();
    photos.notePhoto('A', 11, null);
    await render(createElement(Avatar, { name: 'Budi Santoso', seed: 11, partnerId: 11 }));
    expect(screen.getByTestId('avatar-initials', hidden)).toBeTruthy();
    expect(screen.getByText('BS', hidden)).toBeTruthy();
  });
});
