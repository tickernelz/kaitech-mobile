import { renderHook, waitFor } from '@testing-library/react-native';

const mockForgotten: ((id: string) => void)[] = [];
const mockActive = { id: 'u1_a' };

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../src/auth/session', () => ({
  onAccountForgotten: (listener: (id: string) => void) => mockForgotten.push(listener),
  useSession: () => ({ active: mockActive }),
}));

const { invalidate, load, useResource } = require('../src/api/resource') as typeof import('../src/api/resource');

it('shows nothing from an answer that arrived after its account signed out', async () => {
  let release!: (value: string) => void;
  const pending = load('u1_a:mom.board', () => new Promise<string>((resolve) => (release = resolve)));
  mockForgotten.forEach((listener) => listener('u1_a'));
  release('meetings of the signed-out session');
  await pending;
  const { result } = await renderHook(() => useResource<string>('mom.board', () => new Promise<string>(() => undefined)));
  expect(result.current.data).toBeUndefined();
});

it('fetches again when the data was invalidated while it was loading', async () => {
  const answers = ['before the upload finished', 'after the upload finished'];
  const fetcher = jest.fn(async () => answers.shift() ?? '');
  const pending = load('u1_a:mom.list', fetcher);
  invalidate('u1_a:mom.');
  await pending;
  expect(fetcher).toHaveBeenCalledTimes(2);
  const { result } = await renderHook(() => useResource<string>('mom.list', fetcher, 60_000));
  expect(result.current.data).toBe('after the upload finished');
});

it('fetches again for a list on screen when its data was invalidated while a refetch was loading', async () => {
  const answers: ((value: string[]) => void)[] = [];
  const fetcher = jest.fn(() => new Promise<string[]>((resolve) => answers.push(resolve)));
  const { result } = await renderHook(() => useResource<string[]>('mom.board.40', fetcher, 60_000));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  answers[0]([]);
  await waitFor(() => expect(result.current.data).toEqual([]));
  const again = result.current.refresh();
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  invalidate('u1_a:mom.');
  answers[1]([]);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  answers[2](['Uji hapus']);
  await again;
  await waitFor(() => expect(result.current.data).toEqual(['Uji hapus']));
});

it('does not fetch again after a failed load that was invalidated while loading', async () => {
  const fetcher = jest.fn(async () => {
    invalidate('u1_a:mom.failing');
    throw new Error('offline');
  });
  await load('u1_a:mom.failing', fetcher);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('lets a pull that lands while a load runs wait for that answer instead of settling at once', async () => {
  let release!: (value: string) => void;
  const fetcher = jest.fn(() => new Promise<string>((resolve) => (release = resolve)));
  const running = load('u1_a:mom.pull', fetcher);
  let pulled = false;
  const pull = load('u1_a:mom.pull', fetcher).then(() => {
    pulled = true;
  });
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
  expect(pulled).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(1);
  release('meetings');
  await pull;
  await running;
  const { result } = await renderHook(() => useResource<string>('mom.pull', fetcher, 60_000));
  expect(result.current.data).toBe('meetings');
});
