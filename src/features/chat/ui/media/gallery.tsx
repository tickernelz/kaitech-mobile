import { createContext, useCallback, useContext } from 'react';
import { chatClient } from '../../chat';
import { mediaKind } from '../../media/kind';
import { nativeMedia } from '../../media/native';
import { openPdf, openViewer, viewerFor } from '../../media/viewer';
import type { Attachment } from '../../types';
import { useOpenAttachment } from '../useOpenAttachment';

export const GalleryContext = createContext<(() => Attachment[]) | null>(null);

export function useOpenMedia() {
  const gallery = useContext(GalleryContext);
  const { open } = useOpenAttachment();
  return useCallback(
    (attachment: Attachment, origin: string, siblings: Attachment[]) => {
      const client = chatClient();
      if (!client) return;
      const kind = mediaKind(attachment);
      if (kind === 'image' || kind === 'video') {
        openViewer(viewerFor(client.account.id, origin, attachment, gallery?.() ?? [], siblings));
        return;
      }
      if (kind === 'pdf' && nativeMedia()) {
        openPdf({ accountId: client.account.id, origin, attachment });
        return;
      }
      void open(attachment);
    },
    [gallery, open],
  );
}
