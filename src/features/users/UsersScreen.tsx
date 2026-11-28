import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOnline } from '../../api/network';
import { ApiError } from '../../api/odoo';
import { useResource } from '../../api/resource';
import { roles, type Role } from '../../auth/access';
import { useSession } from '../../auth/session';
import { useAccess } from '../../auth/useAccess';
import { radius, space, stroke, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { choose, notify } from '../../ui/dialog';
import { IconButton } from '../../ui/IconButton';
import { Pressable } from '../../ui/Pressable';
import { Refresh } from '../../ui/Refresh';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { Avatar } from '../chat/ui/Avatar';
import { StateView, useErrorText } from '../discovery/ui';
import { findByEmail, invite, overview, pageSize } from './api';
import { filters, needsSuperadmin, type Filter, type Person } from './door';

const searchDelayMs = 300;

export function RoleChip({ role, active = true }: { role: Role; active?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={[styles.chip, { borderColor: colors.line }]}>
      <Text variant="label" tone="inkSoft">
        {active ? t(`users.role.${role}`) : t('users.inactive')}
      </Text>
    </View>
  );
}

function PersonRow({ person, onPress }: { person: Person; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} android_ripple={{ color: `${colors.ink}1A`, foreground: true }} style={styles.row} testID={`user-${person.id}`}>
      <Avatar name={person.name} seed={person.id} size={40} />
      <View style={styles.rowText}>
        <Text variant="headline" numberOfLines={1}>
          {person.name}
        </Text>
        <Text variant="callout" tone="inkSoft" numberOfLines={1}>
          {person.email ?? person.login}
        </Text>
      </View>
      <RoleChip role={person.role} active={person.active} />
    </Pressable>
  );
}

