import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    Easing: { bezier: () => () => 0 },
    useReducedMotion: () => true,
    useSharedValue: (value: number) => {
      let current = value;
      return { get: () => current, set: (next: number) => (current = next) };
    },
    useAnimatedStyle: (style: () => object) => style(),
    withSpring: (value: unknown) => value,
    interpolate: (value: number, input: number[], output: number[]) => output[0] + ((value - input[0]) / (input[1] - input[0])) * (output[1] - output[0]),
  };
});
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));

require('../src/i18n');
const { Button } = require('../src/ui/Button.android') as typeof import('../src/ui/Button.android');
const { TextField } = require('../src/ui/TextField.android') as typeof import('../src/ui/TextField.android');

function labelLift(text: string): number {
  let node = screen.getByText(text).parent;
  while (node) {
    const style = StyleSheet.flatten(node.props.style) as { transform?: { translateY?: number }[] } | undefined;
    const lift = style?.transform?.find((step) => step.translateY !== undefined)?.translateY;
    if (lift !== undefined) return lift;
    node = node.parent;
  }
  return NaN;
}

describe('Android Material 3 button', () => {
  test('a press reaches the handler once and the press callbacks still run', async () => {
    const onPress = jest.fn();
    const onPressIn = jest.fn();
    await render(<Button label="Save" onPress={onPress} onPressIn={onPressIn} testID="save" />);
    await act(async () => fireEvent(screen.getByTestId('save'), 'pressIn'));
    await act(async () => fireEvent.press(screen.getByTestId('save')));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPressIn).toHaveBeenCalledTimes(1);
  });

  test('busy shows progress, announces it and ignores presses', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" busy onPress={onPress} testID="save" />);
    const button = screen.getByTestId('save');
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(screen.queryByText('Save')).toBeNull();
    await act(async () => fireEvent.press(button));
    expect(onPress).not.toHaveBeenCalled();
  });

  test('disabled ignores presses', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" disabled onPress={onPress} testID="save" />);
    await act(async () => fireEvent.press(screen.getByTestId('save')));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Android Material 3 outlined text field', () => {
  test('an empty field keeps its label inside; focus floats it onto the outline', async () => {
    await render(<TextField label="Name" value="" onChangeText={() => undefined} testID="name" />);
    const resting = labelLift('Name');
    expect(resting).toBeGreaterThan(0);
    await act(async () => fireEvent(screen.getByTestId('name'), 'focus'));
    expect(labelLift('Name')).toBeLessThan(0);
    await act(async () => fireEvent(screen.getByTestId('name'), 'blur'));
    expect(labelLift('Name')).toBe(resting);
  });

  test('a value or a placeholder keeps the label off the text', async () => {
    await render(<TextField label="Name" value="Ops" onChangeText={() => undefined} />);
    expect(labelLift('Name')).toBeLessThan(0);
    await render(<TextField label="Server" placeholder="lab0.kaitech.io" />);
    expect(labelLift('Server')).toBeLessThan(0);
  });

  test('typing into an uncontrolled field floats the label, clearing it lets it rest again', async () => {
    await render(<TextField label="Note" testID="note" />);
    await act(async () => fireEvent.changeText(screen.getByTestId('note'), 'hi'));
    expect(labelLift('Note')).toBeLessThan(0);
    await act(async () => fireEvent.changeText(screen.getByTestId('note'), ''));
    expect(labelLift('Note')).toBeGreaterThan(0);
  });

  test('an error replaces the hint and is announced', async () => {
    await render(<TextField label="Name" hint="Shown to the team" error="Name taken" value="x" testID="name" />);
    expect(screen.getByTestId('name-error').props.accessibilityRole).toBe('alert');
    expect(screen.queryByText('Shown to the team')).toBeNull();
  });
});
