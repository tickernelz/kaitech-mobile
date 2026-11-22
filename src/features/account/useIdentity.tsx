import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ApiError } from '../../api/odoo';
import { useSession } from '../../auth/session';
import { space } from '../../theme';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { useErrorText } from '../discovery/ui';
import { confirmIdentity, identityOf, type Step } from './security';

type Pending = { checkId: number; resume: (result: unknown) => void; cancel: () => void };

export function useIdentity() {
  const [pending, setPending] = useState<Pending | null>(null);
  const run = useCallback(<T,>(start: () => Promise<Step<T>>, after: (result: unknown) => Promise<T> | T): Promise<T | null> => {
    return start().then(
      (step) =>
        step.kind === 'done'
          ? step.value
          : new Promise<T | null>((resolve, reject) =>
              setPending({
                checkId: step.checkId,
                resume: (result) => {
                  setPending(null);
                  Promise.resolve(after(result)).then(resolve, reject);
                },
                cancel: () => {
                  setPending(null);
                  resolve(null);
                },
              }),
            ),
    );
  }, []);
  const sheet = pending ? <IdentitySheet pending={pending} /> : null;
  return { run, sheet };
}

function IdentitySheet({ pending }: { pending: Pending }) {
  const { t } = useTranslation();
  const { active } = useSession();
  const errorText = useErrorText();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const checkId = useRef(pending.checkId);
  const confirm = async () => {
    if (!active || busy || !password) return;
    setBusy(true);
    setFailed(null);
    try {
      const result = await confirmIdentity(active, checkId.current, password);
      const again = identityOf(result);
      if (again !== null) {
        checkId.current = again;
        setFailed(t('security.identity.wrong'));
        setBusy(false);
        return;
      }
      pending.resume(result);
    } catch (error) {
      setFailed(error instanceof ApiError && error.code === 'refused' ? t('security.identity.wrong') : errorText(error));
      setBusy(false);
    }
  };
  return (
    <Sheet title={t('security.identity.title')} detail={t('security.identity.body')} onClose={pending.cancel} testID="identity-sheet">
      <View style={styles.body}>
        <TextField
          label={t('security.identity.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          autoFocus
          onSubmitEditing={() => void confirm()}
          testID="identity-password"
        />
        {failed ? (
          <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite" testID="identity-error">
            {failed}
          </Text>
        ) : null}
        <Button label={t('security.identity.confirm')} busy={busy} disabled={!password} onPress={() => void confirm()} testID="identity-confirm" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({ body: { gap: space.md, paddingHorizontal: space.xs } });
