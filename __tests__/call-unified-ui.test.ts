import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockStarts: unknown[][] = [];
const mockAnswers: unknown[][] = [];
let mockCall = { phase: 'incoming', callerName: 'Web Caller', callerPartnerId: 22, channelId: 7 };

jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
jest.mock('../src/features/chat/ui/Avatar', () => ({ Avatar: () => null }));
jest.mock('../src/features/call/call', () => ({
  startCall: (...args: unknown[]) => mockStarts.push(args),
  answer: (...args: unknown[]) => mockAnswers.push(args),
  decline: () => undefined,
  useCallState: () => mockCall,
}));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: { View } };
});

const i18n = require('../src/i18n').default;
const { CallButton } = require('../src/features/call/ui/CallButton') as typeof import('../src/features/call/ui/CallButton');
const { IncomingCall } = require('../src/features/call/ui/IncomingCall') as typeof import('../src/features/call/ui/IncomingCall');
const { CallPill } = require('../src/features/call/ui/CallControls') as typeof import('../src/features/call/ui/CallControls');

const languages = ['en', 'id'] as const;
const cameraState = { muted: false, cameraOn: false, speaker: true, sharing: false, recording: null };

beforeEach(() => {
  mockPush.mockClear();
  mockStarts.length = 0;
  mockAnswers.length = 0;
  mockCall = { phase: 'incoming', callerName: 'Web Caller', callerPartnerId: 22, channelId: 7 };
});

afterAll(() => i18n.changeLanguage('en'));

describe.each(languages)('one way to call (%s)', (language) => {
  beforeEach(() => i18n.changeLanguage(language));

  it('shows one Call button that opens the call screen and starts a call without video', async () => {
    await render(createElement(CallButton, { channelId: 5, channelName: 'Team' }));
    const button = screen.getByTestId('call-start');
    expect(button.props.accessibilityLabel).toBe(language === 'en' ? 'Call' : 'Panggil');
    expect(screen.queryByTestId('call-video')).toBeNull();
    fireEvent.press(button);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '5' } });
    expect(mockStarts).toEqual([[{ channelId: 5, channelName: 'Team' }]]);
  });

  it('offers answer and decline only, with one call text', async () => {
    await render(createElement(IncomingCall));
    expect(screen.getByText(language === 'en' ? 'Incoming call' : 'Panggilan masuk')).toBeTruthy();
    expect(screen.queryByTestId('incoming-answer-other')).toBeNull();
    fireEvent.press(screen.getByTestId('incoming-answer'));
    expect(mockAnswers).toEqual([[]]);
  });

  it('explains a refused camera on the camera button instead of ending the call', async () => {
    await render(
      createElement(CallPill, {
        actions: ['camera', 'hangup'],
        state: { ...cameraState, cameraBlocked: true },
        onStage: false,
        vertical: false,
        shown: true,
        motion: {},
        onAction: () => undefined,
        onTouch: () => undefined,
      }),
    );
    expect(screen.getByTestId('call-camera').props.accessibilityLabel).toBe(language === 'en' ? 'Camera access is off' : 'Akses kamera mati');
  });
});

it('renders nothing once the ringing stops', async () => {
  mockCall = { ...mockCall, phase: 'idle' };
  await render(createElement(IncomingCall));
  expect(screen.queryByTestId('incoming-call')).toBeNull();
});
