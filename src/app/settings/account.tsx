import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { useCan } from '../../auth/useAccess';
import { DateGrid } from '../../features/activity/DateGrid';
import { isoDay } from '../../features/activity/odoo';
import {
  choices,
  endOfLocalDay,
  localDayFromOdoo,
  odooDateTime,
  plainSignature,
  readMe,
  signatureHtml,
  startOfLocalDay,
  writeMe,
  type Me,
  type MeChange,
} from '../../features/account/odoo';
import { useErrorText, StateView } from '../../features/discovery/ui';
import { SettingsPage } from '../../screens/SettingsPage';
import { space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { ChoiceSheet } from '../../ui/ChoiceSheet';
import { Icon } from '../../ui/icons';
import { Row, Section, ToggleRow } from '../../ui/List';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';

type Open = 'tz' | 'privacy' | 'signature' | 'from' | 'to' | null;

export default function AccountSettings() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { active } = useSession();
  const errorText = useErrorText();
  const me = useResource('account.me', readMe, 60_000);
  const options = useResource('account.choices', choices, 3_600_000);
  const team = useCan('team');
  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [signature, setSignature] = useState('');
  const [away, setAway] = useState<{ on: boolean; from: string; to: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  if (!active) return null;
  const data = me.data;
  const more = <Icon name="forward" size={20} color={colors.inkFaint} />;

  const save = async (change: MeChange, after?: () => void) => {
    setBusy(true);
    setFailed(null);
    try {
      await writeMe(active, change);
      await me.refresh();
      after?.();
      setOpen(null);
    } catch (error) {
      setFailed(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <SettingsPage title={t('account.title')} testID="settings-account-screen">
        <StateView loading={me.loading} error={me.error} onRetry={() => void me.refresh()} testID="settings-account" />
      </SettingsPage>
    );
  }

  const typedEmail = email ?? data.email;
  const typedPhone = phone ?? data.phone;
  const contactChanged = typedEmail.trim() !== data.email || typedPhone.trim() !== data.phone;
  const label = (list: { value: string; label: string }[] | undefined, value: string) => list?.find((option) => option.value === value)?.label ?? value;
  const awayNow = away ?? awayFrom(data);
  const awayChanged = away !== null;

  const saveAway = () =>
    void save(
      awayNow.on
        ? {
            out_of_office_from: awayNow.from ? odooDateTime(startOfLocalDay(awayNow.from)) : false,
            out_of_office_to: awayNow.to ? odooDateTime(endOfLocalDay(awayNow.to)) : false,
            out_of_office_message: signatureHtml(awayNow.message),
          }
        : { out_of_office_from: false, out_of_office_to: false },
      () => setAway(null),
    );

  return (
    <SettingsPage title={t('account.title')} testID="settings-account-screen">
      <Section title={t('account.contact')}>
        <View style={styles.fields}>
          <TextField label={t('account.email')} value={typedEmail} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" testID="account-email" />
          <TextField label={t('account.phone')} value={typedPhone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" testID="account-phone" />
          <Button
            label={t('account.save')}
            disabled={!contactChanged || busy}
            busy={busy && contactChanged}
            onPress={() =>
              void save({ email: typedEmail.trim(), phone: typedPhone.trim() }, () => {
                setEmail(null);
                setPhone(null);
              })
            }
            testID="account-contact-save"
          />
        </View>
      </Section>
      <Section title={t('account.preferences')}>
        <Row title={t('account.timezone')} detail={label(options.data?.tz, data.tz) || t('account.notSet')} trailing={more} onPress={() => setOpen('tz')} testID="account-timezone" />
        {team && options.data?.calendarPrivacy.length ? (
          <Row
            title={t('account.calendarPrivacy')}
            detail={label(options.data.calendarPrivacy, data.calendarPrivacy)}
            trailing={more}
            onPress={() => setOpen('privacy')}
            testID="account-calendar-privacy"
          />
        ) : null}
        {team ? (
          <Row
            title={t('account.signature')}
            detail={plainSignature(data.signature).split('\n')[0] || t('account.notSet')}
            trailing={more}
            onPress={() => {
              setSignature(plainSignature(data.signature));
              setOpen('signature');
            }}
            testID="account-signature"
          />
        ) : null}
      </Section>
      {team ? (
        <Section title={t('account.away')}>
          <ToggleRow title={t('account.awayToggle')} detail={t('account.awayHint')} value={awayNow.on} onChange={(on) => setAway({ ...awayNow, on })} testID="account-away" />
          {awayNow.on ? (
            <View style={styles.fields}>
              <Row title={t('account.awayFrom')} detail={awayNow.from || t('account.notSet')} trailing={more} onPress={() => setOpen('from')} testID="account-away-from" />
              <Row title={t('account.awayTo')} detail={awayNow.to || t('account.notSet')} trailing={more} onPress={() => setOpen('to')} testID="account-away-to" />
              <TextField label={t('account.awayMessage')} value={awayNow.message} onChangeText={(message) => setAway({ ...awayNow, message })} multiline style={styles.multi} testID="account-away-message" />
            </View>
          ) : null}
          {awayChanged ? <Button label={t('account.save')} busy={busy} onPress={saveAway} testID="account-away-save" /> : null}
        </Section>
      ) : null}
      {failed ? (
        <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite" testID="account-error">
          {failed}
        </Text>
      ) : null}
      {open === 'tz' && options.data ? (
        <ChoiceSheet title={t('account.timezone')} options={options.data.tz} value={data.tz} searchable onPick={(tz) => void save({ tz })} onClose={() => setOpen(null)} testID="account-timezone-sheet" />
      ) : null}
      {open === 'privacy' && options.data ? (
        <ChoiceSheet
          title={t('account.calendarPrivacy')}
          options={options.data.calendarPrivacy}
          value={data.calendarPrivacy}
          onPick={(value) => void save({ calendar_default_privacy: value })}
          onClose={() => setOpen(null)}
          testID="account-privacy-sheet"
        />
      ) : null}
      {open === 'signature' ? (
        <Sheet title={t('account.signature')} onClose={() => setOpen(null)} testID="account-signature-sheet">
          <TextField label={t('account.signature')} value={signature} onChangeText={setSignature} multiline style={styles.multi} autoFocus testID="account-signature-input" />
          <Button label={t('account.save')} busy={busy} onPress={() => void save({ signature: signatureHtml(signature) })} testID="account-signature-save" />
        </Sheet>
      ) : null}
      {open === 'from' || open === 'to' ? (
        <Sheet title={open === 'from' ? t('account.awayFrom') : t('account.awayTo')} onClose={() => setOpen(null)} testID="account-away-date">
          <DateGrid
            value={(open === 'from' ? awayNow.from : awayNow.to) || isoDay(new Date())}
            onChange={(iso) => {
              setAway({ ...awayNow, [open]: iso });
              setOpen(null);
            }}
            testID="account-away-grid"
          />
        </Sheet>
      ) : null}
    </SettingsPage>
  );
}

function awayFrom(data: Me) {
  return {
    on: !!(data.outOfOfficeFrom || data.outOfOfficeTo),
    from: localDayFromOdoo(data.outOfOfficeFrom),
    to: localDayFromOdoo(data.outOfOfficeTo),
    message: plainSignature(data.outOfOfficeMessage),
  };
}


const styles = StyleSheet.create({
  fields: { gap: space.md, paddingVertical: space.sm },
  multi: { minHeight: 96, textAlignVertical: 'top' },
});
