import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../ui/Button';
import { Sheet } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import { TextField } from '../../../../ui/TextField';
import { rename } from '../../threadActions';
import { failureText } from '../actions/failure';

export function RenameSheet({ channelId, type, name, description, onClose, onDone }: { channelId: number; type: string; name: string; description: string; onClose: () => void; onDone: (text: string) => void }) {
  const { t } = useTranslation('chat');
  const [nextName, setNextName] = useState(name);
  const [nextDescription, setNextDescription] = useState(description);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const withDescription = type !== 'chat';
  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await rename(channelId, type, nextName.trim(), withDescription && nextDescription !== description ? nextDescription.trim() : null);
    setBusy(false);
    if (result.ok) onDone(t('rename.done'));
    else setError(failureText(t, result));
  };
  return (
    <Sheet
      title={withDescription ? t('rename.titleInfo') : t('rename.title')}
      onClose={onClose}
      testID="rename-sheet"
      footer={
        <>
          {error ? (
            <Text variant="footnote" tone="danger">
              {error}
            </Text>
          ) : null}
          <Button label={t('rename.save')} disabled={!nextName.trim() && type !== 'chat'} busy={busy} onPress={() => void submit()} testID="rename-save" />
        </>
      }>
      <TextField label={t('rename.name')} value={nextName} onChangeText={setNextName} hint={type === 'chat' ? t('rename.chatHint') : undefined} testID="rename-name" />
      {withDescription ? <TextField label={t('rename.description')} value={nextDescription} onChangeText={setNextDescription} multiline testID="rename-description" /> : null}
    </Sheet>
  );
}
