import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { Pressable } from '../../../ui/Pressable';
import { radius, space, stroke, useTheme } from '../../../theme';
import { Icon } from '../../../ui/icons';
import { Text } from '../../../ui/Text';
import { useThread } from './place';
import { isDate, type FormBlock, type FormField, type RepliesBlock } from './read';
import { BlockTitle, styles as shared } from './ui';
import { touchTarget } from '../../../ui/touch';
import { choiceLook } from '../../../ui/pill';

function Choice({ label, on, onPress, testID, multiple }: { label: string; on: boolean; onPress: () => void; testID?: string; multiple: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: on }}
      onPress={onPress}
      testID={testID}
      style={[styles.choice, { borderColor: on ? colors.primary : colors.line, backgroundColor: on ? colors.select : colors.surface }]}>
      {on ? <Icon name="check" size={14} color={colors.selectInk} /> : null}
      <Text variant="footnote" tone={on ? 'selectInk' : 'ink'}>
        {label}
      </Text>
    </Pressable>
  );
}

export const KtReplies = memo(function KtReplies({ block }: { block: RepliesBlock }) {
  const { colors } = useTheme();
  const { onReply } = useThread();
  const [said, setSaid] = useState<string | null>(null);
  return (
    <View style={shared.gap} testID="kt-replies">
      <BlockTitle title={block.title} />
      <View style={styles.replies} accessibilityRole="none" accessibilityLabel={block.summary || undefined}>
        {block.replies.map((reply, index) => {
          const chosen = said === reply;
          const disabled = !onReply || said !== null;
          return (
            <Pressable
              key={reply}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected: chosen }}
              disabled={disabled}
              onPress={() => {
                setSaid(reply);
                onReply?.(reply);
              }}
              testID={`kt-reply-${index}`}
              style={({ pressed }) => [
                styles.reply,
                choiceLook(chosen, colors, { fill: pressed ? colors.surface2 : colors.surface, paddingHorizontal: space.lg, paddingVertical: space.sm }),
                { opacity: disabled && !chosen ? 0.5 : 1 },
              ]}>
              <Text variant="callout" style={{ color: chosen ? colors.selectInk : colors.ink }}>
                {reply}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

function startOf(field: FormField): string | string[] {
  if (field.kind === 'people') {
    const value = Array.isArray(field.value) ? field.value : [];
    return field.choices.length ? [...value] : value.join(', ');
  }
  return typeof field.value === 'string' ? field.value : '';
}

function answerOf(field: FormField, value: string | string[]): string {
  if (field.kind === 'people') {
    const people = Array.isArray(value) ? value : value.split(',').map((one) => one.trim());
    return people.filter(Boolean).join(', ');
  }
  return String(value ?? '').trim();
}

export function formMessage(block: FormBlock, values: Record<string, string | string[]>): string {
  const lines = block.fields
    .map((field) => [field.label, answerOf(field, values[field.name])] as const)
    .filter(([, answer]) => answer)
    .map(([label, answer]) => '- ' + label + ': ' + answer);
  return [block.title || block.submitLabel, ...lines].join('\n');
}

export const KtForm = memo(function KtForm({ block }: { block: FormBlock }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { onReply } = useThread();
  const [values, setValues] = useState<Record<string, string | string[]>>(() => Object.fromEntries(block.fields.map((field) => [field.name, startOf(field)])));
  const [missing, setMissing] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const set = (name: string, value: string | string[]) => setValues({ ...values, [name]: value });
  const submit = () => {
    const wrong = block.fields
      .filter((field) => {
        const answer = answerOf(field, values[field.name]);
        return (field.required && !answer) || (field.kind === 'date' && answer !== '' && !isDate(answer));
      })
      .map((field) => field.name);
    setMissing(wrong);
    if (wrong.length || !onReply) return;
    onReply(formMessage(block, values));
    setSent(true);
  };
  return (
    <View style={shared.gap} testID="kt-form">
      <BlockTitle title={block.title} />
      {block.fields.map((field) => {
        const value = values[field.name];
        const wrong = missing.includes(field.name);
        const label = field.label + (field.required ? ' *' : '');
        return (
          <View key={field.name} style={styles.field}>
            <Text variant="footnote" tone="inkSoft" nativeID={`kt-form-${field.name}`}>
              {label}
            </Text>
            {field.kind === 'choice' || (field.kind === 'people' && field.choices.length) ? (
              <View style={styles.choices} accessibilityLabel={field.label}>
                {field.choices.map((choice) => {
                  const multiple = field.kind === 'people';
                  const on = multiple ? (value as string[]).includes(choice) : value === choice;
                  return (
                    <Choice
                      key={choice}
                      label={choice}
                      on={on}
                      multiple={multiple}
                      testID={`kt-form-${field.name}-${choice}`}
                      onPress={() =>
                        set(field.name, multiple ? (on ? (value as string[]).filter((one) => one !== choice) : [...(value as string[]), choice]) : on ? '' : choice)
                      }
                    />
                  );
                })}
              </View>
            ) : (
              <TextInput
                value={value as string}
                onChangeText={(text) => set(field.name, text)}
                editable={!sent}
                accessibilityLabel={field.label}
                accessibilityLabelledBy={`kt-form-${field.name}`}
                placeholder={field.kind === 'date' ? t('discovery.block.form.datePlaceholder') : field.kind === 'people' ? t('discovery.block.form.peoplePlaceholder') : undefined}
                placeholderTextColor={colors.inkFaint}
                keyboardType={field.kind === 'date' ? 'numbers-and-punctuation' : 'default'}
                maxLength={field.kind === 'date' ? 10 : 400}
                multiline={field.kind === 'text'}
                testID={`kt-form-${field.name}`}
                style={[styles.input, { color: colors.ink, borderColor: wrong ? colors.danger : colors.line, backgroundColor: colors.surface }]}
              />
            )}
            {wrong ? (
              <Text variant="label" tone="dangerInk">
                {field.kind === 'date' && answerOf(field, value) ? t('discovery.block.form.badDate') : t('discovery.block.form.missing')}
              </Text>
            ) : null}
          </View>
        );
      })}
      <View style={styles.foot}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !onReply || sent }}
          disabled={!onReply || sent}
          onPress={submit}
          testID="kt-form-send"
          style={({ pressed }) => [styles.send, { backgroundColor: pressed ? colors.primaryPressed : colors.primary, opacity: !onReply || sent ? 0.5 : pressed && Platform.OS === 'ios' ? 0.8 : 1 }]}>
          <Icon name="send" size={16} color={colors.onPrimary} variant="fill" />
          <Text variant="callout" style={[styles.bold, { color: colors.onPrimary }]}>
            {block.submitLabel}
          </Text>
        </Pressable>
        {sent ? (
          <Text variant="footnote" tone="inkSoft" accessibilityLiveRegion="polite">
            {t('discovery.block.form.sent')}
          </Text>
        ) : null}
      </View>
      <Text variant="label" tone="inkSoft">
        {t('discovery.block.form.note')}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  replies: { gap: space.sm },
  reply: { minHeight: 44, borderRadius: radius.field, borderWidth: stroke.thin, paddingHorizontal: space.lg, paddingVertical: space.sm, justifyContent: 'center' },
  field: { gap: space.xs },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  choice: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.xs, borderWidth: stroke.thin, borderRadius: radius.pill, paddingHorizontal: space.md },
  input: { minHeight: 44, borderWidth: stroke.thin, borderRadius: radius.field, paddingHorizontal: space.md, paddingVertical: space.sm, fontSize: 16 },
  foot: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.md },
  send: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.pill, paddingHorizontal: space.lg },
  bold: { fontWeight: '700' },
});
