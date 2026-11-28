import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '../src/api/odoo';
import { detailFrom, overviewFrom, type Detail, type Overview } from '../src/features/users/door';

require('../src/i18n');

const mockOverview = jest.fn<Promise<Overview>, [unknown, string, string, number]>();
const mockDetail = jest.fn<Promise<Detail>, []>();
const mockSetRole = jest.fn<Promise<Detail>, []>();
const mockNotify = jest.fn();
const mockConfirm = jest.fn<Promise<boolean>, []>();
let mockAccount = { id: 'u2_a', origin: 'https://lab0.test', db: 'lab0', userId: 2, partnerId: 3, deviceId: 5, name: 'Admin', login: 'admin@example.com', signedInAt: 0, access: { role: 'admin', capabilities: ['mom.admin', 'team', 'users.manage'] } };

jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined } }));
jest.mock('expo-network', () => ({ useNetworkState: () => ({ isConnected: true, isInternetReachable: true }) }));
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return { useRouter: () => ({ push: jest.fn(), back: jest.fn() }), useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) };
});
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return { __esModule: true, default: { View }, Easing: chain(), useReducedMotion: () => true, useSharedValue: (value: unknown) => ({ get: () => value, set: () => undefined }), useAnimatedStyle: (style: () => object) => style(), withTiming: (value: unknown) => value };
});
jest.mock('react-native/Libraries/Components/RefreshControl/RefreshControl', () => {
  const { View } = jest.requireActual('react-native');
  const Control = (props: object) => <View {...props} />;
  return { __esModule: true, default: Control };
});
jest.mock('../src/auth/session', () => ({ useSession: () => ({ active: mockAccount }), onAccountForgotten: () => undefined, accountKnown: () => true }));
jest.mock('../src/ui/dialog', () => ({ notify: (text: string) => mockNotify(text), confirm: () => mockConfirm(), choose: jest.fn() }));
jest.mock('../src/ui/Sheet', () => {
  const { View, Pressable, Text } = jest.requireActual('react-native');
  return {
    Sheet: ({ children, testID }: { children: unknown; testID?: string }) => <View testID={testID}>{children as never}</View>,
    SheetItem: ({ label, detail, disabled, onPress, testID }: { label: string; detail?: string; disabled?: boolean; onPress?: () => void; testID?: string }) => (
      <Pressable testID={testID} disabled={disabled} accessibilityState={{ disabled: !!disabled }} onPress={onPress}>
        <Text>{label}</Text>
        {detail ? <Text>{detail}</Text> : null}
      </Pressable>
    ),
  };
});
jest.mock('../src/features/users/api', () => ({
  pageSize: 50,
  overview: (account: unknown, search: string, filter: string, limit: number) => mockOverview(account, search, filter, limit),
  detail: () => mockDetail(),
  setRole: () => mockSetRole(),
  setCapability: jest.fn(),
  invite: jest.fn(),
  findByEmail: jest.fn(),
  deactivate: jest.fn(),
  reactivate: jest.fn(),
}));

const rina = { id: 9, name: 'Rina', login: 'rina@kaitech.io', email: 'rina@kaitech.io', role: 'internal', capabilities: [], active: true, last_login: null, programmes: 2 };

function detailOf(patch: Record<string, unknown> = {}) {
  return detailFrom({ ...rina, history: [], may: { set_role: ['external'], capabilities: true, deactivate: true, reactivate: false }, ...patch });
}

let run = 0;
beforeEach(() => {
  run += 1;
  mockAccount = { ...mockAccount, id: `u2_run${run}` };
  [mockOverview, mockDetail, mockSetRole, mockNotify, mockConfirm].forEach((mock) => mock.mockReset());
});

describe('door answers', () => {
  it('reads people and drops rows outside the four roles', () => {
    expect(overviewFrom({ total: 2, people: [rina, { ...rina, id: 10, role: false }], actor_role: 'admin' }).people.map((person) => person.id)).toEqual([9]);
  });

  it('reads what the actor may do and the history', () => {
    const detail = detailOf({ history: [{ at: '2026-11-26 07:02:00', actor: 'Zhafron', change: 'role', from_role: 'internal', to_role: 'admin', capability: null, via: 'app' }] });
    expect(detail.may).toEqual({ setRole: ['external'], capabilities: true, deactivate: true, reactivate: false });
    expect(detail.history[0]).toMatchObject({ actor: 'Zhafron', change: 'role', fromRole: 'internal', toRole: 'admin' });
  });
});

