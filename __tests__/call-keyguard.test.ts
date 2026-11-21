import { createElement } from 'react';
import { render } from '@testing-library/react-native';

const mockSurface: boolean[] = [];
const mockPush = jest.fn();
let mockPath = '/';
let mockCall = { phase: 'idle', answering: false, channelId: 5, video: false, channelName: '', callerName: 'Budi' };

jest.mock('expo-sqlite/kv-store', () => ({
  getItemSync: () => null,
  setItemSync: () => undefined,
  removeItemSync: () => undefined,
}));
jest.mock('expo-router', () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('../src/features/chat/chat', () => ({ onRealtimeNotifications: () => () => undefined }));
jest.mock('../src/features/call/ui/IncomingCall', () => ({ IncomingCall: () => null }));
jest.mock('../src/features/call/call', () => ({
  onNotification: () => undefined,
  startAccount: () => undefined,
  stopAccount: () => undefined,
  useCallState: () => mockCall,
  setCallSurface: (visible: boolean) => mockSurface.push(visible),
}));

require('../src/i18n');
const { CallRuntime } = require('../src/features/call/CallRuntime') as typeof import('../src/features/call/CallRuntime');

function show(phase: string, path = '/', answering = false) {
  mockCall = { ...mockCall, phase, answering };
  mockPath = path;
  return createElement(CallRuntime, { account: null });
}

describe('CallRuntime keeps only the call screen over the keyguard', () => {
  beforeEach(() => {
    mockSurface.length = 0;
    mockPush.mockClear();
  });

  it('leaves the launch hold alone until a call surface appears', async () => {
    await render(show('idle'));
    expect(mockSurface).toEqual([]);
  });

  it('gives the keyguard back after Decline', async () => {
    const view = await render(show('incoming'));
    await view.rerender(show('ended'));
    expect(mockSurface).toEqual([true, false]);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('gives the keyguard back when the caller leaves', async () => {
    const view = await render(show('incoming'));
    await view.rerender(show('idle'));
    expect(mockSurface).toEqual([true, false]);
  });

  it('opens the call screen on answer and gives the keyguard back when the user leaves it', async () => {
    const view = await render(show('incoming'));
    await view.rerender(show('incoming', '/', true));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '5' } });
    await view.rerender(show('incoming', '/call/5', true));
    await view.rerender(show('active', '/call/5'));
    expect(mockSurface).toEqual([true]);
    await view.rerender(show('active', '/'));
    expect(mockSurface).toEqual([true, false]);
  });
});
