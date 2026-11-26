import type { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { TFunction } from 'i18next';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { chatClient } from '../chat';
import { DownloadCancelled, fetchFile, type FileKey } from '../media/download';
import { downloadUrl } from '../media/urls';
import type { Attachment } from '../types';
import { confirm, notify } from '../../../ui/dialog';

export function fileName(attachment: Attachment): string {
  return attachment.name || `file-${attachment.id}`;
}

export function fileKey(accountId: string, attachment: Attachment): FileKey {
  return { accountId, attachmentId: attachment.id, checksum: attachment.checksum };
}

export async function fetchAttachment(attachment: Attachment): Promise<File | null> {
  const client = chatClient();
  if (!client) return null;
  const headers = await client.cookieHeaders();
  return fetchFile(fileKey(client.account.id, attachment), downloadUrl(client.origin, attachment), fileName(attachment), headers);
}

export async function shareFile(attachment: Attachment, uri: string, t: TFunction<'chat'>) {
  if (!(await Sharing.isAvailableAsync())) {
    notify(t('thread.cannotShare'));
    return;
  }
  await Sharing.shareAsync(uri, { mimeType: attachment.mimetype || undefined, dialogTitle: attachment.name });
}

export async function presentFile(attachment: Attachment, file: File, t: TFunction<'chat'>) {
  const mimeType = attachment.mimetype || undefined;
  if (await file.canPreview({ mimeType })) {
    await file.preview({ mimeType, title: attachment.name });
    return;
  }
  if (await confirm({ body: t('thread.cannotOpen', { name: attachment.name }), cancel: t('thread.close'), confirm: t('thread.shareInstead'), icon: 'share', testID: 'attachment-share-instead-dialog' }))
    await shareFile(attachment, file.uri, t);
}

export function useOpenAttachment() {
  const { t } = useTranslation('chat');
  const fetched = useCallback(
    async (attachment: Attachment, then: (file: File) => Promise<void>, quiet: boolean) => {
      try {
        const file = await fetchAttachment(attachment);
        if (file) await then(file);
      } catch (error) {
        if (!quiet && !(error instanceof DownloadCancelled)) notify(t('errors.network'));
      }
    },
    [t],
  );
  const open = useCallback((attachment: Attachment, quiet = false) => fetched(attachment, (file) => presentFile(attachment, file, t), quiet), [fetched, t]);
  const share = useCallback((attachment: Attachment, quiet = false) => fetched(attachment, (file) => shareFile(attachment, file.uri, t), quiet), [fetched, t]);
  return { open, share };
}
