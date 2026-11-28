import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { space, stroke, useTheme } from '../../../../theme';
import { Pressable } from '../../../../ui/Pressable';
import { Text } from '../../../../ui/Text';
import { Icon, type IconName } from '../../../../ui/icons';
import { CallButton } from '../../../call/ui/CallButton';
import type { Photo } from '../../../people/photo';
import { reach, touchTarget } from '../../../../ui/touch';
import { Avatar } from '../Avatar';

const avatarSize = 40;
const personSlop = reach(avatarSize, avatarSize);

export type ThreadHeaderProps = {
  channelId: number;
  name: string;
  subtitle: string;
  typing: boolean;
  largeText?: boolean;
  status: string | null;
  avatar: { seed: number; partnerId?: number | null; photo?: Photo | null; icon?: IconName };
  call: boolean;
  onBack?: () => void;
  onPerson?: () => void;
  onStatus?: () => void;
  onMore: () => void;
};

export function ThreadHeader({ channelId, name, subtitle, typing, largeText = false, status, avatar, call, onBack, onPerson, onStatus, onMore }: ThreadHeaderProps) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  return (
    <View style={[styles.header, !onBack && styles.headerNoBack, { borderBottomColor: colors.line }]} testID="thread-header">
      {!onBack ? null : (
        <Pressable accessibilityRole="button" accessibilityLabel={t('thread.back')} onPress={onBack} hitSlop={8} style={styles.button} testID="thread-back">
          <Icon name="back" color={colors.ink} />
        </Pressable>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel={t('thread.openPerson', { name })} disabled={!onPerson} onPress={onPerson} hitSlop={personSlop} testID="thread-person">
        <Avatar name={name} seed={avatar.seed} size={avatarSize} partnerId={avatar.partnerId} photo={avatar.photo} icon={avatar.icon} />
      </Pressable>
      <Pressable style={styles.heading} accessible={false} disabled={!onStatus} onPress={onStatus} testID="thread-heading">
        <Text variant="headline" numberOfLines={largeText ? 2 : 1} accessibilityRole="header" testID="thread-title">
          {name}
        </Text>
        <Text
          variant="footnote"
          tone={typing ? 'link' : 'inkSoft'}
          numberOfLines={1}
          accessibilityLiveRegion="polite"
          accessibilityLabel={status ? t('thread.status', { status }) : undefined}
          accessibilityRole={onStatus ? 'button' : undefined}
          onPress={onStatus}
          testID="thread-subtitle">
          {subtitle}
        </Text>
      </Pressable>
      {call ? <CallButton channelId={channelId} channelName={name} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={t('threadActions.more')} onPress={onMore} hitSlop={8} style={styles.button} testID="thread-more">
        <Icon name="more" color={colors.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs, paddingVertical: space.sm, borderBottomWidth: stroke.hairline, minHeight: 60 },
  headerNoBack: { paddingLeft: space.md },
  heading: { flex: 1, marginLeft: space.xs, minHeight: touchTarget, justifyContent: 'center' },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
