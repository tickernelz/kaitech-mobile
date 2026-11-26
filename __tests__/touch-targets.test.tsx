import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));

const { ToggleRow } = require('../src/ui/List') as typeof import('../src/ui/List');
const { reach, shortfall, touchTarget } = require('../src/ui/touch') as typeof import('../src/ui/touch');
const { wrappableName } = require('../src/features/chat/media/kind') as typeof import('../src/features/chat/media/kind');

describe('a settings switch row', () => {
  test('a tap anywhere on the row flips the switch', async () => {
    const onChange = jest.fn();
    await render(<ToggleRow title="Tap to record" detail="Hold is the default" value={false} onChange={onChange} testID="tap-to-record" />);
    await act(async () => fireEvent.press(screen.getByText('Tap to record')));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('a tap on a row that is on turns it off', async () => {
    const onChange = jest.fn();
    await render(<ToggleRow title="Picture in picture" value onChange={onChange} testID="pip" />);
    await act(async () => fireEvent.press(screen.getByTestId('pip')));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  test('a disabled row ignores the tap', async () => {
    const onChange = jest.fn();
    await render(<ToggleRow title="Daily summary" value={false} onChange={onChange} disabled testID="daily" />);
    await act(async () => fireEvent.press(screen.getByTestId('daily')));
    expect(onChange).not.toHaveBeenCalled();
  });

  test('screen readers hear one switch with its title, hint and state', async () => {
    await render(<ToggleRow title="Out of office" detail="Replies for you" value onChange={() => undefined} testID="away" />);
    const row = screen.getByTestId('away');
    expect(row.props.accessibilityRole).toBe('switch');
    expect(row.props.accessibilityLabel).toBe('Out of office');
    expect(row.props.accessibilityHint).toBe('Replies for you');
    expect(row.props.accessibilityState).toEqual({ checked: true, disabled: false });
    expect(screen.getByRole('switch', { name: 'Out of office' })).toBe(row);
  });
});

describe('touch reach', () => {
  test('a control shorter than 44 dp is reached evenly on both sides', () => {
    expect(shortfall(36)).toBe(4);
    expect(reach(32, 36)).toEqual({ top: 6, bottom: 6, left: 4, right: 4 });
    expect(32 + 2 * shortfall(32)).toBeGreaterThanOrEqual(touchTarget);
    expect(27 + 2 * shortfall(27)).toBeGreaterThanOrEqual(touchTarget);
  });

  test('a control already 44 dp or larger gets no extra reach', () => {
    expect(reach(44)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    expect(reach(60, 120)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });
});

describe('a long file name on a file card', () => {
  test('may wrap after its separators instead of inside a word', () => {
    expect(wrappableName('Laporan_Keuangan-Q3.2026.pdf')).toBe('Laporan_\u200BKeuangan-\u200BQ3.\u200B2026.\u200Bpdf');
  });

  test('keeps a name without separators, a trailing separator and an empty name as they are', () => {
    expect(wrappableName('notes')).toBe('notes');
    expect(wrappableName('draft_')).toBe('draft_');
    expect(wrappableName('')).toBe('');
  });
});
