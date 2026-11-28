import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import type { NetworkState } from 'expo-network';
import { noticeFor, useConnection } from '../src/api/network';
import type { Board } from '../src/features/mom/api';

require('../src/i18n');

let account = { id: 'u2_x', origin: 'https://odoo.test', db: 'lab0', userId: 2, partnerId: 3, deviceId: 4, name: 'T', login: 't', signedInAt: 0 };
const mockNetwork: { state: Partial<NetworkState>; listeners: Set<() => void> } = { state: { isConnected: true, isInternetReachable: true }, listeners: new Set() };
const mockBoard = jest.fn<Promise<Board>, []>();

jest.mock('expo-network', () => {
  const { useSyncExternalStore } = require('react');
  return {
    useNetworkState: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          mockNetwork.listeners.add(listener);
          return () => mockNetwork.listeners.delete(listener);
        },
        () => mockNetwork.state,
      ),
    addNetworkStateListener: () => ({ remove: () => undefined }),
  };
});
jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined } }));
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) };
});
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return {
    __esModule: true,
    default: { View },
    Easing: chain(),
    useReducedMotion: () => true,
    useSharedValue: (value: unknown) => ({ get: () => value, set: () => undefined }),
    useAnimatedStyle: (style: () => object) => style(),
    withTiming: (value: unknown) => value,
  };
});
jest.mock('../src/auth/session', () => ({ useSession: () => ({ active: mockAccount() }), onAccountForgotten: () => () => undefined }));
jest.mock('../src/features/mom/api', () => ({ board: () => mockBoard() }));
jest.mock('../src/features/discovery/Home', () => ({ useCurrentProgramme: () => ({ current: null }) }));
jest.mock('../src/features/mom/recorder', () => ({ useRecording: () => null, clock: () => '', useRecorderClock: () => 0 }));
jest.mock('../src/features/mom/uploads', () => ({ useUploads: () => [], discard: jest.fn(), dismiss: jest.fn(), retry: jest.fn() }));
jest.mock('../src/features/mom/StatusRow', () => ({ StatusRow: () => null }));
jest.mock('../src/features/mom/MeetingView', () => ({ MeetingView: () => null }));
jest.mock('../src/features/mom/RecorderScreen', () => ({ RecorderBar: () => null }));
jest.mock('../src/features/mom/RemoveRecording', () => ({ RemoveRecording: () => null }));
jest.mock('../src/screens/HeaderActions', () => ({ HeaderActions: () => null }));
jest.mock('react-native/Libraries/Components/RefreshControl/RefreshControl', () => {
  const { View } = jest.requireActual('react-native');
  const Control = (props: object) => <View {...props} />;
  return { __esModule: true, default: Control };
});
jest.mock('../src/ui/RowActions', () => ({ RowActions: ({ children }: { children: (bind: object) => unknown }) => children({}) }));

function mockAccount() {
  return account;
}

async function setNetwork(state: Partial<NetworkState>) {
  await act(() => {
    mockNetwork.state = state;
    mockNetwork.listeners.forEach((listener) => listener());
  });
}

const meeting = { id: 7, name: 'Kickoff', day: '2026-11-20', programme: { id: 1, name: 'P' }, recordings: 1, transcribed: 1, chip: 'done', chipLabel: 'Done', generatedAt: false as const };

beforeEach(() => {
  mockBoard.mockReset();
  mockNetwork.state = { isConnected: true, isInternetReachable: true };
});

describe('noticeFor', () => {
  it.each([
    [{ online: false, shown: false, failed: true }, null],
    [{ online: false, shown: true, failed: false }, 'offline'],
    [{ online: false, shown: true, failed: true }, 'offline'],
    [{ online: true, shown: true, failed: true }, 'failed'],
    [{ online: true, shown: true, failed: false }, null],
  ])('maps %p to %p', (input, notice) => {
    expect(noticeFor(input)).toBe(notice);
  });
});

