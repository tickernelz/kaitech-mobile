jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined } }));
const mockTick = jest.fn();
const mockToggle = jest.fn();
jest.mock('../src/ui/haptic', () => ({ haptic: { tick: () => mockTick() } }));
jest.mock('../src/features/chat/chat', () => ({ toggleReaction: (...args: unknown[]) => mockToggle(...args) }));
require('../src/i18n');
import { act, renderHook } from '@testing-library/react-native';
import type { Message } from '../src/features/chat/types';
const { useReaction } = require('../src/features/chat/ui/useReaction') as typeof import('../src/features/chat/ui/useReaction');

const message: Message = { id: 9, channelId: 7, authorId: 40, author: 'Rina Kusuma', body: 'Oke', date: 0, type: 'comment', attachments: [], parentId: null, reactions: [] };

beforeEach(() => {
  mockTick.mockClear();
  mockToggle.mockReset();
});

describe('reacting to a message', () => {
  it('ticks once and toggles the reaction', async () => {
    mockToggle.mockResolvedValue(null);
    const failed = jest.fn();
    const { result } = await renderHook(() => useReaction(failed));
    await act(() => result.current(message, '👍'));
    expect(mockTick).toHaveBeenCalledTimes(1);
    expect(mockToggle).toHaveBeenCalledWith(message, '👍');
    expect(failed).not.toHaveBeenCalled();
  });

  it('still ticks on the tap and reports the failure when the server refuses', async () => {
    mockToggle.mockResolvedValue('network');
    const failed = jest.fn();
    const { result } = await renderHook(() => useReaction(failed));
    await act(() => result.current(message, '👍'));
    expect(mockTick).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledTimes(1);
    expect(failed.mock.calls[0][0]).toEqual(expect.any(String));
    expect(failed.mock.calls[0][0].length).toBeGreaterThan(0);
  });
});
