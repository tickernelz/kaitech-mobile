import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Modal } from './Modal';
import { Pressable } from './Pressable';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '../theme';
import { Button } from './Button';
import { NativeSheet, useSheetPresentation } from './NativeSheet';
import { Text } from './Text';
import { TextField } from './TextField';

export type FormField = { key: string; label: string; initial?: string; secret?: boolean };

export function FormSheet({
  title,
  lines = [],
  fields,
  submit,
  danger,
  onSubmit,
  onClose,
  testID,
}: {
  title: string;
  lines?: string[];
  fields: FormField[];
  submit: string;
  danger?: boolean;
  onSubmit: (values: Record<string, string>) => Promise<string | null>;
  onClose: () => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.key, field.initial ?? ''])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheet = useSheetPresentation(onClose);
  const ready = fields.every((field) => values[field.key].trim());
  const send = async () => {
    setBusy(true);
    setError(null);
    const failure = await onSubmit(values);
    setBusy(false);
    if (failure) setError(failure);
    else sheet.close();
  };
  const form = (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text variant="headline" accessibilityRole="header">
        {title}
      </Text>
      {lines.map((line, index) => (
        <Text key={index} variant="callout" tone="inkSoft">
          {line}
        </Text>
      ))}
      {fields.map((field, index) => (
        <TextField
          key={field.key}
          label={field.label}
          value={values[field.key]}
          onChangeText={(text) => setValues((current) => ({ ...current, [field.key]: text }))}
          secureTextEntry={field.secret}
          autoCapitalize={field.secret ? 'none' : 'sentences'}
          autoFocus={index === 0}
          testID={`${testID}-${field.key}`}
        />
      ))}
      {error ? (
        <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite" testID={`${testID}-error`}>
          {error}
        </Text>
      ) : null}
      <View style={styles.buttons}>
        <Button kind="plain" label={t('row.cancel')} onPress={() => sheet.close()} style={styles.flex} testID={`${testID}-cancel`} />
        <Button
          kind={danger ? 'danger' : 'primary'}
          label={submit}
          busy={busy}
          disabled={!ready}
          onPress={() => void send()}
          style={styles.flex}
          testID={`${testID}-submit`}
        />
      </View>
    </ScrollView>
  );
  if (sheet.native) {
    return (
      <NativeSheet presentation={sheet.presentation} testID={testID}>
        <View style={styles.native}>{form}</View>
      </NativeSheet>
    );
  }
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('row.close')}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.lg) }]}
            onPress={() => undefined}
            accessibilityViewIsModal
            testID={testID}>
            {form}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '90%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space.lg, paddingHorizontal: space.lg },
  native: { paddingHorizontal: space.lg },
  body: { gap: space.md, paddingBottom: space.sm },
  buttons: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
});
