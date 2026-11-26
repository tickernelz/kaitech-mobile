import { act, render, screen, waitFor } from '@testing-library/react-native';
import type { NetworkState } from 'expo-network';

require('../src/i18n');

const mockAccount = { id: 'u2_disc', origin: 'https://odoo.test', db: 'lab0', userId: 2, partnerId: 3, deviceId: 4, name: 'T', login: 't', signedInAt: 0 };
const mockNetwork: { state: Partial<NetworkState>; listeners: Set<() => void> } = { state: { isConnected: true, isInternetReachable: true }, listeners: new Set() };
const mockApi = { programmes: jest.fn(), panel: jest.fn(), findings: jest.fn(), counts: jest.fn() };

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
jest.mock('../src/auth/session', () => ({ useSession: () => ({ active: mockAccount }), onAccountForgotten: () => () => undefined }));
jest.mock('../src/features/discovery/api', () => ({
  programmes: () => mockApi.programmes(),
  panel: () => mockApi.panel(),
  findings: () => mockApi.findings(),
  counts: () => mockApi.counts(),
}));
jest.mock('../src/features/discovery/CoworkerThread', () => ({ CoworkerThread: () => null }));
jest.mock('../src/features/discovery/useLatestConversation', () => ({ useLatestConversation: () => undefined }));
jest.mock('../src/features/discovery/store', () => ({
  openConversation: jest.fn(),
  rememberProgramme: jest.fn(),
  useLastProgramme: () => null,
  useOpenConversation: () => null,
}));
jest.mock('../src/screens/HeaderActions', () => ({ HeaderActions: () => null }));
jest.mock('../src/ui/RowActions', () => ({ RowActions: ({ children }: { children: (bind: object) => unknown }) => children({}) }));

const programme = { id: 40, name: 'Penerapan Odoo PT Testing', client: 'PT Testing', state: 'discovery', state_label: 'Discovery', waiting: 0 };
const panelData = {
  state: 'discovery',
  state_label: 'Discovery',
  sources: 2,
  progress: { question_answered: 1, question_total: 4, gates_signed: 0, gates_total: 0 },
  packets: [],
  needs_you: [],
};

async function setNetwork(state: Partial<NetworkState>) {
  await act(() => {
    mockNetwork.state = state;
    mockNetwork.listeners.forEach((listener) => listener());
  });
}

it('marks cached Discovery data as offline and reloads it when the connection returns', async () => {
  mockApi.programmes.mockResolvedValue([programme]);
  mockApi.panel.mockResolvedValue(panelData);
  mockApi.findings.mockResolvedValue([]);
  mockApi.counts.mockResolvedValue({ evidence: 3, findings: 1 });
  const { DiscoveryHome } = require('../src/features/discovery/Home') as typeof import('../src/features/discovery/Home');
  const view = await render(<DiscoveryHome />);
  await waitFor(() => expect(screen.getByTestId('programme-summary')).toBeTruthy());
  expect(screen.queryByTestId('discovery-connection-offline')).toBeNull();
  const panelCalls = mockApi.panel.mock.calls.length;

  mockApi.panel.mockRejectedValue(new TypeError('Network request failed'));
  await setNetwork({ isConnected: false });
  expect(screen.getByTestId('discovery-connection-offline')).toBeTruthy();
  expect(screen.getByTestId('programme-summary')).toBeTruthy();
  expect(mockApi.panel.mock.calls.length).toBe(panelCalls);

  mockApi.panel.mockResolvedValue(panelData);
  await setNetwork({ isConnected: true, isInternetReachable: true });
  await waitFor(() => expect(mockApi.panel.mock.calls.length).toBe(panelCalls + 1));
  expect(screen.queryByTestId('discovery-connection-offline')).toBeNull();
  expect(screen.queryByTestId('discovery-connection-failed')).toBeNull();
  await view.unmount();
});
