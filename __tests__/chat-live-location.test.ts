import { ApiError } from '../src/api/odoo';
import { dueUpdate, liveSettings, liveShares, pushFix, stopShare, syncLive, trackShare } from '../src/features/chat/live';

const mockRoute = jest.fn();
const mockStore = new Map<string, string>();
const mockLocation = { started: false, start: jest.fn(), stop: jest.fn(), watch: jest.fn() };
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockStore.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockStore.set(key, value),
    removeItemSync: (key: string) => mockStore.delete(key),
  },
}));
jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  ActivityType: { Other: 1 },
  hasStartedLocationUpdatesAsync: async () => mockLocation.started,
  startLocationUpdatesAsync: async (...args: unknown[]) => {
    mockLocation.start(...args);
    mockLocation.started = true;
  },
  stopLocationUpdatesAsync: async () => {
    mockLocation.stop();
    mockLocation.started = false;
  },
  watchPositionAsync: async (...args: unknown[]) => mockLocation.watch(...args),
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));
jest.mock('../src/api/odoo', () => {
  class ApiError extends Error {
    constructor(code: string, status: number, detail: string | null = null, reason: string | null = null) {
      super(code);
      Object.assign(this, { code, status, detail, reason });
    }
  }
  return { route: (...args: unknown[]) => mockRoute(...args), serverLanguage: () => 'en_US', ApiError };
});
jest.mock('../src/auth/session', () => ({ getSession: () => ({ accounts: [{ id: 'a', origin: 'https://lab0.test' }] }) }));
jest.mock('../src/i18n', () => ({ __esModule: true, default: { getFixedT: () => (key: string) => key } }));
jest.mock('../src/ui/permission', () => ({ askPermission: jest.fn() }));
jest.mock('../src/features/chat/messageActions', () => ({ run: jest.fn() }));
jest.mock('../src/features/chat/chat', () => ({ getChat: () => ({ accountId: 'a' }), patchMessages: jest.fn() }));

const account = { id: 'a', origin: 'https://lab0.test' } as never;
const here = { latitude: -6.2, longitude: 106.8, accuracy: 10, at: 0 };
const now = 1_000_000;

beforeEach(() => {
  mockStore.clear();
  mockRoute.mockReset();
  mockLocation.started = false;
  mockLocation.start.mockReset();
  mockLocation.stop.mockReset();
});

describe('when a live share sends', () => {
  it('sends the first point, then only after moving 20 m or two minutes, never within 5 s', () => {
    expect(dueUpdate(null, here, now)).toBe(true);
    const last = { latitude: -6.2, longitude: 106.8, at: now };
    expect(dueUpdate(last, { latitude: -6.2003, longitude: 106.8 }, now + 4999)).toBe(false);
    expect(dueUpdate(last, { latitude: -6.2001, longitude: 106.8 }, now + 30000)).toBe(false);
    expect(dueUpdate(last, { latitude: -6.2002, longitude: 106.8 }, now + 30000)).toBe(true);
    expect(dueUpdate(last, here, now + liveSettings.heartbeatMs)).toBe(true);
  });
});

describe('a live share on this phone', () => {
  it('starts the foreground service with a stop action when a share begins and stops it when the last one stops', async () => {
    trackShare('a', { messageId: 902, channelId: 12, until: Date.now() + 60000 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockLocation.start).toHaveBeenCalledWith('kaitech-live-location', expect.objectContaining({ timeInterval: 30000, foregroundService: expect.objectContaining({ stopActionUrl: 'kaitech-live-location://stop' }) }));
    mockRoute.mockResolvedValue({ store_data: {} });
    expect(await stopShare(account, 902)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockRoute).toHaveBeenCalledWith(account, '/kaitech_chat/location/stop', { message_id: 902 });
    expect(mockLocation.stop).toHaveBeenCalled();
    expect(liveShares('a')).toEqual([]);
  });

  it('posts the point for each running share and forgets a share the server ended', async () => {
    trackShare('a', { messageId: 902, channelId: 12, until: now + 60000 });
    trackShare('a', { messageId: 903, channelId: 13, until: now + 60000 });
    mockRoute.mockImplementation(async (_account: unknown, _path: string, params: { message_id: number }) => {
      if (params.message_id === 903) throw new ApiError('refused', 200, 'over', 'ended');
      return { store_data: {} };
    });
    await pushFix(here, now);
    expect(mockRoute).toHaveBeenCalledWith(account, '/kaitech_chat/location/update', { message_id: 902, latitude: -6.2, longitude: 106.8, accuracy: 10 });
    expect(liveShares('a', now).map((share) => share.messageId)).toEqual([902]);
  });

  it('keeps the share and tries again later when the phone is offline', async () => {
    trackShare('a', { messageId: 902, channelId: 12, until: now + 60000 });
    mockRoute.mockRejectedValue(new Error('network'));
    await pushFix(here, now);
    expect(liveShares('a', now).map((share) => share.messageId)).toEqual([902]);
  });

  it('drops a share whose time ran out without posting it', async () => {
    trackShare('a', { messageId: 902, channelId: 12, until: now - 1 });
    await pushFix(here, now);
    expect(mockRoute).not.toHaveBeenCalled();
    expect(liveShares('a', 0)).toEqual([]);
  });

  it('after a restart keeps only the shares the server still runs, ignoring shares started on another device', async () => {
    trackShare('a', { messageId: 902, channelId: 12, until: Date.now() + 60000 });
    trackShare('a', { messageId: 904, channelId: 14, until: Date.now() + 60000 });
    mockRoute.mockResolvedValue({ shares: [{ message_id: 902 }, { message_id: 999 }] });
    await syncLive(account);
    expect(mockRoute).toHaveBeenCalledWith(account, '/kaitech_chat/location/active', {});
    expect(liveShares('a').map((share) => share.messageId)).toEqual([902]);
  });

  it('replaces an earlier share in the same chat, as the server does', () => {
    trackShare('a', { messageId: 902, channelId: 12, until: Date.now() + 60000 });
    trackShare('a', { messageId: 905, channelId: 12, until: Date.now() + 60000 });
    expect(liveShares('a').map((share) => share.messageId)).toEqual([905]);
  });
});
