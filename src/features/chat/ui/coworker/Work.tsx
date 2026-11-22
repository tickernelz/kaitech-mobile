import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '../../../../theme';
import { Icon } from '../../../../ui/icons';
import { Sheet, SheetItem } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import { stopWork, type Work } from '../../coworker';
import { failureText } from '../actions/failure';

export function WorkBar({ works, onPress }: { works: Work[]; onPress: () => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const running = works.filter((work) => work.state !== 'stopped');
  if (!running.length) return null;
  const first = running[0];
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.bar, { backgroundColor: colors.infoBand, borderBottomColor: colors.line }]} testID="work-bar">
      <Icon name="sparkle" size={20} color={colors.infoInk} />
      <Text variant="footnote" tone="infoInk" numberOfLines={1} style={styles.flex}>
        {running.length > 1 ? t('work.many', { count: running.length }) : first.step ? t('work.step', { agent: first.agent, step: first.step }) : t(`work.state.${first.state === 'queued' ? 'queued' : first.state === 'away' ? 'away' : 'running'}`, { agent: first.agent })}
      </Text>
      <Icon name="chevronDown" size={20} color={colors.infoInk} />
    </Pressable>
  );
}

export function WorkSheet({ works, myUserId, onClose, onJump, onNotice }: { works: Work[]; myUserId: number; onClose: () => void; onJump: (messageId: number) => void; onNotice: (text: string) => void }) {
  const { t } = useTranslation('chat');
  return (
    <Sheet title={t('work.title')} onClose={onClose} testID="work-sheet">
      {works.length ? null : (
        <View style={styles.pad}>
          <Text variant="callout" tone="inkSoft">
            {t('work.none')}
          </Text>
        </View>
      )}
      {works.map((work) => (
        <View key={work.turnId} style={styles.item}>
          <SheetItem
            icon={work.state === 'stopped' ? 'stop' : 'sparkle'}
            label={work.state === 'stopped' ? t('work.stopped', { agent: work.agent, name: work.stoppedBy || work.asker }) : work.step ? t('work.step', { agent: work.agent, step: work.step }) : t(`work.state.${work.state === 'queued' ? 'queued' : work.state === 'away' ? 'away' : 'running'}`, { agent: work.agent })}
            detail={work.detail || t('work.askedBy', { name: work.asker })}
            onPress={() => {
              onClose();
              onJump(work.messageId);
            }}
            testID={`work-${work.turnId}`}
          />
          {work.askerUserId === myUserId && work.state !== 'stopped' ? (
            <SheetItem
              icon="stop"
              danger
              label={t('work.stop')}
              onPress={() => void stopWork(work.turnId).then((result) => onNotice(result.ok ? t('work.stopping') : failureText(t, result)))}
              testID={`work-stop-${work.turnId}`}
            />
          ) : null}
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40, paddingHorizontal: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  pad: { padding: space.lg },
  item: { borderRadius: radius.md },
});
