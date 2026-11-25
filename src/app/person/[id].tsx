import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { Avatar } from '../../features/chat/ui/Avatar';
import { idParam } from '../../features/discovery/params';
import { StateView, useErrorText } from '../../features/discovery/ui';
import { chatWith, personCard, type Presence } from '../../features/people/card';
import { RowIcon, SettingsPage } from '../../screens/SettingsPage';
import { radius, space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { DialogLayer } from '../../ui/Dialog';
import { Row, Section } from '../../ui/List';
import { Text } from '../../ui/Text';

export default function PersonRoute() {
  return (
    <>
      <PersonScreen />
      <DialogLayer />
    </>
  );
}

function PersonScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { active } = useSession();
  const errorText = useErrorText();
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const partnerId = idParam(params.id);
  const card = useResource(partnerId ? `person.${partnerId}` : null, (account) => personCard(account, partnerId as number), 60_000);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  if (!active || !partnerId) return null;
  const person = card.data;
  const name = person?.name || params.name || '';
  const tone: Record<Presence, string> = { online: colors.ok, away: colors.warnInk, busy: colors.danger, offline: colors.edge };

  const message = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const channel = await chatWith(active, partnerId);
      router.dismissAll();
      router.navigate({ pathname: '/', params: { channel: String(channel) } });
    } catch (error) {
      setFailed(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPage title={name} testID="person-screen">
      <View style={styles.head}>
        <View>
          <Avatar name={name} seed={partnerId} partnerId={partnerId} size={112} />
          {person ? <View style={[styles.dot, { backgroundColor: tone[person.presence], borderColor: colors.canvas }]} testID={`person-presence-${person.presence}`} /> : null}
        </View>
        {person ? (
          <Text variant="footnote" tone="inkSoft">
            {t(`person.presence.${person.presence}`)}
          </Text>
        ) : null}
        {person?.status ? (
          <Text variant="callout" style={styles.center} testID="person-status">
            {person.status}
          </Text>
        ) : null}
      </View>
      {!person ? (
        <StateView loading={card.loading} error={card.error} empty={{ title: t('person.missing'), icon: 'people' }} onRetry={() => void card.refresh()} testID="person" />
      ) : (
        <>
          {person.partnerId !== active.partnerId && !person.external ? (
            <Button label={t('person.message')} busy={busy} onPress={() => void message()} testID="person-message" />
          ) : null}
          {failed ? (
            <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite">
              {failed}
            </Text>
          ) : null}
          {person.email || person.phone || person.title || person.company ? (
            <Section>
              {person.title ? <Row leading={<RowIcon name="people" />} title={person.title} detail={t('person.jobTitle')} testID="person-title" /> : null}
              {person.company ? <Row leading={<RowIcon name="table" />} title={person.company} detail={t('person.company')} testID="person-company" /> : null}
              {person.email ? <Row leading={<RowIcon name="send" />} title={person.email} detail={t('person.email')} onPress={() => void Linking.openURL(`mailto:${person.email}`)} testID="person-email" /> : null}
              {person.phone ? <Row leading={<RowIcon name="phone" />} title={person.phone} detail={t('person.phone')} onPress={() => void Linking.openURL(`tel:${person.phone}`)} testID="person-phone" /> : null}
            </Section>
          ) : null}
          {!active.partnerId || person.external ? null : (
            <Button kind="plain" label={t('person.viewProfile')} onPress={() => void Linking.openURL(`${active.origin}/odoo/res.partner/${partnerId}`)} testID="person-profile" />
          )}
        </>
      )}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: space.sm },
  dot: { position: 'absolute', right: 6, bottom: 6, width: 22, height: 22, borderRadius: radius.pill, borderWidth: 3 },
  center: { textAlign: 'center' },
});
