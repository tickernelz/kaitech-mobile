jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));

function load(glass: boolean, reduceTransparency = false) {
  jest.resetModules();
  const rntl = require('@testing-library/react-native/pure') as typeof import('@testing-library/react-native/pure');
  const { AccessibilityInfo } = require('react-native') as typeof import('react-native');
  (require('expo-glass-effect').isLiquidGlassAvailable as jest.Mock).mockReturnValue(glass);
  jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockImplementation(async () => reduceTransparency);
  jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockImplementation(async () => false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((() => ({ remove: () => undefined })) as typeof AccessibilityInfo.addEventListener);
  jest.doMock('../src/auth/session', () => ({ ...jest.requireActual('../src/auth/session'), useSession: () => ({ active: { name: 'Budi Santoso', partnerId: 7 } }) }));
  require('../src/i18n');
  const { HeaderActions } = require('../src/screens/HeaderActions') as typeof import('../src/screens/HeaderActions');
  cleanup = rntl.cleanup;
  return { ...rntl, HeaderActions };
}

let cleanup: () => Promise<void> = async () => undefined;

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

describe('header actions beside the title', () => {
  it('sit together on one interactive glass capsule on iOS 26+', async () => {
    const { render, act, within, HeaderActions } = load(true);
    const view = await render(<HeaderActions />);
    await act(async () => undefined);
    const group = view.getByTestId('header-actions');
    expect(group.type).toBe('ExpoGlassView');
    expect(group.props.isInteractive).toBe(true);
    expect(within(group).getByTestId('open-search')).toBeTruthy();
    expect(within(group).getByTestId('open-settings')).toBeTruthy();
  });

  it('keep the bordered search button and no glass when Reduce Transparency is on', async () => {
    const { render, act, HeaderActions } = load(true, true);
    const view = await render(<HeaderActions />);
    await act(async () => undefined);
    expect(view.getByTestId('header-actions').type).not.toBe('ExpoGlassView');
    const { StyleSheet } = require('react-native') as typeof import('react-native');
    const style = StyleSheet.flatten(view.getByTestId('open-search').props.style);
    expect(style.borderWidth).toBeGreaterThan(0);
  });

  it('keep today\'s look where Liquid Glass is missing', async () => {
    const { render, act, HeaderActions } = load(false);
    const view = await render(<HeaderActions />);
    await act(async () => undefined);
    expect(view.getByTestId('header-actions').type).not.toBe('ExpoGlassView');
  });
});
