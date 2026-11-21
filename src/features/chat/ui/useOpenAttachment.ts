import * as Sharing from 'expo-sharing';
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
  const fetched = useCallback(
    async (attachment: Attachment, then: (file: Awaited<ReturnType<typeof downloadForOpening>>) => Promise<void>) => {
      const client = chatClient();
      if (!client || opening !== null) return;
      setOpening(attachment.id);
      try {
        const headers = await client.cookieHeaders();
        const url = attachmentUrl(client.origin, attachment, { download: true, token: false });
        const file = await downloadForOpening(
          { accountId: client.account.id, attachmentId: attachment.id, checksum: attachment.checksum },
          url,
          attachment.name || `file-${attachment.id}`,
          headers,
        );
        await then(file);
      } catch {
        Alert.alert(t('errors.network'));
      } finally {
        setOpening(null);
      }
    },
    [opening, t],
  );
  const open = useCallback(
    (attachment: Attachment) =>
      fetched(attachment, async (file) => {
        const mimeType = attachment.mimetype || undefined;
        if (await file.canPreview({ mimeType })) await file.preview({ mimeType, title: attachment.name });
        else Alert.alert(t('thread.cannotOpen', { name: attachment.name }));
      }),
    [fetched, t],
  );
  const share = useCallback(
    (attachment: Attachment) =>
      fetched(attachment, async (file) => {
        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert(t('thread.cannotShare'));
          return;
        }
        await Sharing.shareAsync(file.uri, { mimeType: attachment.mimetype || undefined, dialogTitle: attachment.name });
      }),
    [fetched, t],
  );
  return { open, share, opening };
}
