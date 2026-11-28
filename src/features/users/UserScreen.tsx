import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { update, useResource } from '../../api/resource';
import { roles, type Role } from '../../auth/access';
import type { Account } from '../../auth/oauth';
import { useSession } from '../../auth/session';
import { useAccess } from '../../auth/useAccess';
import { useLanguage } from '../../i18n';
import { intlLocale } from '../../i18n/language';
import { SettingsPage } from '../../screens/SettingsPage';
import { space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { confirm, notify } from '../../ui/dialog';
import { Icon } from '../../ui/icons';
import { Divider, Row, Section, ToggleRow } from '../../ui/List';
import { Sheet, SheetItem } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { parseServerDate } from '../discovery/dates';
import { StateView, useErrorText } from '../discovery/ui';
import { deactivate, detail as readDetail, reactivate, setCapability, setRole } from './api';
import { capabilitiesFor, capabilityKind, lastRoleChange, needsSuperadmin, type Change, type Detail } from './door';
import { RoleChip } from './UsersScreen';

function useChangeText() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const locale = intlLocale(language);
  return (change: Change) => {
    const actor = change.actor ?? t('users.history.system');
    const role = (value: Role | null) => (value ? t(`users.role.${value}`) : '-');
    const capability = change.capability ? t(`users.capability.${change.capability.slice(1)}`, { defaultValue: change.capability.slice(1) }) : '';
    const what = {
      role: t('users.history.role', { actor, from: role(change.fromRole), to: role(change.toRole) }),
      capability: t(change.capability?.startsWith('+') ? 'users.history.capabilityOn' : 'users.history.capabilityOff', { actor, capability }),
      invite: t('users.history.invite', { actor, to: role(change.toRole) }),
      deactivate: t('users.history.deactivate', { actor }),
      reactivate: t('users.history.reactivate', { actor }),
      token_revoked: t('users.history.tokenRevoked'),
    }[change.change];
    const at = parseServerDate(change.at);
    const when = at ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(at) : '';
    return when ? `${what} · ${when}` : what;
  };
}

function RoleSheet({ detail, actor, onPick, onClose }: { detail: Detail; actor: Role | null; onPick: (role: Role) => void; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Sheet title={t('users.roleTitle', { name: detail.name })} onClose={onClose} testID="user-role-sheet">
      {roles.map((role) => {
        const current = role === detail.role;
        const allowed = detail.may.setRole.includes(role);
        return (
          <SheetItem
            key={role}
            label={t(`users.role.${role}`)}
            detail={current ? t('users.roleNow') : allowed ? t(`users.roleHint.${role}`) : needsSuperadmin(actor, role) ? t('users.onlySuperadminMakes', { role: t(`users.role.${role}`) }) : t('users.roleUnavailable')}
            selected={current}
            disabled={current || !allowed}
            onPress={() => onPick(role)}
            testID={`user-role-${role}`}
          />
        );
      })}
    </Sheet>
  );
}

async function changeRole(account: Account, shown: Detail, role: Role, say: { changedBy: (name: string) => string; changed: string }): Promise<Detail> {
  const fresh = await readDetail(account, shown.id);
  if (fresh.role !== shown.role) {
    notify(say.changedBy(lastRoleChange(fresh)?.actor ?? ''));
    return fresh;
  }
  const next = await setRole(account, shown.id, role);
  notify(say.changed);
  return next;
}

