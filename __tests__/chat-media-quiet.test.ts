import { act, renderHook } from '@testing-library/react-native';
import { setMediaQuiet, setShownMessages, useOnScreen } from '../src/features/chat/ui/visible';

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: (_type: string, listener: (state: string) => void) => {
      (globalThis as { mockAppListener?: (state: string) => void }).mockAppListener = listener;
      return { remove: () => undefined };
    },
  },
}));

const appState = (state: string) => (globalThis as { mockAppListener?: (state: string) => void }).mockAppListener?.(state);

async function change(work: () => void) {
  await act(async () => work());
}

describe('which stickers and GIFs in the thread may play', () => {
  afterEach(async () => {
    await change(() => {
      setMediaQuiet(false);
      setShownMessages([]);
      appState('active');
    });
  });

  it('plays only bubbles on screen while the app is in front', async () => {
    const shown = await renderHook(() => useOnScreen(7));
    const hidden = await renderHook(() => useOnScreen(8));
    await change(() => setShownMessages([7]));
    expect(shown.result.current).toBe(true);
    expect(hidden.result.current).toBe(false);
    await change(() => appState('background'));
    expect(shown.result.current).toBe(false);
  });

  it('stops every animation while a voice note records and resumes after', async () => {
    const shown = await renderHook(() => useOnScreen(7));
    await change(() => setShownMessages([7]));
    await change(() => setMediaQuiet(true));
    expect(shown.result.current).toBe(false);
    await change(() => setMediaQuiet(false));
    expect(shown.result.current).toBe(true);
  });
});
