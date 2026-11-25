import { createElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockExtra: Record<string, unknown> = {};
const mockPush = jest.fn();
const mockOpen = jest.fn();

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return {
    __esModule: true,
    default: { View },
    FadeIn: chain(),
    FadeInDown: chain(),
    Easing: chain(),
    useSharedValue: (value: unknown) => ({ get: () => value, set: () => undefined }),
    useAnimatedStyle: (style: () => object) => style(),
    withTiming: (value: unknown) => value,
  };
});
jest.mock('expo-sqlite/kv-store', () => ({
  getItemSync: () => null,
  setItemSync: () => undefined,
  removeItemSync: () => undefined,
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: mockExtra };
    },
  },
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
  setItemAsync: async () => undefined,
  getItemAsync: async () => null,
  deleteItemAsync: async () => undefined,
}));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: (...args: unknown[]) => mockOpen(...args) }));
jest.mock('../src/auth/pkce', () => ({ createPkce: async () => ({ verifier: 'v', challenge: 'c', state: 's' }) }));
jest.mock('../src/auth/session', () => ({ addAccount: jest.fn() }));

require('../src/i18n');
const Welcome = (require('../src/app/welcome') as typeof import('../src/app/welcome')).default;
const { SignInForm } = require('../src/screens/SignInForm') as typeof import('../src/screens/SignInForm');

function openedUrl(): URL {
  return new URL(mockOpen.mock.calls[0][0] as string);
}

function configure(extra: Record<string, unknown>) {
  for (const key of Object.keys(mockExtra)) delete mockExtra[key];
  Object.assign(mockExtra, extra);
}

beforeEach(() => {
  mockPush.mockReset();
  mockOpen.mockReset().mockResolvedValue({ type: 'cancel' });
});

describe('sign-in with a build default server', () => {
  beforeEach(() => configure({ linkHost: 'lab0.kaitech.io', defaultDatabase: 'lab0' }));

  it('opens the default server page from the welcome button without asking for anything', async () => {
    await render(createElement(Welcome));
    await fireEvent.press(screen.getByTestId('welcome-sign-in'));
    await waitFor(() => expect(screen.getByTestId('welcome-error')).toHaveTextContent('Sign-in was cancelled.'));
    expect(mockPush).not.toHaveBeenCalled();
    expect(openedUrl().origin + openedUrl().pathname).toBe('https://lab0.kaitech.io/web/login');
    expect(openedUrl().searchParams.get('db')).toBe('lab0');
  });

  it('checks a custom server and database before the browser opens, then goes back to the default', async () => {
    await render(createElement(SignInForm, { custom: true, onDone: jest.fn(), onBack: jest.fn() }));
    await fireEvent.changeText(screen.getByTestId('sign-in-server'), 'http://erp.example.com');
    await fireEvent.press(screen.getByTestId('sign-in-continue'));
    await waitFor(() => expect(screen.getByTestId('sign-in-server-error')).toHaveTextContent('The server must use a secure connection (https).'));
    await fireEvent.changeText(screen.getByTestId('sign-in-server'), 'erp.example.com');
    await fireEvent.changeText(screen.getByTestId('sign-in-database'), 'erp main');
    await fireEvent.press(screen.getByTestId('sign-in-continue'));
    await waitFor(() => expect(screen.getByTestId('sign-in-database-error')).toHaveTextContent("That doesn't look like a database name."));
    expect(mockOpen).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('sign-in-use-default'));
    expect(screen.queryByTestId('sign-in-server')).toBeNull();
    await fireEvent.press(screen.getByTestId('sign-in-continue'));
    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(1));
    expect(openedUrl().host).toBe('lab0.kaitech.io');
    expect(openedUrl().searchParams.get('db')).toBe('lab0');
  });

  it('signs in to a valid custom server and database', async () => {
    await render(createElement(SignInForm, { custom: true, onDone: jest.fn(), onBack: jest.fn() }));
    await fireEvent.changeText(screen.getByTestId('sign-in-server'), 'erp.example.com');
    await fireEvent.changeText(screen.getByTestId('sign-in-database'), 'erp_main');
    await fireEvent.press(screen.getByTestId('sign-in-continue'));
    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(1));
    expect(openedUrl().host).toBe('erp.example.com');
    expect(openedUrl().searchParams.get('db')).toBe('erp_main');
  });
});

describe('sign-in to a server with one database', () => {
  beforeEach(() => configure({ linkHost: 'lab0.kaitech.io', defaultDatabase: 'lab0' }));

  it('opens the custom server without a database when the field is left empty', async () => {
    await render(createElement(SignInForm, { custom: true, onDone: jest.fn(), onBack: jest.fn() }));
    await fireEvent.changeText(screen.getByTestId('sign-in-server'), 'erp.example.com');
    await fireEvent.press(screen.getByTestId('sign-in-continue'));
    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(1));
    expect(openedUrl().origin + openedUrl().pathname).toBe('https://erp.example.com/kaitech_mobile/authorize');
  });
});

describe('sign-in when the build has no default database', () => {
  beforeEach(() => configure({ linkHost: 'lab0.kaitech.io' }));

  it('sends the welcome button to the server form', async () => {
    await render(createElement(Welcome));
    expect(screen.queryByTestId('welcome-other-server')).toBeNull();
    await fireEvent.press(screen.getByTestId('welcome-sign-in'));
    expect(mockPush).toHaveBeenCalledWith('/sign-in');
    expect(mockOpen).not.toHaveBeenCalled();
  });

  it('shows the server form without a way back to a default', async () => {
    await render(createElement(SignInForm, { onDone: jest.fn(), onBack: jest.fn() }));
    expect(screen.getByTestId('sign-in-server')).toBeTruthy();
    expect(screen.queryByTestId('sign-in-use-default')).toBeNull();
    expect(screen.queryByTestId('sign-in-other-server')).toBeNull();
  });
});
