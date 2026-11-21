import { useTranslation } from 'react-i18next';
import { setLockEnabled, useLock } from '../../lock/lock';
import { useLockLabel } from '../../lock/useLockLabel';
import { SettingsPage } from '../../screens/SettingsPage';
import { Section, ToggleRow } from '../../ui/List';

export default function SecuritySettings() {
  const { t } = useTranslation();
  const lock = useLock();
  const { method, label } = useLockLabel();
  return (
    <SettingsPage title={t('settings.security')} testID="settings-security-screen">
      {method ? (
        <Section>
          <ToggleRow
            title={t('settings.appLock')}
            detail={t('settings.appLockHint', { method: label })}
            value={lock.enabled}
            onChange={(next) => void setLockEnabled(next, t('lock.prompt'), t('settings.cancel'))}
            testID="settings-app-lock"
          />
        </Section>
      ) : null}
    </SettingsPage>
  );
}
