import { act, render, screen } from '@testing-library/react-native';
import { createElement } from 'react';
import { Text } from 'react-native';

const mockForget: ((id: string) => void)[] = [];
const mockGone = new Set<string>();

jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: jest.fn(), removeItemSync: jest.fn() }));
jest.mock('expo-router', () => ({ useFocusEffect: () => undefined }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('../src/features/media/shrink', () => ({ shrinkToJpeg: jest.fn() }));
jest.mock('../src/auth/session', () => ({
  onAccountForgotten: (listener: (id: string) => void) => mockForget.push(listener),
  accountKnown: (id: string) => !mockGone.has(id),
  renameAccount: jest.fn(),
}));
jest.mock('../src/api/odoo', () => ({ bearer: jest.fn(), bearerFile: jest.fn() }));
jest.mock('../src/features/chat/api', () => ({ errorCode: () => 'unknown' }));
jest.mock('../src/features/chat/chat', () => ({ chatClient: () => null, onRealtimeNotifications: () => () => undefined }));

const pure = require('../src/features/people/status') as typeof import('../src/features/people/status');
const statuses = require('../src/features/people/statuses') as typeof import('../src/features/people/statuses');
const profile = require('../src/features/profile/profile') as typeof import('../src/features/profile/profile');

describe('status length', () => {
  it('counts code points like the server, so a joined emoji takes three of the 80', () => {
    expect(pure.statusLength('👩‍💻 WFH')).toBe(7);
    expect('👩‍💻 WFH'.length).toBe(9);
    const long = '😀'.repeat(81);
    expect(pure.statusLength(pure.fitStatus(long))).toBe(80);
    expect(pure.fitStatus('a'.repeat(80))).toBe('a'.repeat(80));
  });
});

describe('statusesInStore', () => {
  it('reads the status of partners that carry it and treats blank as no status', () => {
    const store = {
      'res.partner': [
        { id: 3, kaitech_status_text: 'Rapat sampai 15.00' },
        { id: 4, name: 'No field' },
        { id: 5, kaitech_status_text: null },
        { id: 6, kaitech_status_text: '   ' },
        { id: 7, kaitech_status_text: 12 },
      ],
    };
    expect(pure.statusesInStore(store)).toEqual([
      [3, 'Rapat sampai 15.00'],
      [5, null],
      [6, null],
    ]);
    expect(pure.statusesInStore({ 'res.partner': { id: 8, kaitech_status_text: 'WFH' } })).toEqual([[8, 'WFH']]);
    expect(pure.statusesInStore(null)).toEqual([]);
  });
});

describe('profile save body', () => {
  it('sends only what changed, joins status to one line and clears it with null', () => {
    expect(profile.profileBody({ name: '  Budi   Santoso ' })).toEqual({ name: 'Budi Santoso' });
    expect(profile.profileBody({ status: ' Rapat\nsampai  15.00 ' })).toEqual({ status: 'Rapat sampai 15.00' });
    expect(profile.profileBody({ status: '   ' })).toEqual({ status: null });
    expect(profile.profileBody({ name: 'Budi', status: '' })).toEqual({ name: 'Budi', status: null });
  });

  it('reads the own status from the profile answer', () => {
    const base = { user_id: 9, partner_id: 7, name: 'Budi' };
    expect(profile.profileFrom({ ...base, status: 'WFH' })?.status).toBe('WFH');
    expect(profile.profileFrom({ ...base, status: null })?.status).toBeNull();
    expect(profile.profileFrom(base)?.status).toBeNull();
  });
});

describe('statuses of other people', () => {
  function Line({ accountId, partnerId }: { accountId: string; partnerId: number }) {
    return createElement(Text, { testID: 'line' }, statuses.usePartnerStatus(accountId, partnerId) ?? 'none');
  }

  it('updates a shown line when a later payload changes the status, per account', async () => {
    await render(createElement(Line, { accountId: 'A', partnerId: 3 }));
    expect(screen.getByTestId('line')).toHaveTextContent('none');
    await act(() => statuses.noteStatuses('A', { 'res.partner': [{ id: 3, kaitech_status_text: 'WFH' }] }));
    expect(screen.getByTestId('line')).toHaveTextContent('WFH');
    await act(() => statuses.noteStatuses('B', { 'res.partner': [{ id: 3, kaitech_status_text: 'Cuti' }] }));
    expect(screen.getByTestId('line')).toHaveTextContent('WFH');
    await act(() => statuses.noteStatuses('A', { 'res.partner': [{ id: 3, kaitech_status_text: null }] }));
    expect(screen.getByTestId('line')).toHaveTextContent('none');
  });

  it('forgets an account on sign-out and ignores answers that land after it', () => {
    statuses.noteStatuses('C', { 'res.partner': [{ id: 4, kaitech_status_text: 'Di lapangan' }] });
    expect(statuses.partnerStatus('C', 4)).toBe('Di lapangan');
    mockForget.forEach((listener) => listener('C'));
    mockGone.add('C');
    expect(statuses.partnerStatus('C', 4)).toBeNull();
    statuses.noteStatuses('C', { 'res.partner': [{ id: 4, kaitech_status_text: 'Lagi' }] });
    expect(statuses.partnerStatus('C', 4)).toBeNull();
  });
});