describe('useConnection', () => {
  it('refreshes once when the connection comes back, never while it stays', async () => {
    mockNetwork.state = { isConnected: false };
    const refresh = jest.fn();
    const { result, rerender } = await renderHook(() => useConnection({ shown: true, failed: false, refresh }));
    expect(result.current).toEqual({ online: false, notice: 'offline' });
    await setNetwork({ isConnected: true, isInternetReachable: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ online: true, notice: null });
    await rerender({});
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('treats a connected network without internet as offline', async () => {
    mockNetwork.state = { isConnected: true, isInternetReachable: false };
    const { result } = await renderHook(() => useConnection({ shown: true, failed: false, refresh: jest.fn() }));
    expect(result.current.notice).toBe('offline');
  });

  it('does not refresh on mount while online', async () => {
    const refresh = jest.fn();
    await renderHook(() => useConnection({ shown: false, failed: false, refresh }));
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('MomHome connection states', () => {
  const { MomHome } = require('../src/features/mom/MomHome') as typeof import('../src/features/mom/MomHome');
  const resource = require('../src/api/resource') as typeof import('../src/api/resource');

  let run = 0;
  beforeEach(() => {
    run += 1;
    account = { ...account, id: `u2_run${run}` };
  });

  it('shows the offline state instead of an empty list, then reloads on reconnect', async () => {
    mockBoard.mockResolvedValue({ meetings: [], total: 0 });
    const view = await render(<MomHome />);
    await waitFor(() => expect(screen.getByTestId('mom-meetings-empty')).toBeTruthy());
    mockBoard.mockRejectedValue(new TypeError('Network request failed'));
    await setNetwork({ isConnected: false });
    expect(screen.queryByTestId('mom-meetings-empty')).toBeNull();
    expect(screen.getByTestId('mom-meetings-offline')).toBeTruthy();
    expect(screen.getByText('No connection')).toBeTruthy();
    mockBoard.mockResolvedValue({ meetings: [meeting], total: 1 });
    await setNetwork({ isConnected: true, isInternetReachable: true });
    await waitFor(() => expect(screen.getByText('Kickoff')).toBeTruthy());
    expect(screen.queryByTestId('mom-connection-offline')).toBeNull();
    await view.unmount();
  });

  it('keeps loaded meetings under an offline banner', async () => {
    mockBoard.mockResolvedValue({ meetings: [meeting], total: 1 });
    const view = await render(<MomHome />);
    await waitFor(() => expect(screen.getByText('Kickoff')).toBeTruthy());
    await setNetwork({ isConnected: false });
    expect(screen.getByTestId('mom-connection-offline')).toBeTruthy();
    expect(screen.getByText('Kickoff')).toBeTruthy();
    await view.unmount();
  });

  it('tells a failed reload apart from offline and retries it', async () => {
    mockBoard.mockResolvedValue({ meetings: [meeting], total: 1 });
    const view = await render(<MomHome />);
    await waitFor(() => expect(screen.getByText('Kickoff')).toBeTruthy());
    mockBoard.mockRejectedValue(new Error('boom'));
    await act(async () => {
      await resource.load(`${account.id}:mom.board.40`, () => mockBoard());
    });
    expect(screen.getByTestId('mom-connection-failed')).toBeTruthy();
    expect(screen.queryByTestId('mom-connection-offline')).toBeNull();
    mockBoard.mockResolvedValue({ meetings: [meeting], total: 1 });
    await fireEvent.press(screen.getByTestId('mom-connection-retry'));
    await waitFor(() => expect(screen.queryByTestId('mom-connection-failed')).toBeNull());
    await view.unmount();
  });

  it('shows a failed reload of an empty list as an error, not as empty', async () => {
    mockBoard.mockResolvedValue({ meetings: [], total: 0 });
    const view = await render(<MomHome />);
    await waitFor(() => expect(screen.getByTestId('mom-meetings-empty')).toBeTruthy());
    mockBoard.mockRejectedValue(new Error('boom'));
    await act(async () => {
      await resource.load(`${account.id}:mom.board.40`, () => mockBoard());
    });
    expect(screen.getByTestId('mom-meetings-error')).toBeTruthy();
    expect(screen.queryByTestId('mom-meetings-empty')).toBeNull();
    await view.unmount();
  });

  it('shows a failed first load as an error with retry, not as empty', async () => {
    mockBoard.mockRejectedValue(new Error('boom'));
    const view = await render(<MomHome />);
    await waitFor(() => expect(screen.getByTestId('mom-meetings-error')).toBeTruthy());
    expect(screen.queryByTestId('mom-meetings-empty')).toBeNull();
    await view.unmount();
  });
});

describe('MomHome refresh indicator', () => {
  const { MomHome } = require('../src/features/mom/MomHome') as typeof import('../src/features/mom/MomHome');
  const resource = require('../src/api/resource') as typeof import('../src/api/resource');

  let run = 0;
  beforeEach(() => {
    run += 1;
    account = { ...account, id: `u2_pull${run}` };
  });

  const shown = () => screen.getByTestId('mom-refresh').props.refreshing;

  it('never draws the pull indicator over Record a meeting while the app loads or reloads meetings by itself', async () => {
    let answer: (board: Board) => void = () => undefined;
    mockBoard.mockImplementation(() => new Promise<Board>((resolve) => (answer = resolve)));
    const view = await render(<MomHome />);
    expect(screen.getByTestId('mom-meetings-loading')).toBeTruthy();
    expect(shown()).toBe(false);
    await act(async () => answer({ meetings: [meeting], total: 1 }));
    await waitFor(() => expect(screen.getByText('Kickoff')).toBeTruthy());
    let reload: Promise<void> = Promise.resolve();
    await act(async () => {
      reload = resource.load(`${account.id}:mom.board.40`, () => mockBoard());
    });
    expect(mockBoard).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('mom-record')).toBeTruthy();
    expect(shown()).toBe(false);
    await act(async () => {
      answer({ meetings: [], total: 0 });
      await reload;
    });
    await waitFor(() => expect(screen.getByTestId('mom-meetings-empty')).toBeTruthy());
    expect(shown()).toBe(false);
    await view.unmount();
  });

  it('shows the pull indicator from a pull until that reload settles, also when it fails', async () => {
    mockBoard.mockResolvedValue({ meetings: [meeting], total: 1 });
    const view = await render(<MomHome />);
    await waitFor(() => expect(screen.getByText('Kickoff')).toBeTruthy());
    let fail: (error: Error) => void = () => undefined;
    mockBoard.mockImplementation(() => new Promise<Board>((_resolve, reject) => (fail = reject)));
    await fireEvent(screen.getByTestId('mom-refresh'), 'refresh');
    expect(mockBoard).toHaveBeenCalledTimes(2);
    expect(shown()).toBe(true);
    await act(async () => fail(new Error('boom')));
    await waitFor(() => expect(shown()).toBe(false));
    expect(screen.getByTestId('mom-connection-failed')).toBeTruthy();
    await view.unmount();
  });

  it('keeps the pull indicator up until the answer of a reload that was already running when the user pulled', async () => {
    mockBoard.mockResolvedValue({ meetings: [meeting], total: 1 });
    const view = await render(<MomHome />);
    await waitFor(() => expect(screen.getByText('Kickoff')).toBeTruthy());
    let answer: (board: Board) => void = () => undefined;
    mockBoard.mockImplementation(() => new Promise<Board>((resolve) => (answer = resolve)));
    let reload: Promise<void> = Promise.resolve();
    await act(async () => {
      reload = resource.load(`${account.id}:mom.board.40`, () => mockBoard());
    });
    await fireEvent(screen.getByTestId('mom-refresh'), 'refresh');
    await act(async () => undefined);
    expect(mockBoard).toHaveBeenCalledTimes(2);
    expect(shown()).toBe(true);
    await act(async () => {
      answer({ meetings: [{ ...meeting, id: 8, name: 'Review' }], total: 1 });
      await reload;
    });
    await waitFor(() => expect(shown()).toBe(false));
    expect(screen.getByText('Review')).toBeTruthy();
    await view.unmount();
  });
});
