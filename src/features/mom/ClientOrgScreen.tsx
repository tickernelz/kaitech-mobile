import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { Overlay } from '../../ui/Overlay';
import { Pressable } from '../../ui/Pressable';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { invalidate, useResource } from '../../api/resource';
import type { Account } from '../../auth/oauth';
import { useSession } from '../../auth/session';
import { readableWidth } from '../../layout/windowClass';
import { radius, space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Check, Row, Section, ToggleRow } from '../../ui/List';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { Header } from '../discovery/Header';
import { Card, Segmented, StateView, useErrorText } from '../discovery/ui';
import {
  clientBoard,
  linkAlias,
  saveDepartment,
  saveEmployee,
  setDepartmentActive,
  type AliasGroup,
  type ClientBoard,
  type ClientDepartment,
  type ClientEmployee,
  type ClientStatus,
  type Period,
} from './clientOrg';
import { ChoiceRow, PickRow } from './followupParts';
import { MoreSheet } from './MoreSheet';
import { SmallButton } from './parts';
import { Refresh } from '../../ui/Refresh';
import { notify } from '../../ui/dialog';

type Tab = 'departments' | 'employees' | 'aliases';
type Editing = { kind: 'department'; item: ClientDepartment | null } | { kind: 'employee'; item: ClientEmployee | null } | null;

const pageSize = 50;
const settleMs = 300;
const statuses: ClientStatus[] = ['active', 'inactive', 'all'];

function useOrgRun() {
  const { active } = useSession();
  const errorText = useErrorText();
  const [busy, setBusy] = useState('');
  const run = async (name: string, work: (account: Account) => Promise<unknown>): Promise<boolean> => {
    if (!active || busy) return false;
    setBusy(name);
    try {
      await work(active);
      invalidate(`${active.id}:mom.clientOrg`);
      return true;
    } catch (error) {
      notify(errorText(error));
      return false;
    } finally {
      setBusy('');
    }
  };
  return { busy, run };
}

