import Storage from 'expo-sqlite/kv-store';
import { useCallback, useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, View, type TextInput, type TextInputSelectionChangeEvent, type TextStyle } from 'react-native';
import { Pressable } from '../../../ui/Pressable';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { radius, space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { Icon } from '../../../ui/icons';
import { applyMarkup, markups, type Markup, type Selection } from '../markup';

const hiddenKey = 'chat.formatBar.hidden';

export function useMarkup(text: string, setText: (next: string) => void, input: RefObject<ComponentRef<typeof TextInput> | null>) {
  const [selection, setSelection] = useState<Selection>({ start: text.length, end: text.length });
  const [focused, setFocused] = useState(false);
  const keyboard = useKeyboardState((state) => state.isVisible);
  const [hidden, setHiddenState] = useState(() => Storage.getItemSync(hiddenKey) === '1');
  const pending = useRef<Selection | null>(null);

  useEffect(() => {
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    input.current?.setSelection(next.start, next.end);
  }, [text, input]);

  const apply = (markup: Markup) => {
    const edit = applyMarkup(text, selection, markup);
    pending.current = edit.selection;
    setSelection(edit.selection);
    setText(edit.text);
  };
  const setHidden = useCallback((value: boolean) => {
    setHiddenState(value);
    Storage.setItemSync(hiddenKey, value ? '1' : '0');
  }, []);
  const selected = selection.end > selection.start;
  return {
    selection,
    apply,
    showBar: focused && keyboard && (!hidden || selected),
    showToggle: focused && keyboard && hidden && !selected,
    hide: () => setHidden(true),
    show: () => setHidden(false),
    inputProps: {
      onSelectionChange: (event: TextInputSelectionChangeEvent) => setSelection(event.nativeEvent.selection),
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
  };
}

const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

export function FormatBar({ onApply, onHide }: { onApply: (markup: Markup) => void; onHide: () => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const look: Record<Markup, TextStyle | null> = {
    bold: styles.bold,
    italic: styles.italic,
    code: styles.code,
    link: { color: colors.link, textDecorationLine: 'underline' },
    quote: null,
    list: null,
  };
  return (
    <View style={[styles.bar, { borderColor: colors.line, backgroundColor: colors.surface }]} testID="format-bar">
      <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions} style={styles.flex}>
        {markups.map((markup) => (
          <Pressable
            key={markup}
            accessibilityRole="button"
            accessibilityLabel={t(`composer.format.${markup}`)}
            onPress={() => onApply(markup)}
            testID={`format-${markup}`}
            style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surface2 }]}>
            <Text variant="callout" style={look[markup]}>
              {t(`composer.format.${markup}`)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('composer.format.hide')}
        onPress={onHide}
        hitSlop={4}
        testID="format-hide"
        style={({ pressed }) => [styles.hide, pressed && { backgroundColor: colors.surface2 }]}>
        <Icon name="chevronDown" size={20} color={colors.inkSoft} />
      </Pressable>
    </View>
  );
}

export function FormatToggle({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation('chat');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('composer.format.show')}
      onPress={onPress}
      hitSlop={4}
      testID="format-show"
      style={({ pressed }) => [styles.toggle, { opacity: pressed ? 0.7 : 1 }]}>
      <Text variant="callout" tone="inkSoft" style={styles.bold}>
        {t('composer.format.glyph')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, minHeight: 44, marginTop: space.xs },
  actions: { alignItems: 'center', paddingHorizontal: space.xs, gap: 2 },
  action: { minHeight: 44, minWidth: 44, paddingHorizontal: space.md, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  hide: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  toggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: mono },
});
