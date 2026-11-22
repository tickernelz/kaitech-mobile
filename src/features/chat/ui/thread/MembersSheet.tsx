import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { space, useTheme } from '../../../../theme';
import { Button } from '../../../../ui/Button';
import { Sheet, SheetItem } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import type { Person, Result } from '../../messageActions';
import { invitable, invite, membersOf, setRole, type Member } from '../../threadActions';
import { failureText } from '../actions/failure';
import { PersonChips, PersonSearch } from '../actions/PersonSearch';

const roles = ['owner', 'admin', 'member'] as const;

export function MembersSheet({ channelId, manages, canInvite, onClose, onNotice }: { channelId: number; manages: boolean; canInvite: boolean; onClose: () => void; onNotice: (text: string) => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const [result, setResult] = useState<Result<Member[]> | null>(null);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => void membersOf(channelId).then(setResult), [channelId]);
  useEffect(load, [load]);
  const changeRole = (member: Member) => {
    Alert.alert(member.name, t('members.roleTitle'), [
      ...roles.filter((role) => role !== member.role).map((role) => ({
        text: t(`members.role.${role}`),
        onPress: () =>
          void setRole(channelId, member.memberId, role).then((next) => {
            setError(next.ok ? null : failureText(t, next));
            if (next.ok) load();
          }),
      })),
      { text: t('act.cancel'), style: 'cancel' as const },
    ]);
  };
  if (inviting) return <InviteSheet channelId={channelId} onClose={() => setInviting(false)} onDone={(text) => { setInviting(false); onNotice(text); load(); }} />;
  return (
    <Sheet title={t('members.title')} onClose={onClose} testID="members-sheet">
      {canInvite ? <SheetItem icon="people" label={t('members.invite')} onPress={() => setInviting(true)} testID="members-invite" /> : null}
      {error ? (
        <Text variant="footnote" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {!result ? <ActivityIndicator color={colors.primary} style={styles.pad} /> : null}
      {result && !result.ok ? (
        <Text variant="callout" tone="danger">
          {failureText(t, result)}
        </Text>
      ) : null}
      {result?.ok
        ? result.value.map((member) => (
            <SheetItem
              key={member.memberId}
              label={member.name}
              detail={member.role !== 'member' ? t(`members.role.${member.role === 'owner' ? 'owner' : 'admin'}`) : undefined}
              onPress={manages ? () => changeRole(member) : undefined}
              testID={`member-${member.id}`}
            />
          ))
        : null}
    </Sheet>
  );
}

function InviteSheet({ channelId, onClose, onDone }: { channelId: number; onClose: () => void; onDone: (text: string) => void }) {
  const { t } = useTranslation('chat');
  const [picked, setPicked] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const search = useCallback((query: string) => invitable(channelId, query), [channelId]);
  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await invite(channelId, picked.map((person) => person.id));
    setBusy(false);
    if (result.ok) onDone(t('members.invited', { count: picked.length }));
    else setError(failureText(t, result));
  };
  return (
    <Sheet
      title={t('members.invite')}
      onClose={onClose}
      testID="invite-sheet"
      footer={
        <>
          {error ? (
            <Text variant="footnote" tone="danger">
              {error}
            </Text>
          ) : null}
          <Button label={t('members.inviteSend', { count: picked.length })} disabled={!picked.length} busy={busy} onPress={() => void submit()} testID="invite-send" />
        </>
      }>
      <PersonChips people={picked} onRemove={(person) => setPicked((current) => current.filter((item) => item.id !== person.id))} />
      <PersonSearch placeholder={t('members.inviteSearch')} search={search} exclude={picked.map((person) => person.id)} onPick={(person) => setPicked((current) => [...current, person])} testID="invite-search" />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.lg },
});
