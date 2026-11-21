import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSession } from '../../auth/session';
import { space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Row, ToggleRow } from '../../ui/List';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { createAttachment, nameSearch, type FieldInfo, type Relation } from './api';
import { domainOf, htmlOfPlain, isRelation, plainOfHtml } from './model';
import type { PyContext } from './py';
import { Sheet } from './Sheet';
import type { FieldSpec } from './views';

type Props = {
  field: FieldSpec;
  info: FieldInfo;
  label: string;
  value: unknown;
  scope: PyContext;
  context: Record<string, unknown>;
  model: string;
  required: boolean;
  onChange: (value: unknown) => void;
  testID: string;
};

function numberText(value: unknown): string {
  return typeof value === 'number' ? String(value) : '';
}

function localDateTime(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const at = new Date(`${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(at.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

function serverDateTime(text: string): string | false | null {
  if (!text.trim()) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(text.trim());
  if (!match) return null;
  const at = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4] ?? 0), Number(match[5] ?? 0));
  return at.toISOString().slice(0, 19).replace('T', ' ');
}

function TextEditor({ info, label, value, onChange, required, testID, widget }: Props & { widget?: string }) {
  const { t } = useTranslation();
  const numeric = info.type === 'integer' || info.type === 'float' || info.type === 'monetary';
  const initial =
    info.type === 'html'
      ? plainOfHtml(typeof value === 'string' ? value : '')
      : info.type === 'datetime'
        ? localDateTime(value)
        : numeric
          ? widget === 'percentage' && typeof value === 'number'
            ? String(Math.round(value * 1000) / 10)
            : numberText(value)
          : typeof value === 'string'
            ? value
            : '';
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const multiline = info.type === 'text' || info.type === 'html';
  const commit = (next: string) => {
    setText(next);
    if (numeric) {
      if (!next.trim()) {
        setError(null);
        onChange(false);
        return;
      }
      const parsed = Number(next.replace(',', '.'));
      if (!Number.isFinite(parsed) || (info.type === 'integer' && !Number.isInteger(parsed))) {
        setError(t('records.badNumber'));
        return;
      }
      setError(null);
      onChange(widget === 'percentage' ? parsed / 100 : parsed);
    } else if (info.type === 'date') {
      if (next.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(next.trim())) {
        setError(t('records.badDate'));
        return;
      }
      setError(null);
      onChange(next.trim() || false);
    } else if (info.type === 'datetime') {
      const parsed = serverDateTime(next);
      if (parsed === null) {
        setError(t('records.badDateTime'));
        return;
      }
      setError(null);
      onChange(parsed);
    } else if (info.type === 'html') onChange(next.trim() ? htmlOfPlain(next) : false);
    else onChange(next);
  };
  return (
    <TextField
      label={required ? `${label} *` : label}
      value={text}
      onChangeText={commit}
      multiline={multiline}
      keyboardType={numeric ? 'decimal-pad' : 'default'}
      placeholder={info.type === 'date' ? t('records.dateShape') : info.type === 'datetime' ? t('records.dateTimeShape') : undefined}
      hint={info.help}
      error={error}
      autoCapitalize={info.type === 'char' || multiline ? 'sentences' : 'none'}
      testID={testID}
    />
  );
}

function RelationPicker({ model, domain, context, multiple, chosen, onDone, onClose }: {
  model: string;
  domain: unknown[];
  context: Record<string, unknown>;
  multiple: boolean;
  chosen: Relation[];
  onDone: (picked: Relation[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const account = useSession().active;
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Relation[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<Relation[]>(chosen);
  const domainKey = JSON.stringify(domain);
  const contextKey = JSON.stringify(context);
  useEffect(() => {
    if (!account) return;
    let live = true;
    const timer = setTimeout(() => {
      nameSearch(account, model, query, JSON.parse(domainKey) as unknown[], JSON.parse(contextKey) as Record<string, unknown>)
        .then((found) => live && setRows(found.map(([id, display_name]) => ({ id, display_name }))))
        .catch(() => live && setFailed(true));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [account, model, query, domainKey, contextKey]);
  const toggle = (row: Relation) => {
    if (!multiple) {
      onDone([row]);
      return;
    }
    setPicked((current) => (current.some((item) => item.id === row.id) ? current.filter((item) => item.id !== row.id) : [...current, row]));
  };
  const items = (rows ?? []).map((row) => ({ key: String(row.id), label: row.display_name, selected: picked.some((item) => item.id === row.id), onPress: () => toggle(row) }));
  return (
    <Sheet title={t('records.pick')} items={items} onClose={onClose} testID="relation-picker">
      <TextField label={t('records.search')} value={query} onChangeText={setQuery} autoFocus testID="relation-search" />
      {rows === null && !failed ? <ActivityIndicator color={colors.primary} /> : null}
      {failed ? (
        <Text variant="footnote" tone="dangerInk">
          {t('records.loadFailed')}
        </Text>
      ) : null}
      <View style={styles.actions}>
        {!multiple && chosen.length ? <Button kind="plain" label={t('records.clear')} onPress={() => onDone([])} testID="relation-clear" /> : null}
        {multiple ? <Button label={t('records.done')} onPress={() => onDone(picked)} testID="relation-done" /> : null}
      </View>
    </Sheet>
  );
}

function AttachmentsEditor({ label, value, model, onChange, testID }: Props) {
  const { t } = useTranslation();
  const account = useSession().active;
  const [busy, setBusy] = useState(false);
  const rows = Array.isArray(value) ? (value as unknown[]).filter(isRelation) : [];
  const add = async () => {
    if (!account) return;
    const picked = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setBusy(true);
    try {
      const datas = await new File(asset.uri).base64();
      const id = await createAttachment(account, { name: asset.name, mimetype: asset.mimeType ?? 'application/octet-stream', datas }, model, false);
      onChange([...rows, { id, display_name: asset.name }]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.group} testID={testID}>
      <Text variant="label" tone="inkSoft">
        {label}
      </Text>
      {rows.map((row) => (
        <Row key={row.id} title={row.display_name} trailing={<Button kind="plain" label={t('records.remove')} onPress={() => onChange(rows.filter((item) => item.id !== row.id))} />} />
      ))}
      <Button kind="secondary" label={t('records.addFile')} busy={busy} onPress={() => void add()} testID={`${testID}-add`} />
    </View>
  );
}

export function FieldEditor(props: Props) {
  const { t } = useTranslation();
  const { field, info, label, value, scope, context, onChange, required, testID } = props;
  const [picking, setPicking] = useState(false);
  if (field.widget === 'many2many_binary') return <AttachmentsEditor {...props} />;
  switch (info.type) {
    case 'boolean':
      return <ToggleRow title={label} value={!!value} onChange={onChange} testID={testID} />;
    case 'selection': {
      const current = info.selection?.find(([key]) => key === value)?.[1] ?? '';
      return (
        <>
          <Row title={required ? `${label} *` : label} detail={current || t('records.none')} onPress={() => setPicking(true)} testID={testID} />
          {picking ? (
            <Sheet
              title={label}
              testID={`${testID}-options`}
              onClose={() => setPicking(false)}
              items={[
                ...(required ? [] : [{ key: '__none', label: t('records.none'), selected: !value, onPress: () => (onChange(false), setPicking(false)) }]),
                ...(info.selection ?? []).map(([key, text]) => ({ key, label: text, selected: key === value, onPress: () => (onChange(key), setPicking(false)) })),
              ]}
            />
          ) : null}
        </>
      );
    }
    case 'many2one':
    case 'many2many': {
      const chosen = info.type === 'many2one' ? (isRelation(value) ? [value] : []) : Array.isArray(value) ? (value as unknown[]).filter(isRelation) : [];
      const detail = chosen.map((item) => item.display_name).join(', ');
      return (
        <>
          <Row title={required ? `${label} *` : label} detail={detail || t('records.none')} onPress={() => setPicking(true)} testID={testID} />
          {picking && info.relation ? (
            <RelationPicker
              model={info.relation}
              domain={domainOf(field.domain, scope)}
              context={context}
              multiple={info.type === 'many2many'}
              chosen={chosen}
              onClose={() => setPicking(false)}
              onDone={(picked) => {
                setPicking(false);
                onChange(info.type === 'many2one' ? picked[0] ?? false : picked);
              }}
            />
          ) : null}
        </>
      );
    }
    default:
      return <TextEditor {...props} widget={field.widget} />;
  }
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  group: { gap: space.xs },
});
