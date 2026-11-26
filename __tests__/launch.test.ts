const mockHide = jest.fn();
const mockPrevent = jest.fn(() => Promise.resolve(true));

jest.mock('expo-splash-screen', () => ({
  hide: () => mockHide(),
  preventAutoHideAsync: () => mockPrevent(),
  setOptions: jest.fn(),
}));

const launch = require('../src/ui/launch') as typeof import('../src/ui/launch');

describe('splash at launch', () => {
  it('stays up until the first screen lays out, then goes once', () => {
    launch.holdSplash();
    expect(mockPrevent).toHaveBeenCalledTimes(1);
    expect(mockHide).not.toHaveBeenCalled();
    expect(launch.splashGone()).toBe(false);
    launch.firstScreenDrawn();
    launch.firstScreenDrawn();
    expect(mockHide).toHaveBeenCalledTimes(1);
    expect(launch.splashGone()).toBe(true);
  });
});
