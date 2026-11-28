type Drawn = { props: { style?: unknown }; children: (Drawn | string)[] | null } | Drawn[] | null;

jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));

function load(glass: boolean, reduceTransparency = false) {
  jest.resetModules();
  const rntl = require('@testing-library/react-native/pure') as typeof import('@testing-library/react-native/pure');
  const { AccessibilityInfo, StyleSheet } = require('react-native') as typeof import('react-native');
  (require('expo-glass-effect').isLiquidGlassAvailable as jest.Mock).mockReturnValue(glass);
  jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockImplementation(async () => reduceTransparency);
  jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockImplementation(async () => false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((() => ({ remove: () => undefined })) as typeof AccessibilityInfo.addEventListener);
  const { SafeAreaProvider } = require('react-native-safe-area-context') as typeof import('react-native-safe-area-context');
  const { Fab } = require('../src/ui/Fab') as typeof import('../src/ui/Fab');
  const { colorsFor } = require('../src/theme/tokens') as typeof import('../src/theme/tokens');
  const onPress = jest.fn();
  const metrics = { frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
  const tree = (
    <SafeAreaProvider initialMetrics={metrics}>
      <Fab icon="edit" label="New chat" onPress={onPress} testID="chat-new" />
    </SafeAreaProvider>
  );
  const fills = (node: Drawn | string): unknown[] => {
    if (!node || typeof node === 'string') return [];
    if (Array.isArray(node)) return node.flatMap(fills);
    const own = (StyleSheet.flatten(node.props.style as never) as { backgroundColor?: unknown } | undefined)?.backgroundColor;
    return [...(own && own !== 'transparent' ? [own] : []), ...(node.children ?? []).flatMap(fills)];
  };
  const painted = (hex: string) => `"payload":${0xff000000 + parseInt(hex.slice(1), 16)}`;
  cleanup = rntl.cleanup;
  return { ...rntl, tree, onPress, fills, painted, colors: colorsFor('light') };
}

let cleanup: () => Promise<void> = async () => undefined;

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

describe('iOS floating action button', () => {
  it('is a liquid glass circle with a tint icon on iOS 26+', async () => {
    const { render, act, tree, colors, fills, painted } = load(true);
    const view = await render(tree);
    await act(async () => undefined);
    const glass = view.getByTestId('chat-new-glass');
    expect(glass.type).toBe('ExpoGlassView');
    expect(fills(view.toJSON() as Drawn)).not.toContain(colors.primary);
    expect(JSON.stringify(view.toJSON())).toContain(painted(colors.primary));
  });

  it('is a blurred glass circle, not a purple fill, before iOS 26', async () => {
    const { render, act, tree, colors, fills, painted } = load(false);
    const view = await render(tree);
    await act(async () => undefined);
    expect(view.getByTestId('glass-tint')).toBeTruthy();
    expect(fills(view.toJSON() as Drawn)).not.toContain(colors.primary);
    expect(JSON.stringify(view.toJSON())).toContain(painted(colors.primary));
  });

  it('turns into a solid surface circle with an edge under Reduce Transparency and still runs its action', async () => {
    const { render, act, fireEvent, tree, colors, fills, onPress } = load(true, true);
    const view = await render(tree);
    await act(async () => undefined);
    expect(view.queryByTestId('glass-tint')).toBeNull();
    expect(view.getByTestId('chat-new-glass').type).not.toBe('ExpoGlassView');
    expect(fills(view.toJSON() as Drawn)).toEqual([colors.surface]);
    const fab = view.getByTestId('chat-new');
    expect(fab.props.accessibilityLabel).toBe('New chat');
    await act(async () => fireEvent.press(fab));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
