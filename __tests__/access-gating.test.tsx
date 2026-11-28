import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { accessFrom, legacyAccess, type Access } from '../src/auth/access';
import { messageOptions } from '../src/features/chat/messageOptions';
import { noFeatures } from '../src/features/chat/features';
import type { Message } from '../src/features/chat/types';
import { tabsFor } from '../src/layout/tabs';

require('../src/i18n');

const mockReplace = jest.fn();
const mockSession: { active: { id: string; userId: number; access?: Access } | null } = { active: null };

jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined } }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => false }) }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return { __esModule: true, default: { View }, Easing: chain(), useReducedMotion: () => true, useSharedValue: (value: unknown) => ({ get: () => value, set: () => undefined }), useAnimatedStyle: (style: () => object) => style(), withTiming: (value: unknown) => value };
});
jest.mock('../src/auth/session', () => ({ useSession: () => mockSession, onAccountForgotten: () => undefined, accountKnown: () => true }));
jest.mock('../src/features/users/UsersScreen', () => ({ UsersScreen: () => null }));

const external: Access = { role: 'external', capabilities: ['client.home'] };
const internal: Access = { role: 'internal', capabilities: ['team'] };
const admin: Access = { role: 'admin', capabilities: ['mom.admin', 'team', 'users.manage'] };

function signedIn(access?: Access) {
  mockSession.active = { id: 'u7_x', userId: 7, ...(access ? { access } : {}) };
}

beforeEach(() => mockReplace.mockClear());

describe('profile capabilities', () => {
  it('reads the role and the capability keys the server sends', () => {
    expect(accessFrom({ user_id: 7, role: 'external', capabilities: ['client.home'] })).toEqual(external);
    expect(accessFrom({ role: 'admin', capabilities: ['users.manage', 'team', 'mom.admin', 3] })).toEqual(admin);
  });

  it('treats a server that sends no capabilities as unknown, and an unknown role as none', () => {
    expect(accessFrom({ user_id: 7, name: 'Old server' })).toBeNull();
    expect(accessFrom({ role: 'owner', capabilities: [] })).toEqual({ role: null, capabilities: [] });
  });
});

describe('tabs per capability', () => {
  it('gives a client Home before Chat and no team tab', () => {
    expect(tabsFor(external)).toEqual(['home', 'chat']);
  });

  it('gives a client without an open Programme Chat only', () => {
    expect(tabsFor({ role: 'external', capabilities: [] })).toEqual(['chat']);
  });

  it('gives the team the four team tabs and no Home', () => {
    expect(tabsFor(internal)).toEqual(['chat', 'discovery', 'mom', 'activity']);
    expect(tabsFor(admin)).toEqual(['chat', 'discovery', 'mom', 'activity']);
  });

  it('keeps the team tabs for an account signed in before the server sent capabilities', () => {
    expect(tabsFor(legacyAccess)).toEqual(['chat', 'discovery', 'mom', 'activity']);
  });
});

describe('message actions for a client', () => {
  const features = { ...noFeatures, on: ['forward', 'task_from_message', 'meeting', 'read_by'], canMakeTask: true, isAdmin: true, translateLanguage: 'en' };
  const message = (authorId: number): Message => ({ id: 1, channelId: 2, authorId, author: 'A', body: '<p>Halo</p>', date: 0, type: 'comment', attachments: [], reactions: [] }) as unknown as Message;

  it('offers reply, reaction, copy and deleting their own message, nothing of the team', () => {
    expect(messageOptions(message(5), { partnerId: 5, features, channelType: 'chat', inSubThread: false, now: 0, client: true })).toEqual({ emoji: true, reply: true, copy: true, delete: true, reactions: false });
    expect(messageOptions(message(9), { partnerId: 5, features, channelType: 'chat', inSubThread: false, now: 0, client: true })).toEqual({ emoji: true, reply: true, copy: true, delete: false, reactions: false });
  });

  it('keeps the team actions for the team', () => {
    const options = messageOptions(message(5), { partnerId: 5, features, channelType: 'chat', inSubThread: false, now: 0 });
    expect([options.pin, options.task, options.activity, options.forward]).toEqual([true, true, true, true]);
  });
});

describe('screens behind a capability', () => {
  const { TeamOnly } = require('../src/screens/Gate') as typeof import('../src/screens/Gate');
  const UsersRoute = (require('../src/app/settings/users/index') as typeof import('../src/app/settings/users/index')).default;

  it('shows a client the team-only page with a way back to Home', async () => {
    signedIn(external);
    await render(
      <TeamOnly>
        <Text>MoM</Text>
      </TeamOnly>,
    );
    expect(screen.queryByText('MoM')).toBeNull();
    expect(screen.getByTestId('gate-team-title')).toHaveTextContent('This page is for the Kaitech team.');
    await fireEvent.press(screen.getByTestId('gate-team-leave'));
    expect(mockReplace).toHaveBeenCalledWith('/home');
  });

  it('shows the team the screen itself', async () => {
    signedIn(internal);
    await render(
      <TeamOnly>
        <Text>MoM</Text>
      </TeamOnly>,
    );
    expect(screen.getByText('MoM')).toBeTruthy();
    expect(screen.queryByTestId('gate-team')).toBeNull();
  });

  it('keeps the Users screen for admins and tells an internal person it is for admins', async () => {
    signedIn(internal);
    await render(<UsersRoute />);
    expect(screen.getByTestId('gate-admin-title')).toHaveTextContent('This page is for admins.');
  });
});