function InviteSheet({ actor, onClose, onDone }: { actor: Role | null; onClose: () => void; onDone: (userId: number) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { active } = useSession();
  const errorText = useErrorText();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('internal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = name.trim().length > 0 && email.includes('@');
  const submit = async () => {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const made = await invite(active, name.trim(), email.trim(), role);
      notify(role === 'external' ? t('users.invite.madeExternal', { email: made.login }) : t('users.invite.sent', { email: made.login }));
      onDone(made.id);
    } catch (failure) {
      const existing = failure instanceof ApiError && failure.code === 'refused' ? await findByEmail(active, email).catch(() => null) : null;
      if (existing) {
        const open = await choose({ title: t('users.invite.takenTitle'), body: t('users.invite.takenBody', { email: email.trim() }), choices: [{ key: 'open', label: t('users.invite.openExisting'), tone: 'primary' }], cancel: t('users.cancel'), testID: 'invite-taken' });
        if (open === 'open') onDone(existing);
      } else {
        setError(errorText(failure));
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      title={t('users.invite.title')}
      onClose={onClose}
      testID="invite-sheet"
      footer={
        <>
          {error ? (
            <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite" testID="invite-error">
              {error}
            </Text>
          ) : null}
          <Button label={t('users.invite.send')} disabled={!ready} busy={busy} onPress={() => void submit()} testID="invite-send" />
        </>
      }>
      <TextField label={t('users.invite.name')} value={name} onChangeText={setName} autoCapitalize="words" testID="invite-name" />
      <TextField label={t('users.invite.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" testID="invite-email" />
      <Text variant="label" tone="inkSoft">
        {t('users.invite.role')}
      </Text>
      <View style={styles.roles} accessibilityRole="radiogroup">
        {roles
          .filter((candidate) => !needsSuperadmin(actor, candidate))
          .map((candidate) => {
            const selected = candidate === role;
            return (
              <Pressable
                key={candidate}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setRole(candidate)}
                style={[styles.roleOption, { borderColor: selected ? colors.focus : colors.line, backgroundColor: selected ? colors.select : colors.surface }]}
                testID={`invite-role-${candidate}`}>
                <Text variant="callout" tone={selected ? 'selectInk' : 'ink'}>
                  {t(`users.role.${candidate}`)}
                </Text>
              </Pressable>
            );
          })}
      </View>
      <Text variant="footnote" tone="inkSoft">
        {t(`users.invite.hint.${role}`)}
      </Text>
    </Sheet>
  );
}

export function UsersScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const access = useAccess();
  const online = useOnline();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(pageSize);
  const [inviting, setInviting] = useState(false);
  const page = useResource(`users.overview.${filter}.${limit}.${search}`, (account) => overview(account, search, filter, limit), 15_000);
  const previous = useResource(limit > pageSize ? `users.overview.${filter}.${limit - pageSize}.${search}` : null, (account) => overview(account, search, filter, limit - pageSize), 15_000);
  const shown = page.data ?? previous.data;
  const people = shown?.people ?? [];
  const total = shown?.total ?? 0;
  const loading = page.loading;
  const error = page.error;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setLimit(pageSize);
    }, searchDelayMs);
    return () => clearTimeout(timer);
  }, [query]);

  const pickFilter = (next: Filter) => {
    setFilter(next);
    setLimit(pageSize);
  };
  const refresh = () => page.refresh();
  const open = (id: number) => router.push({ pathname: '/settings/users/[id]', params: { id: String(id) } });
  const empty =
    search !== '' ? { title: t('users.noneNamed', { name: search }), icon: 'search' as const } : { title: t(`users.none.${filter}`), icon: 'people' as const };

  const header = (
    <View style={styles.head}>
      <TextField label={t('users.search')} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} returnKeyType="search" testID="users-search" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="tablist">
        {filters.map((name) => {
          const selected = name === filter;
          return (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => pickFilter(name)}
              style={[styles.filter, { borderColor: selected ? colors.focus : colors.line, backgroundColor: selected ? colors.select : colors.surface }]}
              testID={`users-filter-${name}`}>
              <Text variant="callout" tone={selected ? 'selectInk' : 'ink'}>
                {t(`users.filter.${name}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="users-screen">
      <View style={styles.bar}>
        <IconButton icon="back" label={t('settings.back')} onPress={() => router.back()} testID="settings-back" />
        <Text variant="title" accessibilityRole="header" style={styles.fill} numberOfLines={1}>
          {t('users.title')}
        </Text>
        <Button kind="secondary" label={t('users.invite.open')} onPress={() => setInviting(true)} testID="users-invite" />
      </View>
      <FlatList
        data={error || (!people.length && loading) ? [] : people}
        keyExtractor={(person) => String(person.id)}
        renderItem={({ item }) => <PersonRow person={item} onPress={() => open(item.id)} />}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.line }]} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading && !people.length ? (
            <View testID="users-skeleton">
              {[0, 1, 2, 3].map((index) => (
                <View key={index} style={styles.row}>
                  <View style={[styles.bone, styles.boneRound, { backgroundColor: colors.surface2 }]} />
                  <View style={styles.rowText}>
                    <View style={[styles.bone, { width: '55%', backgroundColor: colors.surface2 }]} />
                    <View style={[styles.bone, { width: '35%', backgroundColor: colors.surface2 }]} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <StateView offline={!online && !!error} error={online ? error : undefined} empty={empty} onRetry={() => void refresh()} testID="users" />
          )
        }
        ListFooterComponent={
          !error && people.length < total ? <Button kind="plain" label={t('users.more', { count: total - people.length })} busy={loading} onPress={() => setLimit((current) => current + pageSize)} testID="users-more" /> : undefined
        }
        refreshControl={<Refresh onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
      />
      {inviting ? (
        <InviteSheet
          actor={access.role}
          onClose={() => setInviting(false)}
          onDone={(id) => {
            setInviting(false);
            void refresh();
            open(id);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  head: { gap: space.md, paddingBottom: space.sm },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },
  filters: { gap: space.sm, paddingVertical: space.xs },
  filter: { minHeight: 36, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.md, justifyContent: 'center', overflow: 'hidden' },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  rowText: { flex: 1, gap: 2 },
  separator: { height: stroke.hairline, marginLeft: space.xxxl + space.md },
  chip: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.sm, paddingVertical: 2 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  roleOption: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.lg, justifyContent: 'center', overflow: 'hidden' },
  bone: { height: 12, borderRadius: radius.sm },
  boneRound: { width: 40, height: 40, borderRadius: radius.pill },
});
