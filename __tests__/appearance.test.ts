const mockStore = new Map<string, string>();
const mockBearer = jest.fn();

jest.mock('expo-sqlite/kv-store', () => ({
  getItemSync: (key: string) => mockStore.get(key) ?? null,
  setItemSync: (key: string, value: string) => mockStore.set(key, value),
  removeItemSync: (key: string) => mockStore.delete(key),
}));
const mockForget: ((id: string) => void)[] = [];
jest.mock('../src/auth/session', () => ({ onAccountForgotten: (listener: (id: string) => void) => mockForget.push(listener) }));
jest.mock('../src/api/odoo', () => ({ bearer: (...args: unknown[]) => mockBearer(...args) }));
jest.mock('../src/features/chat/api', () => ({ errorCode: (error: { code?: string }) => error.code ?? 'unknown' }));
jest.mock('../src/features/chat/chat', () => ({ chatClient: () => null, onRealtimeNotifications: () => () => undefined }));

const appearance = require('../src/features/appearance/appearance') as typeof import('../src/features/appearance/appearance');
const { fitWithin } = require('../src/features/media/shrink') as typeof import('../src/features/media/shrink');
const { sliderValue } = require('../src/ui/Slider') as typeof import('../src/ui/Slider');

const account = { id: 'A' } as never;

describe('appearanceFrom', () => {
  it('normalizes what the server sends and drops what the app cannot draw', () => {
    expect(
      appearance.appearanceFrom({
        theme: 'dark',
        background: { kind: 'color', value: '#1A2B3C' },
        conversations: { '12': { kind: 'preset', value: 'dusk' }, '13': { kind: 'device' }, x: { kind: 'default' }, '14': { kind: 'preset', value: '-bad' } },
      }),
    ).toEqual({ theme: 'dark', background: { kind: 'color', value: '#1a2b3c' }, conversations: { '12': { kind: 'preset', value: 'dusk' }, '13': { kind: 'device' } } });
    expect(appearance.appearanceFrom({ theme: 'sepia', background: { kind: 'color', value: 'red' } })).toEqual(appearance.defaultAppearance);
    expect(appearance.appearanceFrom(null)).toEqual(appearance.defaultAppearance);
  });
});

describe('backgroundFor and patched', () => {
  it('uses a conversation override first and drops it again on null', () => {
    const base = appearance.appearanceFrom({ background: { kind: 'preset', value: 'mist' }, conversations: { '12': { kind: 'color', value: '#000000' } } });
    expect(appearance.backgroundFor(base, 12)).toEqual({ background: { kind: 'color', value: '#000000' }, scope: 12 });
    expect(appearance.backgroundFor(base, 13)).toEqual({ background: { kind: 'preset', value: 'mist' }, scope: 'all' });
    const cleared = appearance.patched(base, { conversations: { '12': null }, theme: 'light' });
    expect(appearance.backgroundFor(cleared, 12).scope).toBe('all');
    expect(cleared.theme).toBe('light');
  });
});

describe('changeAppearance', () => {
  beforeEach(() => {
    mockStore.clear();
    mockBearer.mockReset();
    appearance.takeAppearance('A', null);
  });

  it('shows the change at once, sends only the changed part and keeps what the server answers', async () => {
    mockBearer.mockResolvedValue({ theme: 'dark', background: { kind: 'default' }, conversations: { '5': { kind: 'preset', value: 'ink' } } });
    const pending = appearance.changeAppearance(account, { theme: 'dark' });
    expect(appearance.appearanceOf('A').theme).toBe('dark');
    await expect(pending).resolves.toBeNull();
    expect(mockBearer).toHaveBeenCalledWith(account, '/kaitech_mobile/appearance', { method: 'POST', body: { theme: 'dark' } });
    expect(appearance.appearanceOf('A').conversations['5']).toEqual({ kind: 'preset', value: 'ink' });
    expect(JSON.parse(mockStore.get('appearance.A') ?? '{}').theme).toBe('dark');
  });

  it('writes nothing for an account that signed out while the answer was on its way', async () => {
    let answer: (value: unknown) => void = () => undefined;
    mockBearer.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const pending = appearance.changeAppearance(account, { theme: 'dark' });
    mockForget.forEach((listener) => listener('A'));
    answer({ theme: 'dark', background: { kind: 'default' }, conversations: {} });
    await pending;
    expect(mockStore.has('appearance.A')).toBe(false);
  });

  it('puts the previous look back when the server refuses', async () => {
    mockBearer.mockRejectedValue({ code: 'background_invalid' });
    await expect(appearance.changeAppearance(account, { background: { kind: 'color', value: '#123456' } })).resolves.toBe('background_invalid');
    expect(appearance.appearanceOf('A')).toEqual(appearance.defaultAppearance);
  });
});

describe('plainColors', () => {
  const linear = (value: number) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const lightness = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((at) => linear(parseInt(hex.slice(at, at + 2), 16) / 255));
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return 116 * (y > 216 / 24389 ? Math.cbrt(y) : ((24389 / 27) * y + 16) / 116) - 16;
  };

  it('keeps both bubbles apart from every colour in the light and the dark theme', () => {
    const { colorsFor } = require('../src/theme/tokens') as typeof import('../src/theme/tokens');
    const bubbles = (['light', 'dark'] as const).flatMap((scheme) => [colorsFor(scheme).surface, colorsFor(scheme).select]).map(lightness);
    for (const color of appearance.plainColors) {
      expect(Math.min(...bubbles.map((bubble) => Math.abs(bubble - lightness(color))))).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('fitWithin and sliderValue', () => {
  it('shrinks only images larger than the limit and keeps their shape', () => {
    expect(fitWithin(4000, 3000, 1024)).toEqual({ width: 1024, height: 768 });
    expect(fitWithin(800, 600, 1024)).toBeNull();
  });

  it('snaps a touch on the track to 5 percent steps inside the range', () => {
    expect(sliderValue(50, 200, 0.8)).toBeCloseTo(0.2);
    expect(sliderValue(-10, 200, 0.8)).toBe(0);
    expect(sliderValue(500, 200, 0.8)).toBeCloseTo(0.8);
  });
});
