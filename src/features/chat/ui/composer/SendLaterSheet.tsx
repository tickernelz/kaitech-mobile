import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../../../i18n/language';
import { Button } from '../../../../ui/Button';
import { Sheet, SheetRow } from '../../../../ui/Sheet';
import { quickTimes } from '../../composerExtras';
import { WhenPicker } from '../actions/WhenPicker';

export function SendLaterSheet({ busy, onPick, onClose }: { busy: boolean; onPick: (when: number) => void; onClose: () => void }) {
  const { t, i18n } = useTranslation('chat');
  const [now] = useState(() => Date.now());
  const [custom, setCustom] = useState<number | null>(null);
  const format = new Intl.DateTimeFormat(intlLocale(i18n.language === 'id' ? 'id' : 'en'), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <Sheet
      title={t('extras.later')}
      onClose={onClose}
      testID="later-sheet"
      footer={<Button label={custom ? t('extras.laterAt', { when: format.format(custom) }) : t('extras.laterPick')} disabled={!custom || custom <= now} busy={busy} onPress={() => custom && onPick(custom)} testID="later-send" />}>
      {quickTimes(now).map((choice) => (
        <SheetRow key={choice.key} icon="clock" label={t(`extras.quick.${choice.key}`)} detail={format.format(choice.when)} onPress={() => onPick(choice.when)} disabled={busy} testID={`later-${choice.key}`} />
      ))}
      <WhenPicker label={t('extras.laterCustom')} value={custom} onChange={setCustom} testID="later-when" />
    </Sheet>
  );
}
