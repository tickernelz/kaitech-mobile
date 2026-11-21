import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { ErrorCode } from '../auth/errors';
import { completeSignIn, defaultServer, takeStashedCallback } from '../auth/signIn';
import { useSignIn } from '../auth/useSignIn';
import { space } from '../theme';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';
import { TextField, type TextFieldRef } from '../ui/TextField';

const serverErrors: ErrorCode[] = ['serverRequired', 'serverInvalid', 'serverInsecure'];
const databaseErrors: ErrorCode[] = ['databaseInvalid'];

export function SignInForm({ onDone, onBack, custom = false }: { onDone: () => void; onBack: () => void; custom?: boolean }) {
  const { t } = useTranslation();
  const [preset] = useState(defaultServer);
  const [other, setOther] = useState(custom || preset === null);
  const [server, setServer] = useState('');
  const [database, setDatabase] = useState('');
  const [stashed] = useState(takeStashedCallback);
  const { busy, error, setError, run, start } = useSignIn(onDone, stashed !== null);
  const databaseRef = useRef<TextFieldRef>(null);

  useEffect(() => {
    if (stashed) void run(() => completeSignIn(stashed));
  }, [stashed, run]);

  const submit = () => void (other || !preset ? start(server, database) : start(preset.server, preset.database));
  const backToDefault = () => {
    setOther(false);
    setError(null);
  };
  const shown = (codes: ErrorCode[]) => (error && codes.includes(error) ? t(`errors.${error}`) : null);
  const formError = error && !serverErrors.includes(error) && !databaseErrors.includes(error) ? t(`errors.${error}`) : null;
  const edit = (set: (next: string) => void) => (next: string) => {
    set(next);
    if (error) setError(null);
  };

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
            onPress={submit}
            testID="sign-in-continue"
          />
          {preset && other ? (
            <Button
              kind="plain"
              label={t('signIn.useDefault', { server: preset.server })}
              onPress={backToDefault}
              disabled={busy}
              testID="sign-in-use-default"
            />
          ) : null}
          {preset && !other ? (
            <Button kind="plain" label={t('signIn.otherServer')} onPress={() => setOther(true)} disabled={busy} testID="sign-in-other-server" />
          ) : null}
          <Button kind="plain" label={t('signIn.back')} onPress={onBack} disabled={busy} testID="sign-in-back" />
        </View>
      }>
      <Text variant="title" accessibilityRole="header" testID="sign-in-title">
        {t('signIn.title')}
      </Text>
      {other || !preset ? (
        <>
          <Text tone="inkSoft">{t('signIn.body')}</Text>
          <TextField
            label={t('signIn.serverLabel')}
            placeholder={t('signIn.serverPlaceholder')}
            value={server}
            onChangeText={edit(setServer)}
            error={shown(serverErrors)}
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
            onChangeText={edit(setDatabase)}
            error={shown(databaseErrors)}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!busy}
            testID="sign-in-database"
          />
        </>
      ) : (
        <Text tone="inkSoft" testID="sign-in-default">
          {t('signIn.defaultBody', { server: preset.server })}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: space.sm },
});
