import { renderHook } from '@testing-library/react-native';

const mockForgotten: ((id: string) => void)[] = [];

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../src/auth/session', () => ({
  onAccountForgotten: (listener: (id: string) => void) => mockForgotten.push(listener),
  useSession: () => ({ active: { id: 'u1_a' } }),
}));

const { load, useResource } = require('../src/api/resource') as typeof import('../src/api/resource');

it('shows nothing from an answer that arrived after its account signed out', async () => {
  let release!: (value: string) => void;
  const pending = load('u1_a:mom.board', () => new Promise<string>((resolve) => (release = resolve)));
  mockForgotten.forEach((listener) => listener('u1_a'));
  release('meetings of the signed-out session');
  await pending;
  const { result } = await renderHook(() => useResource<string>('mom.board', () => new Promise<string>(() => undefined)));
  expect(result.current.data).toBeUndefined();
});
