import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Image, StyleSheet, View } from 'react-native';
import { useSession } from '../../auth/session';
import { errorCode } from '../../features/chat/api';
import { Avatar } from '../../features/chat/ui/Avatar';
import { cleanStatus, fitStatus, statusLength, statusLimit } from '../../features/people/status';
import { cleanName, nameLimit, pickProfilePhoto, removeProfilePhoto, saveProfile, uploadProfilePhoto, useProfile, type PhotoSource, type ProfileChanges } from '../../features/profile/profile';
import { SettingsPage } from '../../screens/SettingsPage';
import { space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';

const photoSize = 128;
const knownErrors = ['name_invalid', 'status_too_long', 'status_invalid', 'photo_type_unsupported', 'photo_too_large', 'photo_invalid', 'network'];

export default function ProfileSettings() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { active } = useSession();
  const profile = useProfile();
  const [name, setName] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [staged, setStaged] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!active) return null;
  const current = profile.data?.name ?? active.name;
  const typed = name ?? current;
  const cleaned = cleanName(typed);
  const nameChanged = cleaned !== current && cleaned.length > 0 && cleaned.length <= nameLimit;
  const currentStatus = profile.data?.status ?? '';
  const typedStatus = status ?? currentStatus;
  const statusChanged = profile.data !== undefined && cleanStatus(typedStatus) !== currentStatus;
  const statusCount = statusLength(typedStatus);
  const changes: ProfileChanges = { ...(nameChanged ? { name: cleaned } : {}), ...(statusChanged ? { status: typedStatus } : {}) };
  const hasPhoto = !!profile.data?.photo;

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
      return true;
    } catch (failure) {
      const code = errorCode(failure);
      setError(t(`profile.errors.${knownErrors.includes(code) ? code : 'generic'}` as 'profile.errors.generic'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const pick = (source: PhotoSource) => () =>
    void pickProfilePhoto(source)
      .then((uri) => uri && setStaged(uri))
      .catch(() => setError(t('profile.errors.photo_invalid')));

  const confirmRemove = () =>
    Alert.alert('', t('profile.removeTitle'), [
      { text: t('profile.cancel'), style: 'cancel' },
      { text: t('profile.remove'), style: 'destructive', onPress: () => void run(() => removeProfilePhoto(active)) },
    ]);

  return (
    <SettingsPage title={t('settings.profile')} testID="settings-profile-screen">
      <View style={styles.photo} accessible accessibilityRole="image" accessibilityLabel={t('profile.photo', { name: current })} testID="profile-photo">
        {staged ? (
          <Image source={{ uri: staged }} style={[styles.staged, { borderColor: colors.primary }]} testID="profile-photo-staged" />
        ) : (
          <Avatar name={current} seed={active.partnerId} partnerId={active.partnerId} size={photoSize} />
        )}
        {busy ? <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.onPrimary} /> : null}
      </View>
      <View style={styles.actions}>
        {staged ? (
          <>
            <IconButton icon="close" label={t('profile.cancel')} onPress={() => setStaged(null)} disabled={busy} testID="profile-photo-cancel" />
            <IconButton
              icon="check"
              filled
              label={t('profile.usePhoto')}
              disabled={busy}
              onPress={() => void run(() => uploadProfilePhoto(active, staged)).then((done) => done && setStaged(null))}
              testID="profile-photo-save"
            />
          </>
        ) : (
          <>
            <IconButton icon="photo" label={t('profile.camera')} onPress={pick('camera')} disabled={busy} testID="profile-photo-camera" />
            <IconButton icon="image" label={t('profile.library')} onPress={pick('library')} disabled={busy} testID="profile-photo-library" />
            {hasPhoto ? <IconButton icon="trash" label={t('profile.remove')} onPress={confirmRemove} disabled={busy} testID="profile-photo-remove" /> : null}
          </>
        )}
      </View>
      <TextField
        label={t('profile.name')}
        value={typed}
        onChangeText={setName}
        maxLength={nameLimit}
        autoCapitalize="words"
        autoComplete="name"
        returnKeyType="done"
        testID="profile-name"
      />
      <Text variant="footnote" tone="inkSoft">
        {active.login}
      </Text>
      <TextField
        label={t('profile.status')}
        value={typedStatus}
        onChangeText={(text) => setStatus(fitStatus(text))}
        placeholder={t('profile.statusEmpty')}
        autoCapitalize="sentences"
        returnKeyType="done"
        editable={profile.data !== undefined}
        testID="profile-status"
      />
      <Text
        variant="footnote"
        tone="inkFaint"
        style={styles.count}
        accessibilityLabel={t('profile.statusCount', { used: statusCount, limit: statusLimit })}
        testID="profile-status-count">
        {`${statusCount}/${statusLimit}`}
      </Text>
      {error ? (
        <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite" testID="profile-error">
          {error}
        </Text>
      ) : null}
      <Button
        label={t('profile.save')}
        disabled={(!nameChanged && !statusChanged) || busy}
        onPress={() =>
          void run(() => saveProfile(active, changes)).then((done) => {
            if (!done) return;
            setName(null);
            setStatus(null);
          })
        }
        testID="profile-save"
      />
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  photo: { alignSelf: 'center', width: photoSize, height: photoSize, borderRadius: photoSize / 2, overflow: 'hidden', justifyContent: 'center' },
  staged: { width: photoSize, height: photoSize, borderRadius: photoSize / 2, borderWidth: 3 },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: space.lg },
  count: { alignSelf: 'flex-end', fontVariant: ['tabular-nums'] },
});