describe('UsersScreen', () => {
  const { UsersScreen } = require('../src/features/users/UsersScreen') as typeof import('../src/features/users/UsersScreen');

  it('names the empty filter and asks the server for that role only', async () => {
    mockOverview.mockResolvedValue({ total: 0, people: [], actorRole: 'admin' });
    await render(<UsersScreen />);
    await fireEvent.press(screen.getByTestId('users-filter-external'));
    await waitFor(() => expect(screen.getByText('No external users yet.')).toBeTruthy());
    expect(mockOverview).toHaveBeenLastCalledWith(expect.anything(), '', 'external', 50);
  });

  it('shows a failed load with a retry', async () => {
    mockOverview.mockRejectedValueOnce(new ApiError('server', 500));
    await render(<UsersScreen />);
    await waitFor(() => expect(screen.getByTestId('users-error')).toBeTruthy());
    mockOverview.mockResolvedValue({ total: 1, people: overviewFrom({ people: [rina] }).people, actorRole: 'admin' });
    await fireEvent.press(screen.getByText('Try again'));
    await waitFor(() => expect(screen.getByTestId('user-9')).toBeTruthy());
  });
});

describe('UserScreen', () => {
  const { UserScreen } = require('../src/features/users/UserScreen') as typeof import('../src/features/users/UserScreen');

  it('keeps the roles an admin may not give visible but disabled, with the reason', async () => {
    mockDetail.mockResolvedValue(detailOf());
    await render(<UserScreen userId={9} />);
    await waitFor(() => expect(screen.getByTestId('user-role')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('user-role'));
    expect(screen.getByTestId('user-role-admin')).toBeDisabled();
    expect(screen.getByText('Only a superadmin can make someone Admin')).toBeTruthy();
    expect(screen.getByTestId('user-role-external')).not.toBeDisabled();
  });

  it('names the Programmes the person is in and counts the ones past the list', async () => {
    mockDetail.mockResolvedValue(detailOf({ programmes: 3, programme_list: [{ id: 51, name: 'Duta Cemerlang' }, { id: 52, name: 'HKR' }, { id: 'x', name: 3 }] }));
    await render(<UserScreen userId={9} />);
    await waitFor(() => expect(screen.getByTestId('user-programme-51')).toHaveTextContent('Duta Cemerlang'));
    expect(screen.getByTestId('user-programme-52')).toHaveTextContent('HKR');
    expect(screen.getByTestId('user-programmes')).toHaveTextContent('Member of 3 Programmes');
    expect(screen.getByTestId('user-programmes-more')).toHaveTextContent('And 1 more Programme');
  });

  it('shows only the count when the server sends no Programme names', async () => {
    mockDetail.mockResolvedValue(detailOf());
    await render(<UserScreen userId={9} />);
    await waitFor(() => expect(screen.getByTestId('user-programmes')).toHaveTextContent('Member of 2 Programmes'));
    expect(screen.queryByTestId('user-programmes-more')).toBeNull();
  });

  it('shows a superadmin read-only to an admin', async () => {
    mockDetail.mockResolvedValue(detailOf({ role: 'superadmin', may: { set_role: [], capabilities: false, deactivate: false, reactivate: false } }));
    await render(<UserScreen userId={9} />);
    await waitFor(() => expect(screen.getByText('Superadmin. Only a superadmin changes an admin or a superadmin.')).toBeTruthy());
    expect(screen.queryByTestId('user-deactivate')).toBeNull();
  });

  it('stops and names who changed the role when someone else changed it first', async () => {
    mockDetail.mockResolvedValueOnce(detailOf());
    mockDetail.mockResolvedValue(detailOf({ role: 'external', history: [{ at: '2026-11-28 07:00:00', actor: 'Khusnul', change: 'role', from_role: 'internal', to_role: 'external', via: 'app' }] }));
    mockConfirm.mockResolvedValue(true);
    await render(<UserScreen userId={9} />);
    await waitFor(() => expect(screen.getByTestId('user-role')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('user-role'));
    await act(async () => fireEvent.press(screen.getByTestId('user-role-external')));
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('The role was already changed by Khusnul.'));
    expect(mockSetRole).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('user-role')).toHaveTextContent(/External/));
  });

  it('shows the reason the server gives for a refused change, not a generic one', async () => {
    mockDetail.mockResolvedValue(detailOf());
    mockSetRole.mockRejectedValue(new ApiError('role_required', 200, 'Only a superadmin changes an admin or a superadmin. Who can: Zhafron.', 'superadmin'));
    mockConfirm.mockResolvedValue(true);
    await render(<UserScreen userId={9} />);
    await waitFor(() => expect(screen.getByTestId('user-role')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('user-role'));
    await act(async () => fireEvent.press(screen.getByTestId('user-role-external')));
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('Only a superadmin changes an admin or a superadmin. Who can: Zhafron.'));
  });
});
