import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../auth/session';
import { useFormatters } from '../../i18n';
import { radius, space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Row, Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { Header } from '../discovery/Header';
import { Chip, StateView } from '../discovery/ui';
import {
  callButton,
  getViews,
  loadAction,
  onchange,
  readRecord,
  saveRecord,
  specOf,
  unlinkRecord,
  type Fields,
  type Relation,
  type Spec,
  type WindowAction,
} from './api';
import { Chatter, useFailureAlert } from './Chatter';
import { FieldEditor } from './FieldEditor';
import {
  changedValues,
  contextOf,
  editable,
  fieldLabel,
  isRelation,
  mergeOnchange,
  onchangeValues,
  required,
  scopeOf,
  textOfValue,
  visible,
  writeValue,
  type Format,
  type Values,
} from './model';
import { Sheet, type SheetItem } from './Sheet';
import { recordsChanged, stash, unstash, useRecordsGeneration } from './stash';
import { openReport, useRunAction, type ListStash, type RecordStash } from './useRunAction';
import { compileForm, type ButtonSpec, type FieldSpec, type FormSpec, type TextSpec } from './views';

type Loaded = { form: FormSpec; fields: Fields; spec: Spec };

export function useFormat(): Format {
  const { t } = useTranslation();
  const { number, date } = useFormatters();
  return useMemo(
    () => ({
      number,
      date,
      day: (value: Date) => value.toLocaleDateString(),
      yes: t('records.yes'),
      no: t('records.no'),
    }),
    [number, date, t],
  );
}

function Note({ item }: { item: TextSpec }) {
  const { colors } = useTheme();
  const fill = item.tone === 'danger' ? colors.dangerBand : item.tone === 'warn' ? colors.warnBand : item.tone === 'info' ? colors.infoBand : colors.surface2;
  const ink = item.tone === 'danger' ? 'dangerInk' : item.tone === 'warn' ? 'warnInk' : item.tone === 'info' ? 'infoInk' : 'ink';
  return (
    <View style={[styles.note, { backgroundColor: fill, borderColor: colors.line }]}>
      <Text variant="callout" tone={ink}>
        {item.text}
      </Text>
    </View>
  );
}

export function RecordScreen({ programme, model, rid, stashKey }: { programme: number; model: string; rid: number | null; stashKey?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const account = useSession().active;
  const fail = useFailureAlert();
  const format = useFormat();
  const run = useRunAction(programme);
  const generation = useRecordsGeneration();
  const [holder] = useState<RecordStash>(() => unstash<RecordStash>(stashKey) ?? { context: {}, formView: false, wizard: false });
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [id, setId] = useState<number | null>(rid);
  const [record, setRecord] = useState<Values | null>(null);
  const [draft, setDraft] = useState<Values | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const uid = account?.userId ?? 0;
  const context = holder.context;

  useEffect(() => {
    if (!account) return;
    let live = true;
    getViews(account, model, [[holder.formView, 'form']])
      .then((views) => {
        if (!live) return;
        const fields = views.models[model]?.fields ?? {};
        const form = compileForm(views.views.form.arch, fields);
        setLoaded({ form, fields, spec: specOf(form.names, fields) });
      })
      .catch((failure: unknown) => live && setError(failure));
    return () => {
      live = false;
    };
  }, [account, model, holder.formView]);

  const fetchState = useCallback(async (): Promise<{ record: Values; draft?: Values }> => {
    if (!account || !loaded) throw new Error('not ready');
    if (id) {
      const row = await readRecord(account, model, id, loaded.spec, context);
      if (!row) throw new Error('missing');
      return { record: row };
    }
    const defaults = await onchange(account, model, null, {}, [], loaded.spec, context);
    return { record: { id: 0 }, draft: mergeOnchange({}, defaults.value, loaded.fields) };
  }, [account, loaded, id, model, context]);

  const apply = useCallback((state: { record: Values; draft?: Values }) => {
    setRecord(state.record);
    if (state.draft) setDraft(state.draft);
  }, []);

  useEffect(() => {
    if (!account || !loaded) return;
    let live = true;
    fetchState()
      .then((state) => live && apply(state))
      .catch((failure: unknown) => live && setError(failure));
    return () => {
      live = false;
    };
  }, [account, loaded, fetchState, apply, generation]);

  const reload = useCallback(() => fetchState().then(apply).catch(setError), [fetchState, apply]);

  const values = useMemo(() => draft ?? record ?? { id: 0 }, [draft, record]);
  const specsByName = useMemo(() => {
    const map = new Map<string, FieldSpec[]>();
    if (!loaded) return map;
    for (const spec of [...loaded.form.title, ...loaded.form.hiddenFields, ...loaded.form.blocks.flatMap((block) => block.items.filter((item): item is FieldSpec => item.kind === 'field'))]) {
      map.set(spec.name, [...(map.get(spec.name) ?? []), spec]);
    }
    return map;
  }, [loaded]);
  const editing = draft !== null;
  const fields = useMemo(() => loaded?.fields ?? {}, [loaded]);
  const scope = useMemo(() => scopeOf(values, fields, context, uid), [values, fields, context, uid]);

  const change = async (field: FieldSpec, value: unknown) => {
    const next = { ...(draft ?? record ?? {}), [field.name]: value } as Values;
    setDraft(next);
    if (!field.onChange || !account || !loaded) return;
    try {
      const result = await onchange(account, model, id, onchangeValues(next, fields), [field.name], loaded.spec, context);
      setDraft((current) => mergeOnchange(current ?? next, result.value, fields));
      if (result.warning?.message) Alert.alert(result.warning.title ?? '', result.warning.message);
    } catch (failure) {
      fail(failure);
    }
  };

  const missing = (): string[] => {
    if (!loaded) return [];
    const out: string[] = [];
    for (const block of loaded.form.blocks) {
      if (!visible(block.invisible, scope)) continue;
      for (const item of block.items) {
        if (item.kind !== 'field' || !visible(item.invisible, scope)) continue;
        const info = fields[item.name];
        if (!required(item, info, scope)) continue;
        const value = values[item.name];
        const empty = value === false || value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length);
        if (empty && info?.type !== 'boolean') out.push(fieldLabel(item, fields));
      }
    }
    return out;
  };

  const save = async (): Promise<number | null> => {
    if (!account || !loaded) return null;
    if (!draft) return id;
    const absent = missing();
    if (absent.length) {
      Alert.alert(t('records.required'), absent.join(', '));
      return null;
    }
    const writable = (name: string) =>
      (specsByName.get(name) ?? []).some((spec) => spec.forceSave || editable(spec, fields[name], scope));
    const vals: Values = {};
    if (id) {
      for (const [name, value] of Object.entries(changedValues(record ?? {}, draft, fields))) if (writable(name)) vals[name] = value;
    } else {
      for (const [name, value] of Object.entries(draft)) {
        const info = fields[name];
        if (info && name !== 'id' && writable(name)) vals[name] = writeValue(info, value);
      }
    }
    const saved = await saveRecord(account, model, id, vals, loaded.spec, context);
    setId(saved.id);
    setRecord(saved);
    setDraft(null);
    if (!holder.wizard) recordsChanged();
    return saved.id;
  };

  const press = async (button: ButtonSpec) => {
    if (!account) return;
    const go = async () => {
      setBusy(button.key);
      try {
        const target = editing || !id ? await save() : id;
        if (!target) return;
        const buttonContext = { ...context, ...contextOf(button.context, scope), active_id: target, active_ids: [target], active_model: model };
        const result =
          button.type === 'object'
            ? await callButton(account, model, button.name, [target], buttonContext)
            : await loadAction(account, Number(button.name) || button.name, buttonContext);
        await run(result, { wizard: holder.wizard, context: buttonContext });
        if (!holder.wizard) await reload();
      } catch (failure) {
        fail(failure);
      } finally {
        setBusy(null);
      }
    };
    if (button.confirm) Alert.alert('', button.confirm, [{ text: t('records.cancel'), style: 'cancel' }, { text: t('records.confirm'), onPress: () => void go() }]);
    else await go();
  };

  const remove = () => {
    if (!account || !id) return;
    Alert.alert('', t('records.removeAsk'), [
      { text: t('records.cancel'), style: 'cancel' },
      {
        text: t('records.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await unlinkRecord(account, model, id);
            recordsChanged();
            router.back();
          } catch (failure) {
            fail(failure);
          }
        },
      },
    ]);
  };

  const openRelated = (field: FieldSpec) => {
    const info = fields[field.name];
    const value = values[field.name];
    if (!info?.relation) return;
    if (info.type === 'many2one' && isRelation(value)) {
      router.push({ pathname: '/program/[id]/record', params: { id: String(programme), model: info.relation, rid: String(value.id), stash: stash({ context: {}, formView: false, wizard: false } satisfies RecordStash) } });
      return;
    }
    const ids = Array.isArray(value) ? (value as unknown[]).map((item) => (isRelation(item) ? item.id : (item as number))) : [];
    const inverse = info.type === 'one2many' ? info.relation_field : undefined;
    const action: WindowAction = {
      type: 'ir.actions.act_window',
      name: fieldLabel(field, fields),
      res_model: info.relation,
      views: [
        [false, 'list'],
        [false, 'form'],
      ],
      domain: inverse && id ? [[inverse, '=', id]] : [['id', 'in', ids]],
      context: inverse && id ? { [`default_${inverse}`]: id } : {},
    };
    router.push({ pathname: '/program/[id]/list', params: { id: String(programme), stash: stash({ action } satisfies ListStash) } });
  };

  const openFile = (row: Relation) => {
    if (!account) return;
    void openReport(account, `/web/content/${row.id}?download=true`, row.display_name, row.id).catch(fail);
  };

  if (!loaded || !record) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]}>
        <Header title={holder.title ?? ''} />
        <StateView loading={!error} error={error} onRetry={() => (setError(null), void reload())} testID="record" />
      </SafeAreaView>
    );
  }

  const { form } = loaded;
  const shownButtons = form.header.filter((button) => visible(button.invisible, scope));
  const primary = [...shownButtons].sort((a, b) => Number(b.primary) - Number(a.primary)).slice(0, editing ? 0 : 2);
  const rest = shownButtons.filter((button) => !primary.includes(button));
  const canEdit = form.edit && !holder.wizard && !!id && !editing;
  const status = form.statusbar ? textOfValue(fields[form.statusbar.name], values[form.statusbar.name], format) : '';
  const titleText = form.title.map((field) => textOfValue(fields[field.name], values[field.name], format)).find(Boolean) || (typeof values.display_name === 'string' ? values.display_name : '') || holder.title || '';
  const smart = form.smart.filter((button) => visible(button.invisible, scope));

  const moreItems: SheetItem[] = [
    ...(canEdit && primary.length >= 2 ? [{ key: 'edit', label: t('records.edit'), icon: 'doc' as const, onPress: () => (setMore(false), setDraft({ ...record })) }] : []),
    ...rest.map((button) => ({ key: button.key, label: button.string, icon: 'forward' as const, onPress: () => (setMore(false), void press(button)) })),
    ...(form.remove && id && !holder.wizard ? [{ key: 'delete', label: t('records.delete'), icon: 'trash' as const, tone: 'dangerInk' as const, onPress: () => (setMore(false), remove()) }] : []),
  ];

  const renderField = (field: FieldSpec) => {
    if (!visible(field.invisible, scope)) return null;
    const info = fields[field.name];
    if (!info) return null;
    const label = fieldLabel(field, fields);
    const value = values[field.name];
    const testID = `field-${field.name}`;
    if (editing && editable(field, info, scope)) {
      return (
        <View key={field.name} style={styles.editor}>
          <FieldEditor field={field} info={info} label={label} value={value} scope={scope} context={context} model={model} required={required(field, info, scope)} onChange={(next) => void change(field, next)} testID={testID} />
        </View>
      );
    }
    if (field.widget === 'many2many_binary' && Array.isArray(value)) {
      const files = (value as unknown[]).filter(isRelation);
      if (!files.length) return null;
      return files.map((row) => <Row key={`${field.name}-${row.id}`} title={row.display_name} detail={label} onPress={() => openFile(row)} testID={`${testID}-${row.id}`} />);
    }
    if (info.type === 'one2many' || info.type === 'many2many') {
      const count = Array.isArray(value) ? value.length : 0;
      const names = info.type === 'many2many' ? (value as unknown[]).filter(isRelation).map((row) => row.display_name).join(', ') : '';
      if (!count && !(info.type === 'one2many' && id && form.edit)) return null;
      return <Row key={field.name} title={label} detail={names || t('records.count', { count })} onPress={() => openRelated(field)} testID={testID} />;
    }
    const text = textOfValue(info, value, format, field.widget);
    if (!text && info.type !== 'boolean') return null;
    if (info.type === 'many2one' && isRelation(value)) return <Row key={field.name} title={label} detail={text} onPress={() => openRelated(field)} testID={testID} />;
    if (info.type === 'text' || info.type === 'html' || text.length > 80) {
      return (
        <View key={field.name} style={styles.long} testID={testID}>
          <Text variant="footnote" tone="inkSoft">
            {label}
          </Text>
          <Text variant="body" selectable>
            {text}
          </Text>
        </View>
      );
    }
    return <Row key={field.name} title={label} detail={text} testID={testID} />;
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="record-screen">
      <Header
        title={titleText || t('records.new')}
        subtitle={status || undefined}
        actions={!editing && moreItems.length ? <IconButton icon="more" label={t('records.more')} onPress={() => setMore(true)} testID="record-more" /> : undefined}
      />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID={`record-${model}-${id ?? 'new'}`}>
          {status ? <Chip tone="select" label={status} /> : null}
          {primary.length || (canEdit && primary.length < 2) ? (
            <View style={styles.bar}>
              {primary.map((button, index) => (
                <Button
                  key={button.key}
                  kind={index === 0 ? 'primary' : 'secondary'}
                  label={button.string}
                  busy={busy === button.key}
                  disabled={busy !== null}
                  onPress={() => void press(button)}
                  style={styles.grow}
                  testID={`button-${button.name}`}
                />
              ))}
              {canEdit && primary.length < 2 ? <Button kind="secondary" label={t('records.edit')} onPress={() => setDraft({ ...record })} style={styles.grow} testID="record-edit" /> : null}
            </View>
          ) : null}
          {editing && form.title.length ? <Section>{form.title.map(renderField)}</Section> : null}
          {form.blocks.map((block) => {
            if (!visible(block.invisible, scope)) return null;
            const notes = block.items.filter((item): item is TextSpec => item.kind === 'text' && visible(item.invisible, scope));
            const rows = block.items.flatMap((item) => {
              if (item.kind === 'field') {
                const shown = renderField(item);
                return shown ? [shown] : [];
              }
              if (item.kind === 'button' && visible(item.invisible, scope) && !editing)
                return [<Row key={item.key} title={item.string} tone="link" onPress={() => void press(item)} testID={`button-${item.name}`} />];
              return [];
            });
            if (!rows.length && !notes.length) return null;
            return (
              <View key={block.key} style={styles.block}>
                {notes.map((note, index) => (
                  <Note key={`${block.key}-n${index}`} item={note} />
                ))}
                {rows.length ? <Section title={block.title}>{editing ? <View style={styles.editing}>{rows}</View> : rows}</Section> : null}
              </View>
            );
          })}
          {form.widgets.includes('ck_interview_watch') && model === 'ck.interview' && id && !editing ? (
            <Section>
              <Row title={t('records.watch')} onPress={() => router.push({ pathname: '/program/[id]/watch', params: { id: String(programme), rid: String(id) } })} testID="record-watch" />
            </Section>
          ) : null}
          {smart.length && !editing && id ? (
            <Section title={t('records.related')}>
              {smart.map((button) => (
                <Row key={button.key} title={button.string} onPress={() => void press(button)} trailing={undefined} testID={`smart-${button.name}`} />
              ))}
            </Section>
          ) : null}
          {form.chatter && id && !editing ? <Chatter model={model} id={id} generation={generation} /> : null}
        </ScrollView>
        {editing ? (
          <View style={[styles.footer, { borderColor: colors.line, backgroundColor: colors.surface }]}>
            {holder.wizard ? (
              <>
                <Button kind="plain" label={t('records.cancel')} onPress={() => router.back()} testID="wizard-cancel" />
                {shownButtons.map((button, index) => (
                  <Button key={button.key} kind={index === 0 ? 'primary' : 'secondary'} label={button.string} busy={busy === button.key} disabled={busy !== null} onPress={() => void press(button)} testID={`button-${button.name}`} />
                ))}
                {!shownButtons.length ? <Button label={t('records.save')} onPress={() => void save().then(() => router.back()).catch(fail)} testID="record-save" /> : null}
              </>
            ) : (
              <>
                <Button kind="plain" label={t('records.cancel')} onPress={() => (id ? setDraft(null) : router.back())} testID="record-cancel" />
                <Button
                  label={t('records.save')}
                  busy={busy === 'save'}
                  onPress={() => {
                    setBusy('save');
                    void save()
                      .catch(fail)
                      .finally(() => setBusy(null));
                  }}
                  testID="record-save"
                />
              </>
            )}
          </View>
        ) : null}
      </KeyboardAvoidingView>
      {more ? <Sheet title={titleText} items={moreItems} onClose={() => setMore(false)} testID="record-more-sheet" /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxl, gap: space.lg, width: '100%', maxWidth: 720, alignSelf: 'center' },
  bar: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  block: { gap: space.sm },
  note: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.md },
  editor: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  editing: { paddingVertical: space.sm },
  long: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: 2 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: space.sm, padding: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