export function UserScreen({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { active } = useSession();
  const access = useAccess();
  const errorText = useErrorText();
  const changeText = useChangeText();
  const loaded = useResource(`users.detail.${userId}`, (account) => readDetail(account, userId), 15_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const person = loaded.data ?? null;
  if (!active) return null;

  const run = async (key: string, work: () => Promise<Detail>) => {
    setBusy(key);
    try {
      const next = await work();
      if (loaded.key) update<Detail>(loaded.key, () => next);
    } catch (error) {
      notify(errorText(error));
      await loaded.refresh();
    } finally {
      setBusy(null);
    }
  };

  if (!person) {
    return (
      <SettingsPage title={t('users.title')} testID="user-screen">
        <StateView loading={loaded.loading} error={loaded.error} onRetry={() => void loaded.refresh()} testID="user" />
      </SettingsPage>
    );
  }

  const self = person.id === active.userId;
  const roleLabel = t(`users.role.${person.role}`);
  const pick = async (role: Role) => {
    setPicking(false);
    const label = t(`users.role.${role}`);
    const go = await confirm({
      title: t('users.confirmTitle', { name: person.name, role: label }),
      body: t(`users.confirmBody.${role}`),
      confirm: t('users.confirmAction', { role: label }),
      cancel: t('users.cancel'),
      testID: 'user-role-confirm',
    });
    if (!go) return;
    await run('role', () =>
      changeRole(active, person, role, {
        changedBy: (name) => (name ? t('users.changedBy', { name }) : t('users.changedElsewhere')),
        changed: t('users.changed', { name: person.name, role: label }),
      }),
    );
  };
  const switchActive = async () => {
    const off = person.active;
    const go = await confirm({
      title: off ? t('users.deactivateTitle', { name: person.name }) : t('users.reactivateTitle', { name: person.name }),
      body: off ? t('users.deactivateBody') : t('users.reactivateBody'),
      confirm: off ? t('users.deactivate') : t('users.reactivate'),
      cancel: t('users.cancel'),
      danger: off,
      testID: off ? 'user-deactivate-confirm' : 'user-reactivate-confirm',
    });
    if (!go) return;
    await run('active', () => (off ? deactivate(active, person.id) : reactivate(active, person.id)));
  };
  const roleDetail = self ? t('users.selfRole') : person.may.setRole.length ? roleLabel : t('users.roleLocked', { role: roleLabel });
  const capabilities = capabilitiesFor[capabilityKind(person.role)];

  return (
    <SettingsPage title={person.name} testID="user-screen">
      <View style={styles.identity}>
        <Text variant="callout" tone="inkSoft" testID="user-email">
          {person.email ?? person.login}
        </Text>
        <RoleChip role={person.role} active={person.active} />
      </View>
      <Section title={t('users.roleSection')}>
        <Row
          title={t('users.roleRow')}
          detail={roleDetail}
          trailing={person.may.setRole.length ? <Icon name="forward" size={20} color={colors.inkFaint} /> : undefined}
          onPress={person.may.setRole.length && !busy ? () => setPicking(true) : undefined}
          testID="user-role"
        />
      </Section>
      <Section title={t('users.capabilitiesSection')}>
        {capabilities.map((name, index) => (
          <View key={name}>
            {index ? <Divider /> : null}
            <ToggleRow
              title={t(`users.capability.${name}`)}
              value={person.capabilities.includes(name)}
              disabled={!person.may.capabilities || !!busy}
              onChange={(on) => void run(`capability-${name}`, () => setCapability(active, person.id, name, on))}
              testID={`user-capability-${name}`}
            />
          </View>
        ))}
      </Section>
      <Section title={t('users.programmesSection')}>
        <Row title={t('users.programmes', { count: person.programmes })} testID="user-programmes" />
        {person.programmeList.map((programme) => (
          <View key={programme.id}>
            <Divider />
            <Row title={programme.name} testID={`user-programme-${programme.id}`} />
          </View>
        ))}
        {person.programmes > person.programmeList.length && person.programmeList.length ? (
          <>
            <Divider />
            <Row title={t('users.programmesMore', { count: person.programmes - person.programmeList.length })} testID="user-programmes-more" />
          </>
        ) : null}
      </Section>
      {person.history.length ? (
        <Section title={t('users.historySection')}>
          {person.history.map((change, index) => (
            <View key={`${change.at}-${index}`}>
              {index ? <Divider /> : null}
              <Row title={changeText(change)} testID={`user-history-${index}`} />
            </View>
          ))}
        </Section>
      ) : null}
      {person.may.deactivate || person.may.reactivate ? (
        <Button
          kind={person.may.deactivate ? 'danger' : 'secondary'}
          label={person.may.deactivate ? t('users.deactivate') : t('users.reactivate')}
          busy={busy === 'active'}
          disabled={!!busy}
          onPress={() => void switchActive()}
          testID={person.may.deactivate ? 'user-deactivate' : 'user-reactivate'}
        />
      ) : null}
      {picking ? <RoleSheet detail={person} actor={access.role} onPick={(role) => void pick(role)} onClose={() => setPicking(false)} /> : null}
      {busy === 'role' ? <Text variant="footnote" tone="inkSoft" accessibilityLiveRegion="polite">{t('users.saving')}</Text> : null}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
});
