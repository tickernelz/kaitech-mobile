import { createElement } from 'react';
import { render, screen, within } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return {
    __esModule: true,
    default: { View },
    Easing: chain(),
    useReducedMotion: () => true,
    useSharedValue: (value: unknown) => ({ get: () => value, set: () => undefined }),
    useAnimatedStyle: (style: () => object) => style(),
    withTiming: (value: unknown) => value,
  };
});
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('../src/auth/session', () => ({ ...jest.requireActual('../src/auth/session'), useSession: () => ({ active: { name: 'Budi Santoso' } }) }));

require('../src/i18n');
const { Icon, iconNames } = require('../src/ui/icons') as typeof import('../src/ui/icons');
const { plan, strokeFor } = require('../src/ui/icons/glyphs') as typeof import('../src/ui/icons/glyphs');
const { CallPill } = require('../src/features/call/ui/CallControls') as typeof import('../src/features/call/ui/CallControls');
const { controlsFor } = require('../src/features/call/controls') as typeof import('../src/features/call/controls');
const { IconButton } = require('../src/features/discovery/ui') as typeof import('../src/features/discovery/ui');
const { HeaderActions } = require('../src/screens/HeaderActions') as typeof import('../src/screens/HeaderActions');

const sizes = [16, 20, 24, 32];
const hidden = { includeHiddenElements: true };

function coordinates(d: string): number[][] {
  const out: number[][] = [];
  let x = 0;
  let y = 0;
  const arity: Record<string, number> = { M: 2, L: 2, T: 2, H: 1, V: 1, S: 4, Q: 4, C: 6, A: 7, Z: 0 };
  for (const [, command, args] of d.matchAll(/([MmLlHhVvAaZzCcSsQqTt])([^MmLlHhVvAaZzCcSsQqTt]*)/g)) {
    const n = (args.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();
    const step = arity[upper];
    for (let i = 0; step && i < n.length; i += step) {
      if (upper === 'H') x = relative ? x + n[i] : n[i];
      else if (upper === 'V') y = relative ? y + n[i] : n[i];
      else {
        const px = n[i + step - 2];
        const py = n[i + step - 1];
        x = relative ? x + px : px;
        y = relative ? y + py : py;
      }
      out.push([x, y]);
    }
  }
  return out;
}

describe('Kaitech icon set', () => {
  it('renders every name in both variants as a few flat paths', async () => {
    for (const name of iconNames) {
      for (const variant of ['line', 'fill'] as const) {
        const { unmount } = await render(createElement(Icon, { name, color: '#123456', size: 24, variant }));
        expect(screen.getByTestId(`icon-${name}`, hidden).props.width).toBe(24);
        const tree = JSON.stringify(screen.toJSON());
        const paths = tree.match(/"type":"RNSVGPath"/g)?.length ?? 0;
        expect(paths).toBeGreaterThan(0);
        if (!tree.includes('RNSVGMask')) expect(paths).toBeLessThanOrEqual(2);
        await unmount();
      }
    }
  });

  it('thins the stroke as the optical size grows', () => {
    expect(sizes.map(strokeFor)).toEqual([2.25, 2.1, 2, 1.75]);
    expect(plan('chat', 'line', 16).strokeWidth).toBe(2.25);
  });

  it.each(iconNames)('%s keeps every point inside the 24 grid with a 1px margin', (name) => {
    const { masked, cutouts, over } = plan(name, 'fill', 24);
    for (const { d } of [...masked, ...cutouts, ...over]) {
      for (const [x, y] of coordinates(d)) {
        expect(x).toBeGreaterThanOrEqual(1);
        expect(x).toBeLessThanOrEqual(23);
        expect(y).toBeGreaterThanOrEqual(1);
        expect(y).toBeLessThanOrEqual(23);
      }
    }
  });

  it('gives two icons with cut-outs on one screen their own mask', async () => {
    await render(
      createElement('View', null, createElement(Icon, { name: 'doc', color: '#000', variant: 'fill' }), createElement(Icon, { name: 'image', color: '#000', variant: 'fill' })),
    );
    const ids = JSON.stringify(screen.toJSON()).match(/"mask":"[^"]+"/g) ?? [];
    expect(new Set(ids).size).toBe(2);
  });

  it('negative control: the line variant of a glyph with cut-outs draws no mask', async () => {
    await render(createElement(Icon, { name: 'doc', color: '#000' }));
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/"mask":/);
  });
});

describe('icon-only controls', () => {
  function expectLabelled(button: ReturnType<typeof screen.getByTestId>) {
    expect(String(button.props.accessibilityLabel ?? '').trim()).not.toBe('');
  }

  it('labels every call control and shows the icon of its action', async () => {
    const { pill, more } = controlsFor({ phase: 'active', video: true, cameraOn: true, sharing: false, share: true, record: true, pip: true, wide: true });
    await render(
      createElement(CallPill, {
        actions: [...pill, ...more],
        state: { muted: true, cameraOn: true, speaker: false, sharing: false, recording: { on: false, busy: false } },
        onStage: true,
        vertical: false,
        shown: true,
        motion: {},
        onAction: () => undefined,
        onTouch: () => undefined,
      }),
    );
    const expected: Record<string, string> = {
      mute: 'micOff',
      camera: 'video',
      flip: 'cameraFlip',
      share: 'screenShare',
      record: 'record',
      speaker: 'speaker',
      people: 'people',
      pip: 'pip',
      more: 'more',
      hangup: 'phoneEnd',
    };
    for (const [action, icon] of Object.entries(expected)) {
      const button = screen.getByTestId(`call-${action}`);
      expectLabelled(button);
      expect(within(button).getByTestId(`icon-${icon}`, hidden)).toBeTruthy();
    }
  });

  it('labels the icon button and the header search button', async () => {
    await render(createElement(IconButton, { icon: 'back', label: 'Back', onPress: () => undefined, testID: 'back' }));
    expectLabelled(screen.getByTestId('back'));
    await render(createElement(HeaderActions));
    expectLabelled(screen.getByTestId('open-search'));
    expect(within(screen.getByTestId('open-search')).getByTestId('icon-search', hidden)).toBeTruthy();
  });

  it('hides the glyph itself from screen readers', async () => {
    await render(createElement(Icon, { name: 'mic', color: '#000' }));
    const svg = screen.getByTestId('icon-mic', hidden);
    expect(svg.props.importantForAccessibility ?? svg.props.accessibilityElementsHidden).toBeTruthy();
  });
});
