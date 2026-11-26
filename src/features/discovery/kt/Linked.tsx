import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from '../../../ui/Pressable';
import { attachmentUrl } from '../../chat/odoo';
import type { Attachment } from '../../chat/types';
import { useCookie } from '../../chat/ui/useCookie';
import { useOpenAttachment } from '../../chat/ui/useOpenAttachment';
import { radius, space, useTheme } from '../../../theme';
import { Icon, type IconName } from '../../../ui/icons';
import { Text } from '../../../ui/Text';
import { useNumbers, type Numbers } from './format';
import { useThread, type FileCard, type Place, type RecordCard } from './place';
import type { GalleryBlock, RecordBlock } from './read';
import { BlockTitle, Tool, styles as shared } from './ui';

const TILE = 132;

function fileIcon(mimetype: string): IconName {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype === 'application/pdf' || mimetype.includes('word')) return 'doc';
  if (mimetype.includes('spreadsheet') || mimetype.includes('excel') || mimetype === 'text/csv') return 'minutes';
  return 'file';
}

function sizeText(numbers: Numbers, bytes: number, t: (key: 'discovery.block.gallery.mb' | 'discovery.block.gallery.kb', options: { size: string }) => string): string {
  if (bytes >= 1024 * 1024) return t('discovery.block.gallery.mb', { size: numbers.number(bytes / (1024 * 1024), 1, false) });
  return t('discovery.block.gallery.kb', { size: String(Math.max(1, Math.round(bytes / 1024))) });
}

function attachmentOf(id: number, file: FileCard): Attachment {
  return { id, name: file.name, mimetype: file.mimetype, size: file.size, voice: false, accessToken: null, checksum: null, url: null };
}

export const KtGallery = memo(function KtGallery({ block, place }: { block: GalleryBlock; place: Place | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const numbers = useNumbers();
  const { origin } = useThread();
  const cookie = useCookie();
  const { open } = useOpenAttachment();
  const [opening, setOpening] = useState<number | null>(null);
  const files = place?.reads?.files ?? {};
  return (
    <View style={shared.gap} testID="kt-gallery">
      <BlockTitle title={block.title} />
      <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled contentContainerStyle={styles.strip}>
        {block.items.map((item, index) => {
          const file = files[String(item.attachment)];
          if (!file) {
            return (
              <View key={index} style={styles.item}>
                <View style={[styles.tile, styles.closed, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
                  <Icon name="lock" size={20} color={colors.inkSoft} />
                  <Text variant="label" tone="inkSoft" style={styles.center}>
                    {t('discovery.block.gallery.closed')}
                  </Text>
                </View>
                {item.caption ? (
                  <Text variant="label" tone="inkSoft" numberOfLines={2}>
                    {item.caption}
                  </Text>
                ) : null}
              </View>
            );
          }
          const attachment = attachmentOf(item.attachment, file);
          const name = item.caption || file.name;
          return (
            <View key={index} style={styles.item}>
              <Pressable
                accessibilityRole={file.picture ? 'imagebutton' : 'button'}
                accessibilityLabel={t('discovery.block.gallery.open', { name })}
                accessibilityState={{ busy: opening === item.attachment }}
                onPress={() => {
                  setOpening(item.attachment);
                  void open(attachment).finally(() => setOpening(null));
                }}
                testID={`kt-gallery-${index}`}
                style={[styles.tile, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
                {file.picture ? (
                  <Image source={{ uri: attachmentUrl(origin, attachment), ...(cookie ? { headers: cookie } : {}) }} style={styles.picture} resizeMode="cover" />
                ) : (
                  <View style={styles.closed}>
                    <Icon name={fileIcon(file.mimetype)} size={28} color={colors.inkSoft} />
                    <Text variant="label" numberOfLines={2} style={styles.center}>
                      {file.name}
                    </Text>
                    <Text variant="label" tone="inkSoft">
                      {sizeText(numbers, file.size, t)}
                    </Text>
                  </View>
                )}
              </Pressable>
              <Text variant="label" tone="inkSoft" numberOfLines={2}>
                {name}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
});

export function recordUrl(origin: string, model: string, id: number): string {
  return origin.replace(/\/+$/, '') + '/odoo/' + model + '/' + id;
}

export const KtRecord = memo(function KtRecord({ block, place }: { block: RecordBlock; place: Place | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const numbers = useNumbers();
  const { origin } = useThread();
  const card: RecordCard | undefined = place?.reads?.records?.[block.model + ',' + block.id];
  const name = card?.name || block.label;
  const shown = card ? (block.fields ? block.fields.filter((field) => field in card.fields) : card.defaults) : [];
  const fieldText = (field: RecordCard['fields'][string]) => {
    const value = field.value;
    if (field.kind === 'boolean') return value ? t('discovery.block.record.yes') : t('discovery.block.record.no');
    if (value === null || value === undefined || value === '') return '-';
    if (field.kind === 'number' && typeof value === 'number') return Number.isInteger(value) ? numbers.number(value, 0) : numbers.number(value, 2, false);
    if (field.kind === 'date' && typeof value === 'string') return numbers.date(value);
    if (field.kind === 'datetime' && typeof value === 'string') return new Date(value.replace(' ', 'T') + 'Z').toLocaleString(numbers.locale);
    return String(value);
  };
  return (
    <View style={[styles.record, { borderColor: colors.line, backgroundColor: card ? colors.surface : colors.surface2 }]} testID="kt-record">
      <View style={styles.recordHead}>
        <View style={[styles.mark, { backgroundColor: colors.select }]}>
          <Text variant="callout" tone="selectInk" style={styles.bold}>
            {name.trim().charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={shared.grow}>
          <Text variant="callout" style={styles.bold} selectable>
            {name}
          </Text>
          {card ? (
            <Text variant="label" tone="inkSoft">
              {card.model}
            </Text>
          ) : (
            <View style={styles.lockLine}>
              <Icon name="lock" size={12} color={colors.inkSoft} />
              <Text variant="label" tone="inkSoft" style={shared.grow}>
                {t('discovery.block.record.closed')}
              </Text>
            </View>
          )}
        </View>
      </View>
      {card && shown.length ? (
        <View style={styles.fields}>
          {shown.map((field) => (
            <View key={field} style={styles.field}>
              <Text variant="label" tone="inkSoft">
                {card.fields[field].label}
              </Text>
              <Text variant="footnote" selectable>
                {fieldText(card.fields[field])}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {card && origin ? (
        <View style={shared.tools}>
          <Tool icon="external" label={t('discovery.block.record.open')} onPress={() => void Linking.openURL(recordUrl(origin, block.model, block.id))} testID="kt-record-open" />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  strip: { gap: space.sm },
  item: { width: TILE, gap: space.xs },
  tile: { width: TILE, height: TILE, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  closed: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xs, padding: space.sm },
  picture: { width: '100%', height: '100%' },
  center: { textAlign: 'center' },
  record: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.md, gap: space.sm },
  recordHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mark: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bold: { fontWeight: '700' },
  lockLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  field: { minWidth: 120, gap: 1 },
});
