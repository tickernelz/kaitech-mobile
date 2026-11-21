import type { Attachment as ChatAttachment } from '../chat/types';
import type { Attachment } from './api';

export function chatAttachments(items: Attachment[] | undefined): ChatAttachment[] {
  return (items ?? []).flatMap((item) =>
    item.attachmentId
      ? [{ id: item.attachmentId, name: item.name, mimetype: item.mimetype, size: item.size ?? 0, voice: item.mimetype.startsWith('audio/'), accessToken: null, checksum: null, url: null }]
      : [],
  );
}
