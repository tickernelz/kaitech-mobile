jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn(), AndroidImportance: { HIGH: 4 } }));
jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined, getAllKeysSync: () => [] } }));
jest.mock('../src/i18n', () => ({ __esModule: true, default: { language: 'en', t: (key: string) => key } }));
jest.mock('../src/auth/session', () => ({ getSession: () => ({ accounts: [], activeId: null }), onAccountForgotten: () => undefined }));
jest.mock('../src/lock/lock', () => ({ lockEnabled: () => false, onLockChange: () => () => undefined }));
jest.mock('../src/features/chat/chat', () => ({ chatClient: () => null, getChat: () => ({ openChannels: [7] }) }));
jest.mock('../src/features/chat/notify', () => ({ mirrorHidden: jest.fn(), forgetMessages: jest.fn() }));
jest.mock('../src/features/chat/api', () => ({ ChatClient: class {} }));

import * as Notifications from 'expo-notifications';
import { viewConversation } from '../src/features/discovery/viewing';

require('../src/features/chat/push');

type Handler = { handleNotification: (notification: unknown) => Promise<{ shouldShowBanner: boolean }> };
const handler = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0][0] as Handler;
const shown = async (data: Record<string, unknown>) => (await handler.handleNotification({ request: { content: { data } } })).shouldShowBanner;
const answer = (conversation: number) => ({ type: 'discovery_answer', model: 'ck.conversation', res_id: conversation, engagement_id: 40 });

describe('foreground push banners', () => {
  it('stays quiet for the Coworker conversation on screen and shows others', async () => {
    const leave = viewConversation(12);
    expect(await shown(answer(12))).toBe(false);
    expect(await shown(answer(13))).toBe(true);
    leave();
    expect(await shown(answer(12))).toBe(true);
  });

  it('still stays quiet for an open chat thread', async () => {
    expect(await shown({ model: 'discuss.channel', res_id: 7 })).toBe(false);
    expect(await shown({ model: 'discuss.channel', res_id: 8 })).toBe(true);
  });
});