export function ClientOrgScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [partner, setPartner] = useState<number | false>(false);
  const [tab, setTab] = useState<Tab>('departments');
  const [status, setStatus] = useState<ClientStatus>('active');
  const [department, setDepartment] = useState(0);
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(pageSize);
  const [editing, setEditing] = useState<Editing>(null);
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed.trim()), settleMs);
    return () => clearTimeout(timer);
  }, [typed]);
  const query = { partner, status, department, search, limit };
  const board = useResource(`mom.clientOrg.${JSON.stringify(query)}`, (account) => clientBoard(account, query));
  const data = board.data;
  const client = data?.client || null;
  const tabs: { value: Tab; label: string }[] = [
    { value: 'departments', label: t('mom.clientOrg.tabs.departments') },
    { value: 'employees', label: t('mom.clientOrg.tabs.employees') },
    ...(data?.seesFollowups ? [{ value: 'aliases' as const, label: t('mom.clientOrg.tabs.aliases', { count: data.unlinked.length }) }] : []),
  ];
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="mom-client-org">
      <Header title={t('mom.clientOrg.title')} subtitle={client ? client.name : undefined} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<Refresh refreshing={board.loading && !!data} onRefresh={() => void board.refresh()} />}>
        {data && data.clients.length > 1 ? (
          <PickRow label={t('mom.clientOrg.client')} value={client ? client.name : ''} placeholder={t('mom.setup.choose')} onPress={() => setPicking(true)} testID="client-org-client" />
        ) : null}
        {!data ? (
          <StateView loading={!board.error} error={board.error} onRetry={() => void board.refresh()} testID="client-org" />
        ) : !client ? (
          <StateView empty={{ title: t('mom.clientOrg.noClient'), icon: 'people' }} />
        ) : (
          <>
            <Segmented options={tabs} value={tab} onChange={setTab} testID="client-org-tab" />
            {tab === 'departments' ? <Departments data={data} onEdit={(item) => setEditing({ kind: 'department', item })} /> : null}
            {tab === 'employees' ? (
              <>
                <ChoiceRow options={statuses.map((value) => ({ value, label: t(`mom.clientOrg.status.${value}`) }))} value={status} onChange={setStatus} testID="client-org-status" />
                <ChoiceRow
                  options={[{ value: 0, label: t('mom.clientOrg.anyDepartment') }, ...data.departments.map((one) => ({ value: one.id, label: one.name }))]}
                  value={department}
                  onChange={setDepartment}
                  testID="client-org-department"
                />
                <TextField label={t('mom.records.search')} value={typed} onChangeText={setTyped} autoCorrect={false} testID="client-org-search" />
                <Section title={t('mom.clientOrg.employeesShown', { shown: data.employees.length, total: data.employee_page.total })}>
                  {data.employees.length ? (
                    data.employees.map((one) => (
                      <Row
                        key={one.id}
                        title={one.nickname ? `${one.name} (${one.nickname})` : one.name}
                        detail={[one.title, one.department ? one.department.name : '', one.active ? '' : t('mom.clientOrg.status.inactive'), one.aliases.length ? t('mom.clientOrg.aliasCount', { count: one.aliases.length }) : '']
                          .filter(Boolean)
                          .join(' · ')}
                        onPress={data.canChange ? () => setEditing({ kind: 'employee', item: one }) : undefined}
                        testID={`client-employee-${one.id}`}
                      />
                    ))
                  ) : (
                    <Row title={t('mom.clientOrg.noEmployees')} />
                  )}
                </Section>
                {data.employee_page.total > data.employees.length ? <SmallButton label={t('mom.more')} onPress={() => setLimit((count) => count + pageSize)} /> : null}
                {data.canChange ? <Button kind="secondary" label={t('mom.clientOrg.addEmployee')} onPress={() => setEditing({ kind: 'employee', item: null })} testID="client-org-add-employee" /> : null}
              </>
            ) : null}
            {tab === 'aliases' ? <Aliases data={data} /> : null}
          </>
        )}
      </ScrollView>
      {editing && data && client ? <EditSheet editing={editing} data={data} client={client.id} onClose={() => setEditing(null)} /> : null}
      {picking && data ? (
        <MoreSheet
          title={t('mom.clientOrg.client')}
          groups={[{ key: 'clients', actions: data.clients.map((one) => ({ key: `client-${one.id}`, icon: 'people' as const, label: one.name, onPress: () => setPartner(one.id) })) }]}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function periodLine(period: Period, label: string, t: (key: never, options?: object) => string) {
  if (!period || period.status === 'unmeasured') return '';
  return t('mom.clientOrg.period' as never, { label, count: period.count, target: period.target, status: t(`mom.clientOrg.periodStatus.${period.status}` as never) });
}

function Departments({ data, onEdit }: { data: ClientBoard; onEdit: (item: ClientDepartment | null) => void }) {
  const { t } = useTranslation();
  const action = useOrgRun();
  const kpis = new Map(data.kpi.departments.map((one) => [one.id, one]));
  return (
    <>
      {data.kpi.alerts.length ? (
        <Card>
          <Text variant="headline">{t('mom.clientOrg.alerts')}</Text>
          {data.kpi.alerts.map((alert) => (
            <Text key={`${alert.departmentId}-${alert.scope}`} variant="callout">
              {t(`mom.clientOrg.alert.${alert.scope}`, { name: alert.name, count: alert.count, target: alert.target })}
            </Text>
          ))}
        </Card>
      ) : null}
      <Section title={t('mom.clientOrg.tabs.departments')}>
        {data.departments.length ? (
          data.departments.map((one) => {
            const kpi = kpis.get(one.id);
            const lines = kpi
              ? [periodLine(kpi.currentWeek, t('mom.clientOrg.thisWeek'), t as never), periodLine(kpi.currentMonth, t('mom.clientOrg.thisMonth'), t as never)].filter(Boolean)
              : [];
            return (
              <Row
                key={one.id}
                title={one.name}
                detail={[t('mom.clientOrg.employeesCount', { count: one.employees }), one.active ? '' : t('mom.clientOrg.status.inactive'), ...lines].filter(Boolean).join('\n')}
                onPress={data.canChange ? () => onEdit(one) : undefined}
                trailing={
                  data.canChange ? (
                    <SmallButton
                      label={t(one.active ? 'mom.clientOrg.close' : 'mom.clientOrg.reopen')}
                      onPress={() => void action.run(`active-${one.id}`, (account) => setDepartmentActive(account, one.id, !one.active))}
                      testID={`client-department-active-${one.id}`}
                    />
                  ) : undefined
                }
                testID={`client-department-${one.id}`}
              />
            );
          })
        ) : (
          <Row title={t('mom.clientOrg.noDepartments')} />
        )}
      </Section>
      {data.canChange ? <Button kind="secondary" label={t('mom.clientOrg.addDepartment')} onPress={() => onEdit(null)} testID="client-org-add-department" /> : null}
    </>
  );
}

function Aliases({ data }: { data: ClientBoard }) {
  const { t } = useTranslation();
  const action = useOrgRun();
  const [group, setGroup] = useState<AliasGroup | null>(null);
  if (!data.unlinked.length) return <StateView empty={{ title: t('mom.clientOrg.noAliases'), icon: 'people' }} />;
  return (
    <>
      <Text tone="inkSoft">{t('mom.clientOrg.aliasHint')}</Text>
      <Section>
        {data.unlinked.map((one) => (
          <Row
            key={one.key}
            title={`"${one.said}"`}
            detail={one.items.map((item) => [item.code, item.name].filter(Boolean).join(' ')).join('\n')}
            onPress={data.canChange ? () => setGroup(one) : undefined}
            testID={`client-alias-${one.key}`}
          />
        ))}
      </Section>
      {group ? (
        <MoreSheet
          title={t('mom.clientOrg.linkTo', { said: group.said })}
          groups={[
            {
              key: 'employees',
              actions: data.employees
                .filter((one) => one.active)
                .map((one) => ({
                  key: `link-${one.id}`,
                  icon: 'people' as const,
                  label: one.name,
                  detail: one.department ? one.department.name : undefined,
                  onPress: () => void action.run('link', (account) => linkAlias(account, group, one.id)),
                })),
            },
          ]}
          onClose={() => setGroup(null)}
        />
      ) : null}
    </>
  );
}

function EditSheet({ editing, data, client, onClose }: { editing: NonNullable<Editing>; data: ClientBoard; client: number; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const action = useOrgRun();
  const department = editing.kind === 'department' ? editing.item : null;
  const employee = editing.kind === 'employee' ? editing.item : null;
  const [name, setName] = useState(department?.name ?? employee?.name ?? '');
  const [sequence, setSequence] = useState(String(department?.sequence ?? 10));
  const [served, setServed] = useState<number[]>(department?.programmeDepartmentIds ?? []);
  const [weekly, setWeekly] = useState(String(department?.weeklyTarget ?? 0));
  const [monthly, setMonthly] = useState(String(department?.monthlyTarget ?? 0));
  const [nickname, setNickname] = useState(employee?.nickname ?? '');
  const [title, setTitle] = useState(employee?.title ?? '');
  const [email, setEmail] = useState(employee?.email ?? '');
  const [phone, setPhone] = useState(employee?.phone ?? '');
  const [belongs, setBelongs] = useState<number | false>(employee?.department ? employee.department.id : false);
  const [activeFlag, setActiveFlag] = useState(employee?.active ?? true);
  const [aliases, setAliases] = useState((employee?.aliases ?? []).join('\n'));
  const save = () =>
    void action
      .run('save', (account) =>
        editing.kind === 'department'
          ? saveDepartment(account, client, department, { name, sequence, programmeDepartments: served, weeklyTarget: weekly, monthlyTarget: monthly })
          : saveEmployee(account, client, employee, { name, nickname, title, email, phone, department: belongs, active: activeFlag, aliases }),
      )
      .then((ok) => ok && onClose());
  const toggle = (id: number) => setServed((list) => (list.includes(id) ? list.filter((one) => one !== id) : [...list, id]));
  return (
    <Overlay visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('mom.menu.close')}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.lg) }]} onPress={() => undefined} accessibilityViewIsModal testID="client-org-edit">
            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <Text variant="headline">{t(`mom.clientOrg.${editing.kind}${editing.item ? 'Edit' : 'New'}`)}</Text>
              <TextField label={t('mom.clientOrg.name')} value={name} onChangeText={setName} testID="client-org-name" />
              {editing.kind === 'department' ? (
                <>
                  <TextField label={t('mom.clientOrg.sequence')} value={sequence} onChangeText={setSequence} keyboardType="number-pad" />
                  <TextField label={t('mom.clientOrg.weeklyTarget')} value={weekly} onChangeText={setWeekly} keyboardType="number-pad" testID="client-org-weekly" />
                  <TextField label={t('mom.clientOrg.monthlyTarget')} value={monthly} onChangeText={setMonthly} keyboardType="number-pad" />
                  {data.programmeDepartments.length ? (
                    <Section title={t('mom.clientOrg.serves')}>
                      {data.programmeDepartments.map((one) => (
                        <Row key={one.id} title={one.name} detail={one.programme} selected={served.includes(one.id)} trailing={<Check visible={served.includes(one.id)} />} onPress={() => toggle(one.id)} />
                      ))}
                    </Section>
                  ) : null}
                </>
              ) : (
                <>
                  <TextField label={t('mom.clientOrg.nickname')} value={nickname} onChangeText={setNickname} />
                  <TextField label={t('mom.clientOrg.jobTitle')} value={title} onChangeText={setTitle} />
                  <TextField label={t('mom.clientOrg.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                  <TextField label={t('mom.clientOrg.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                  <ChoiceRow
                    options={[{ value: 0, label: t('mom.clientOrg.noDepartment') }, ...data.departments.filter((one) => one.active).map((one) => ({ value: one.id, label: one.name }))]}
                    value={belongs || 0}
                    onChange={(value) => setBelongs(value || false)}
                    testID="client-org-belongs"
                  />
                  <TextField label={t('mom.clientOrg.aliases')} hint={t('mom.clientOrg.aliasesHint')} value={aliases} onChangeText={setAliases} multiline />
                  <Section>
                    <ToggleRow title={t('mom.clientOrg.status.active')} value={activeFlag} onChange={setActiveFlag} />
                  </Section>
                </>
              )}
              <Button label={t('mom.followups.save')} disabled={!name.trim()} busy={action.busy === 'save'} onPress={save} testID="client-org-save" />
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '90%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space.lg, paddingHorizontal: space.lg },
  sheetBody: { gap: space.md, paddingBottom: space.sm },
});
