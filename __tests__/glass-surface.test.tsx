import { surfaceFor } from '../src/ui/glass';

describe('surface choice', () => {
  it.each([
    [true, false, false, 'glass'],
    [true, true, false, 'solid'],
    [true, false, true, 'solid'],
    [false, false, false, 'solid'],
  ] as const)('glass %p, reduce transparency %p, increase contrast %p gives %p', (available, reduceTransparency, increaseContrast, expected) => {
    expect(surfaceFor(available, { reduceTransparency, increaseContrast })).toBe(expected);
  });
});

describe('useSurface', () => {
  type Listener = (on: boolean) => void;

  function fresh(available: boolean, settings: { reduceTransparency: () => Promise<boolean>; increaseContrast: () => Promise<boolean> }) {
    jest.resetModules();
    const rntl = require('@testing-library/react-native/pure') as typeof import('@testing-library/react-native/pure');
    const { AccessibilityInfo, Text: FreshText } = require('react-native') as typeof import('react-native');
    (require('expo-glass-effect').isLiquidGlassAvailable as jest.Mock).mockReturnValue(available);
    const listeners: Record<string, Listener> = {};
    const asked = jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockImplementation(settings.reduceTransparency);
    jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockImplementation(settings.increaseContrast);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((name: string, listener: Listener) => {
      listeners[name] = listener;
      return { remove: () => undefined };
    }) as typeof AccessibilityInfo.addEventListener);
    const { useSurface } = require('../src/ui/glass') as typeof import('../src/ui/glass');
    const { FloatingSurface } = require('../src/ui/FloatingSurface') as typeof import('../src/ui/FloatingSurface');
    function Probe() {
      return <FreshText testID="surface">{useSurface()}</FreshText>;
    }
    const shown = () => rntl.screen.getByTestId('surface').props.children;
    cleanup = rntl.cleanup;
    return { ...rntl, listeners, asked, Probe, shown, FloatingSurface };
  }

  let cleanup: () => Promise<void> = async () => undefined;

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  it('stays solid until the accessibility settings are known, then turns to glass', async () => {
    const { render: draw, act: settle, Probe, shown } = fresh(true, { reduceTransparency: async () => false, increaseContrast: async () => false });
    await draw(<Probe />);
    await settle(async () => undefined);
    expect(shown()).toBe('glass');
  });

  it('turns solid when Reduce Transparency or Increase Contrast is switched on while the app runs', async () => {
    const { render: draw, act: settle, listeners, Probe, shown } = fresh(true, { reduceTransparency: async () => false, increaseContrast: async () => false });
    await draw(<Probe />);
    await settle(async () => undefined);
    await settle(async () => listeners.reduceTransparencyChanged(true));
    expect(shown()).toBe('solid');
    await settle(async () => listeners.reduceTransparencyChanged(false));
    expect(shown()).toBe('glass');
    await settle(async () => listeners.darkerSystemColorsChanged(true));
    expect(shown()).toBe('solid');
  });

  it('starts solid when Reduce Transparency is already on', async () => {
    const { render: draw, act: settle, Probe, shown } = fresh(true, { reduceTransparency: async () => true, increaseContrast: async () => false });
    await draw(<Probe />);
    expect(shown()).toBe('solid');
    await settle(async () => undefined);
    expect(shown()).toBe('solid');
  });

  it('keeps the system look when the accessibility query fails', async () => {
    const { render: draw, act: settle, Probe, shown } = fresh(true, {
      reduceTransparency: async () => Promise.reject(new Error('no module')),
      increaseContrast: async () => Promise.reject(new Error('no module')),
    });
    await draw(<Probe />);
    await settle(async () => undefined);
    expect(shown()).toBe('glass');
  });

  it('never asks for accessibility settings where glass does not exist', async () => {
    const { render: draw, act: settle, asked, Probe, shown } = fresh(false, { reduceTransparency: async () => false, increaseContrast: async () => false });
    await draw(<Probe />);
    await settle(async () => undefined);
    expect(shown()).toBe('solid');
    expect(asked).not.toHaveBeenCalled();
  });

  it('floats controls on regular glass, and on clear glass only over photos and video', async () => {
    const { render: draw, act: settle, FloatingSurface } = fresh(true, { reduceTransparency: async () => false, increaseContrast: async () => false });
    const view = await draw(
      <>
        <FloatingSurface solid="#151418" testID="bar" />
        <FloatingSurface solid="#000000" overMedia testID="call" />
      </>,
    );
    await settle(async () => undefined);
    expect(view.getByTestId('bar').type).toBe('ExpoGlassView');
    expect(view.getByTestId('bar').props.glassEffectStyle).toBe('regular');
    expect(view.getByTestId('call').props.glassEffectStyle).toBe('clear');
  });

  it('paints floating controls solid when Reduce Transparency is on', async () => {
    const { render: draw, act: settle, FloatingSurface } = fresh(true, { reduceTransparency: async () => true, increaseContrast: async () => false });
    const view = await draw(<FloatingSurface solid="#151418" testID="bar" />);
    await settle(async () => undefined);
    expect(view.getByTestId('bar').type).not.toBe('ExpoGlassView');
    const { StyleSheet } = require('react-native') as typeof import('react-native');
    expect(StyleSheet.flatten(view.getByTestId('bar').props.style)).toMatchObject({ backgroundColor: '#151418' });
  });
});

describe('useSeeThrough on Android', () => {
  type Listener = (on: boolean) => void;
  let cleanup: () => Promise<void> = async () => undefined;

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  function android(highContrast: () => Promise<boolean>) {
    jest.resetModules();
    const rntl = require('@testing-library/react-native/pure') as typeof import('@testing-library/react-native/pure');
    const { AccessibilityInfo, Platform, Text: FreshText } = require('react-native') as typeof import('react-native');
    jest.replaceProperty(Platform, 'OS', 'android');
    const listeners: Record<string, Listener> = {};
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockImplementation(async () => false);
    const darker = jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockImplementation(async () => false);
    jest.spyOn(AccessibilityInfo, 'isHighTextContrastEnabled').mockImplementation(highContrast);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((name: string, listener: Listener) => {
      listeners[name] = listener;
      return { remove: () => undefined };
    }) as typeof AccessibilityInfo.addEventListener);
    const { useSeeThrough } = require('../src/ui/glass') as typeof import('../src/ui/glass');
    function Probe() {
      return <FreshText testID="see-through">{String(useSeeThrough())}</FreshText>;
    }
    cleanup = rntl.cleanup;
    return { ...rntl, listeners, darker, Probe, shown: () => rntl.screen.getByTestId('see-through').props.children };
  }

  it('reads high contrast text, not the iOS setting, and turns solid when it is switched on', async () => {
    const { render: draw, act: settle, listeners, darker, Probe, shown } = android(async () => false);
    await draw(<Probe />);
    await settle(async () => undefined);
    expect(shown()).toBe('true');
    expect(darker).not.toHaveBeenCalled();
    await settle(async () => listeners.highTextContrastChanged(true));
    expect(shown()).toBe('false');
    await settle(async () => listeners.highTextContrastChanged(false));
    expect(shown()).toBe('true');
  });

  it('starts solid when high contrast text is already on', async () => {
    const { render: draw, act: settle, Probe, shown } = android(async () => true);
    await draw(<Probe />);
    await settle(async () => undefined);
    expect(shown()).toBe('false');
  });
});
