import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    Easing: { bezier: () => () => 0 },
    useSharedValue: (value: number) => {
      let current = value;
      return { get: () => current, set: (next: number) => (current = next) };
    },
    useAnimatedStyle: (style: () => object) => style(),
    withSpring: (value: unknown) => value,
    interpolate: (value: number, input: number[], output: number[]) => output[0] + ((value - input[0]) / (input[1] - input[0])) * (output[1] - output[0]),
  };
});
jest.mock('@expo/ui/jetpack-compose/modifiers', () => ({
  testID: (tag: string) => ({ testID: tag }),
  semantics: (config: { contentDescription?: string }) => ({ description: config.contentDescription }),
}));
jest.mock('@expo/ui/jetpack-compose', () => {
  const { Pressable, View } = require('react-native');
  const Slot = ({ children }: { children: unknown }) => <View>{children}</View>;
  const FloatingActionButton = ({ children, onClick, modifiers }: { children: unknown; onClick: () => void; modifiers: { testID?: string; description?: string }[] }) => (
    <Pressable
      testID={modifiers.find((m) => m.testID)?.testID}
      accessibilityLabel={modifiers.find((m) => m.description)?.description}
      onPress={onClick}>
      {children}
    </Pressable>
  );
  FloatingActionButton.Icon = Slot;
  return { Host: Slot, RNHostView: Slot, FloatingActionButton };
});
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));

require('../src/i18n');
const { Button } = require('../src/ui/Button.android') as typeof import('../src/ui/Button.android');
const { TextField } = require('../src/ui/TextField.android') as typeof import('../src/ui/TextField.android');
const { Fab } = require('../src/ui/Fab.android') as typeof import('../src/ui/Fab.android');
const { Pressable: RipplePressable, stateLayerInk } = require('../src/ui/Pressable.android') as typeof import('../src/ui/Pressable.android');

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

describe('Android pressables', () => {
  test('every pressable gets the M3 ripple unless it chose its own', async () => {
    const drawn: Record<string, { props: { android_ripple?: unknown } }> = {};
    function Probe(props: Parameters<typeof RipplePressable>[0] & { name: string }) {
      const { name, ...rest } = props;
      drawn[name] = RipplePressable(rest) as { props: { android_ripple?: unknown } };
      return null;
    }
    await render(
      <>
        <Probe name="plain" onPress={() => undefined} />
        <Probe name="own" android_ripple={{ color: '#FF0000' }} onPress={() => undefined} />
      </>,
    );
    expect(drawn.plain.props.android_ripple).toEqual({ color: '#1514181A' });
    expect(drawn.own.props.android_ripple).toEqual({ color: '#FF0000' });
  });

  test('with the default ripple the pressed styling is dropped, so a press shows one state layer; a caller with its own ripple keeps it', async () => {
    const drawn: Record<string, { props: { style: (state: { pressed: boolean; hovered: boolean }) => unknown } }> = {};
    const tinted = ({ pressed }: { pressed: boolean }) => ({ backgroundColor: pressed ? 'grey' : 'white' });
    function Probe(props: Parameters<typeof RipplePressable>[0] & { name: string }) {
      const { name, ...rest } = props;
      drawn[name] = RipplePressable(rest) as (typeof drawn)[string];
      return null;
    }
    await render(
      <>
        <Probe name="plain" style={tinted} onPress={() => undefined} />
        <Probe name="own" style={tinted} android_ripple={{ color: '#FF0000' }} onPress={() => undefined} />
      </>,
    );
    expect(drawn.plain.props.style({ pressed: true, hovered: false })).toEqual({ backgroundColor: 'white' });
    expect(drawn.own.props.style({ pressed: true, hovered: false })).toEqual({ backgroundColor: 'grey' });
  });
});

describe('Android state layer colour', () => {
  test('the pressed layer takes the content colour of its container, as M3 asks', () => {
    expect(stateLayerInk('#441D65', '#151418')).toBe('#F1F0F3');
    expect(stateLayerInk('#B91C1E', '#151418')).toBe('#F1F0F3');
    expect(stateLayerInk('#FFFFFF', '#F1F0F3')).toBe('#151418');
    expect(stateLayerInk('#EDE7F5', '#F1F0F3')).toBe('#151418');
  });

  test('no container, a see-through one or a named colour keeps the theme colour', () => {
    expect(stateLayerInk(undefined, '#151418')).toBe('#151418');
    expect(stateLayerInk('transparent', '#151418')).toBe('#151418');
    expect(stateLayerInk('#00000040', '#151418')).toBe('#151418');
  });

  test('a filled button gets a light ripple on its resting colour', async () => {
    const drawn: Record<string, { props: { android_ripple?: { color: string } } }> = {};
    function Probe(props: Parameters<typeof RipplePressable>[0] & { name: string }) {
      const { name, ...rest } = props;
      drawn[name] = RipplePressable(rest) as (typeof drawn)[string];
      return null;
    }
    await render(
      <>
        <Probe name="filled" style={({ pressed }) => ({ backgroundColor: pressed ? '#2F1447' : '#441D65' })} onPress={() => undefined} />
        <Probe name="plain" style={{ padding: 4 }} onPress={() => undefined} />
      </>,
    );
    expect(drawn.filled.props.android_ripple).toEqual({ color: '#F1F0F31A' });
    expect(drawn.plain.props.android_ripple).toEqual({ color: '#1514181A' });
  });
});

describe('Android Material 3 floating action button', () => {
  test('keeps its Maestro id and spoken label and runs the action', async () => {
    const onPress = jest.fn();
    await render(<Fab icon="edit" label="New chat" onPress={onPress} testID="chat-new" />);
    const fab = screen.getByTestId('chat-new');
    expect(fab.props.accessibilityLabel).toBe('New chat');
    await act(async () => fireEvent.press(fab));
    expect(onPress).toHaveBeenCalledTimes(1);
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
