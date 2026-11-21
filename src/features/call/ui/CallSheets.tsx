import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSession } from '../../../auth/session';
import { space } from '../../../theme';
import { Button } from '../../../ui/Button';
import { Sheet, SheetItem } from '../../../ui/Sheet';
import { Text } from '../../../ui/Text';
import { TextField } from '../../../ui/TextField';
import { audioOutputs, chooseAudioOutput } from '../call';
import { inviteToCall, searchInvitees, type Invitee } from '../invite';

export function InviteSheet({ channelId, onClose }: { channelId: number; onClose: () => void }) {
  const { t } = useTranslation('call');
  const { active } = useSession();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Invitee[]>([]);
  const [picked, setPicked] = useState<Invitee[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active) return;
    let live = true;
    const timer = setTimeout(() => {
      searchInvitees(active, query.trim(), channelId)
        .then((rows) => live && setFound(rows))
        .catch(() => live && setFound([]));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [active, query, channelId]);

  const toggle = (person: Invitee) =>
    setPicked((current) => (current.some((item) => item.partnerId === person.partnerId) ? current.filter((item) => item.partnerId !== person.partnerId) : [...current, person]));

  const send = async () => {
    if (!active || !picked.length) return;
    setBusy(true);
    setFailed(false);
    try {
      await inviteToCall(active, channelId, picked.map((person) => person.partnerId));
      onClose();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <Sheet title={t('invite')} detail={t('inviteHint')} onClose={onClose} testID="call-invite">
      <TextField label={t('inviteSearch')} value={query} onChangeText={setQuery} autoCorrect={false} testID="call-invite-search" />
      {found.map((person) => {
        const on = picked.some((item) => item.partnerId === person.partnerId);
        return <SheetItem key={person.partnerId} icon={on ? 'check' : 'people'} label={person.name} onPress={() => toggle(person)} testID={`call-invite-${person.partnerId}`} />;
      })}
      {failed ? (
        <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite">
          {t('inviteFailed')}
        </Text>
      ) : null}
      <View style={styles.foot}>
        <Button label={t('inviteSend', { count: picked.length })} busy={busy} disabled={!picked.length} onPress={() => void send()} testID="call-invite-send" />
      </View>
    </Sheet>
  );
}

export function OutputSheet({ current, onClose }: { current: string | null; onClose: () => void }) {
  const { t } = useTranslation('call');
  const [outputs, setOutputs] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    void audioOutputs().then((list) => live && setOutputs(list));
    return () => {
      live = false;
    };
  }, []);
  return (
    <Sheet title={t('audioOutput')} onClose={onClose} testID="call-output">
      {(outputs ?? []).map((output) => (
        <SheetItem
          key={output}
          icon={output === current ? 'check' : 'speaker'}
          label={t(`output.${outputKey(output)}`, { name: output })}
          onPress={() => void chooseAudioOutput(output).then(onClose)}
          testID={`call-output-${output}`}
        />
      ))}
      {outputs && !outputs.length ? (
        <Text variant="footnote" tone="inkSoft">
          {t('outputNone')}
        </Text>
      ) : null}
    </Sheet>
  );
}

export function outputKey(output: string): 'speaker' | 'earpiece' | 'bluetooth' | 'headset' | 'other' {
  if (output === 'speaker' || output === 'force_speaker') return 'speaker';
  if (output === 'earpiece') return 'earpiece';
  if (output.toLowerCase().includes('bluetooth')) return 'bluetooth';
  if (output === 'headset' || output.toLowerCase().includes('wired')) return 'headset';
  return 'other';
}

const styles = StyleSheet.create({ foot: { paddingTop: space.sm } });
