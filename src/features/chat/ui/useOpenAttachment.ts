import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { chatClient } from '../chat';
import { downloadForOpening } from '../files';
import { attachmentUrl } from '../odoo';
import type { Attachment } from '../types';

export function useOpenAttachment() {
  const { t } = useTranslation('chat');
  const [opening, setOpening] = useState<number | null>(null);
  const open = useCallback(
    async (attachment: Attachment) => {
      const client = chatClient();
      if (!client || opening !== null) return;
      setOpening(attachment.id);
      try {
        const headers = await client.cookieHeaders();
        const url = attachmentUrl(client.origin, attachment, { download: true, token: false });
        const file = await downloadForOpening(url, attachment.name || `file-${attachment.id}`, headers);
        const mimeType = attachment.mimetype || undefined;
        if (await file.canPreview({ mimeType })) await file.preview({ mimeType, title: attachment.name });
        else Alert.alert(t('thread.cannotOpen', { name: attachment.name }));
      } catch {
        Alert.alert(t('errors.network'));
      } finally {
        setOpening(null);
      }
    },
    [opening, t],
  );
  return { open, opening };
}
