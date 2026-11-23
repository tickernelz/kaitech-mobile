import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { invalidate, useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { Button } from '../../ui/Button';
import { Check, Row, Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { Card, StateView, useErrorText } from '../discovery/ui';
import { makeKey, mcpKeys, offeredProgrammes, revokeKey, type KeyShown } from './admin';
import { Scroll } from './assistParts';
import { SmallButton } from './parts';

export function McpKeysScreen() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const { active } = useSession();
  const keys = useResource('mom.admin.keys', mcpKeys);
  const [making, setMaking] = useState(false);
  const [shown, setShown] = useState<KeyShown | null>(null);
  const revoke = (id: number, name: string) =>
    Alert.alert(t('mom.admin.keys.revokeTitle'), name, [
      { text: t('mom.recorder.cancel'), style: 'cancel' },
      {
        text: t('mom.admin.keys.revoke'),
        style: 'destructive',
        onPress: () =>
          void (async () => {
            if (!active) return;
            try {
              await revokeKey(active, id);
              invalidate(`${active.id}:mom.admin.keys`);
            } catch (error) {
              Alert.alert('', errorText(error));
            }
          })(),
      },
    ]);
  if (shown) return <Shown shown={shown} onDone={() => setShown(null)} />;
  if (making) return <MakeKey onMade={(next) => {
          setMaking(false);
          setShown(next);
        }} onCancel={() => setMaking(false)} />;
  return (
    <Scroll refreshing={keys.loading} onRefresh={() => void keys.refresh()}>
      <Text tone="inkSoft">{t('mom.admin.keys.hint')}</Text>
      <Button label={t('mom.admin.keys.new')} onPress={() => setMaking(true)} testID="mcp-new" />
      {keys.data ? (
        <Section>
          {keys.data.length ? (
            keys.data.map((key) => (
              <Row
                key={key.id}
                title={key.name}
                detail={[`${key.keyIndex}…`, key.programmes.join(', '), key.createdAt].filter(Boolean).join('\n')}
                trailing={<SmallButton tone="dangerInk" label={t('mom.admin.keys.revoke')} onPress={() => revoke(key.id, key.name)} testID={`mcp-revoke-${key.id}`} />}
                testID={`mcp-key-${key.id}`}
              />
            ))
          ) : (
            <Row title={t('mom.admin.keys.none')} />
          )}
        </Section>
      ) : (
        <StateView loading={!keys.error} error={keys.error} onRetry={() => void keys.refresh()} testID="mcp-keys" />
      )}
    </Scroll>
  );
}

function MakeKey({ onMade, onCancel }: { onMade: (shown: KeyShown) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const { active } = useSession();
  const programmes = useResource('mom.admin.offered', offeredProgrammes);
  const [client, setClient] = useState('');
  const [chosen, setChosen] = useState<number[]>([]);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const toggle = (id: number) => setChosen((list) => (list.includes(id) ? list.filter((one) => one !== id) : [...list, id]));
  const make = async () => {
    if (!active || busy) return;
    setBusy(true);
    setProblem('');
    try {
      const shown = await makeKey(active, client, chosen, password);
      invalidate(`${active.id}:mom.admin.keys`);
      onMade(shown);
    } catch (error) {
      setProblem(errorText(error));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Scroll refreshing={false} onRefresh={() => void programmes.refresh()}>
      <TextField label={t('mom.admin.keys.client')} hint={t('mom.admin.keys.clientHint')} value={client} onChangeText={setClient} testID="mcp-client" />
      <Section title={t('mom.admin.keys.programmes', { count: chosen.length })}>
        {(programmes.data ?? []).map((one) => (
          <Row key={one.id} title={one.name} selected={chosen.includes(one.id)} trailing={<Check visible={chosen.includes(one.id)} />} onPress={() => toggle(one.id)} testID={`mcp-programme-${one.id}`} />
        ))}
      </Section>
      <TextField label={t('mom.removeScreen.password')} hint={t('mom.admin.keys.passwordHint')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" testID="mcp-password" />
      {problem ? (
        <Text tone="dangerInk" accessibilityRole="alert">
          {problem}
        </Text>
      ) : null}
      <Button label={t('mom.admin.keys.make')} disabled={!client.trim() || !chosen.length || !password} busy={busy} onPress={() => void make()} testID="mcp-make" />
      <Button kind="secondary" label={t('mom.recorder.cancel')} onPress={onCancel} />
    </Scroll>
  );
}

function Shown({ shown, onDone }: { shown: KeyShown; onDone: () => void }) {
  const { t } = useTranslation();
  const parts: [string, string][] = [
    ['key', shown.key],
    ['url', shown.url],
    ['header', shown.header],
    ['claudeDesktop', shown.claude_desktop],
    ['hermesEnv', shown.hermes_env],
    ['hermesConfig', shown.hermes_config],
  ];
  return (
    <Scroll refreshing={false} onRefresh={() => undefined}>
      <Text variant="headline">{t('mom.admin.keys.readyTitle')}</Text>
      <Text tone="warnInk">{t('mom.admin.keys.onlyOnce')}</Text>
      {parts
        .filter(([, value]) => value)
        .map(([name, value]) => (
          <Card key={name}>
            <Text variant="footnote" tone="inkSoft">
              {t(`mom.admin.keys.parts.${name}` as never)}
            </Text>
            <Text selectable>{value}</Text>
            <View>
              <SmallButton label={t('mom.admin.keys.copy')} onPress={() => void Clipboard.setStringAsync(value)} testID={`mcp-copy-${name}`} />
            </View>
          </Card>
        ))}
      <Button label={t('mom.admin.keys.done')} onPress={onDone} testID="mcp-done" />
    </Scroll>
  );
}
