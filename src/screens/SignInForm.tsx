import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { errorCodeOf, type ErrorCode } from '../auth/errors';
import { completeSignIn, signIn, takeStashedCallback } from '../auth/signIn';
import { useLanguage } from '../i18n';
import { space } from '../theme';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';
import { TextField, type TextFieldRef } from '../ui/TextField';

const fieldErrors: ErrorCode[] = ['serverRequired', 'serverInvalid', 'serverInsecure'];

export function SignInForm({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [server, setServer] = useState('');
  const [database, setDatabase] = useState('');
  const [stashed] = useState(takeStashedCallback);
  const [busy, setBusy] = useState(stashed !== null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const databaseRef = useRef<TextFieldRef>(null);

  const run = useCallback(
    async (attempt: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await attempt();
        onDone();
      } catch (caught) {
        setError(errorCodeOf(caught));
      } finally {
        setBusy(false);
      }
    },
    [onDone],
  );

  useEffect(() => {
    if (!stashed) return;
    completeSignIn(stashed)
      .then(onDone)
      .catch((caught: unknown) => setError(errorCodeOf(caught)))
      .finally(() => setBusy(false));
  }, [stashed, onDone]);

  const fieldError = error && fieldErrors.includes(error) ? t(`errors.${error}`) : null;
  const formError = error && !fieldErrors.includes(error) ? t(`errors.${error}`) : null;

  return (
    <Screen
      scroll
      testID="sign-in"
      footer={
        <View style={styles.footer}>
          {formError ? (
            <Text tone="dangerInk" accessibilityRole="alert" accessibilityLiveRegion="polite" testID="sign-in-error">
              {formError}
            </Text>
          ) : null}
          <Button
            label={busy ? t('signIn.finishing') : t('signIn.continue')}
            accessibilityHint={t('signIn.continueHint')}
            busy={busy}
            onPress={() => void run(() => signIn(server, database, language))}
            testID="sign-in-continue"
          />
          <Button kind="plain" label={t('signIn.back')} onPress={onBack} disabled={busy} />
        </View>
      }>
      <Text variant="title" accessibilityRole="header">
        {t('signIn.title')}
      </Text>
      <Text tone="inkSoft">{t('signIn.body')}</Text>
      <TextField
        label={t('signIn.serverLabel')}
        placeholder={t('signIn.serverPlaceholder')}
        value={server}
        onChangeText={(next) => {
          setServer(next);
          if (error) setError(null);
        }}
        error={fieldError}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="url"
        keyboardType="url"
        textContentType="URL"
        returnKeyType="next"
        onSubmitEditing={() => databaseRef.current?.focus()}
        editable={!busy}
        testID="sign-in-server"
      />
      <TextField
        ref={databaseRef}
        label={t('signIn.databaseLabel')}
        hint={t('signIn.databaseHint')}
        value={database}
        onChangeText={setDatabase}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={() => void run(() => signIn(server, database, language))}
        editable={!busy}
        testID="sign-in-database"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: space.sm },
});
