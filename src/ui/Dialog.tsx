import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Modal, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { radius, space, useTheme } from '../theme';
import { answerDialog, useLayerOnTop, useOpenDialog, type DialogChoice, type OpenDialog } from './dialog';
import { Icon } from './icons';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { TextField } from './TextField';
import { UndoBar } from './UndoBar';

const shortLabel = 16;

export function DialogLayer({ root = false }: { root?: boolean }) {
  const top = useLayerOnTop();
  if (!top) return null;
  return (
    <>
      <UndoBar clearTabs={root} />
      <DialogHost />
    </>
  );
}

function DialogHost() {
  const dialog = useOpenDialog();
  return dialog ? <DialogView key={dialog.id} dialog={dialog} /> : null;
}

function DialogButton({ choice, disabled, onPress, stretch, testID }: { choice: DialogChoice; disabled: boolean; onPress: () => void; stretch: boolean; testID: string }) {
  const { colors } = useTheme();
  const tone = choice.tone ?? 'primary';
  const fill = { primary: colors.primary, danger: colors.dangerBand, cancel: colors.select, plain: colors.select }[tone];
  const ink = { primary: colors.onPrimary, danger: colors.dangerInk, cancel: colors.selectInk, plain: colors.selectInk }[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={choice.label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, stretch && styles.flex, { backgroundColor: fill, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
      testID={testID}>
      <Text variant="headline" style={[styles.buttonLabel, { color: ink }]}>
        {choice.label}
      </Text>
    </Pressable>
  );
}

function DialogView({ dialog }: { dialog: OpenDialog }) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const keyboard = useKeyboardState((state) => (state.isVisible ? state.height : 0));
  const [text, setText] = useState(dialog.input?.value ?? '');
  const heading = useRef<ComponentRef<typeof View>>(null);
  const id = dialog.testID ?? 'dialog';
  const primary = [...dialog.choices].reverse().find((choice) => choice.tone !== 'cancel' && choice.tone !== 'plain');
  const stacked = dialog.choices.length > 2 || dialog.choices.some((choice) => choice.label.length > shortLabel);
  const rank = (choice: DialogChoice) => (choice.tone === 'cancel' ? 2 : choice === primary ? 0 : 1);
  const choices = stacked ? [...dialog.choices].sort((a, b) => rank(a) - rank(b)) : dialog.choices;
  const blocked = (choice: DialogChoice) => !!dialog.input?.required && choice.tone !== 'cancel' && !text.trim();
  const dismiss = () => answerDialog(dialog.id, null);
  const pick = (choice: DialogChoice) => {
    if (!blocked(choice)) answerDialog(dialog.id, { key: choice.key, text });
  };

  useEffect(() => {
    const node = heading.current;
    if (node) AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
  }, []);

  const tint = dialog.danger ? { backgroundColor: colors.dangerBand, ink: colors.dangerInk } : { backgroundColor: colors.select, ink: colors.selectInk };
  const label = [dialog.title, dialog.body].filter(Boolean).join('. ');

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss} supportedOrientations={['portrait', 'landscape']} testID={`${id}-modal`}>
      <View style={[styles.scrim, { backgroundColor: colors.scrim, paddingBottom: keyboard }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessible={false}
          importantForAccessibility="no"
          testID={`${id}-backdrop`}
        />
        <View
          accessibilityViewIsModal
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line, maxHeight: (height - keyboard) * 0.9 }]}
          testID={id}>
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            {dialog.icon ? (
              <View style={[styles.icon, { backgroundColor: tint.backgroundColor }]}>
                <Icon name={dialog.icon} color={tint.ink} />
              </View>
            ) : null}
            <View ref={heading} accessible accessibilityRole={dialog.title ? 'header' : 'text'} accessibilityLabel={label || undefined} style={styles.texts}>
              {dialog.title ? (
                <Text variant="headline" testID={`${id}-title`}>
                  {dialog.title}
                </Text>
              ) : null}
              {dialog.body ? (
                <Text variant="body" tone={dialog.title ? 'inkSoft' : 'ink'} testID={`${id}-body`}>
                  {dialog.body}
                </Text>
              ) : null}
            </View>
            {dialog.input ? (
              <TextField
                label={dialog.input.label}
                value={text}
                onChangeText={setText}
                placeholder={dialog.input.placeholder}
                secureTextEntry={dialog.input.secure}
                multiline={dialog.input.multiline}
                autoFocus
                returnKeyType={dialog.input.multiline ? 'default' : 'done'}
                onSubmitEditing={dialog.input.multiline || !primary ? undefined : () => pick(primary)}
                testID={`${id}-input`}
              />
            ) : null}
          </ScrollView>
          <View style={[styles.actions, stacked ? styles.column : styles.row]}>
            {choices.map((choice) => (
              <DialogButton key={choice.key} choice={choice} disabled={blocked(choice)} onPress={() => pick(choice)} stretch={!stacked} testID={`${id}-${choice.key}`} />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { width: '100%', maxWidth: 420, borderRadius: radius.sheet, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  body: { paddingHorizontal: space.xl, paddingTop: space.xl, gap: space.lg },
  icon: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  texts: { gap: space.sm },
  actions: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.xl, gap: space.sm },
  row: { flexDirection: 'row' },
  column: { flexDirection: 'column' },
  button: { minHeight: 48, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm, alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { textAlign: 'center' },
});
