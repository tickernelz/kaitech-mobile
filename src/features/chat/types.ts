import type { Photo } from '../people/photo';

export type ConversationType = 'chat' | 'group' | 'channel';

export type LastMessage = {
  id: number;
  authorId: number | null;
  author: string;
  text: string;
  attachments: number;
  voice: boolean;
  call: boolean;
  type: string;
  date: number;
};

export type Conversation = {
  id: number;
  type: ConversationType;
  name: string;
  partnerId: number | null;
  photo: Photo | null;
  unread: number;
  mutedUntil: string | null;
  activityAt: number;
  last: LastMessage | null;
  pinned: boolean | null;
  archived: boolean | null;
  mentioned?: boolean;
  agent?: boolean;
};

export type Attachment = {
  id: number;
  name: string;
  mimetype: string;
  size: number;
  voice: boolean;
  accessToken: string | null;
  checksum: string | null;
  url: string | null;
};

export type Reaction = { content: string; count: number; mine: boolean; people?: string[] };

export type Message = {
  id: number;
  channelId: number;
  authorId: number | null;
  author: string;
  body: string;
  date: number;
  type: string;
  attachments: Attachment[];
  parentId: number | null;
  reactions: Reaction[];
  call?: CallRecord;
  starred?: boolean;
  pinnedAt?: string | null;
  edited?: boolean;
  translation?: { body: string; lang: string } | null;
  translated?: boolean;
  urgent?: boolean;
  rich?: Rich;
};

export type CallRecord = { minutes: number; ongoing: boolean };

export type Media = { url: string; width: number; height: number };

export type Sticker = { source: 'pack' | 'provider'; id: number | string; packId: number | null; alt: string; animated: boolean; width: number; height: number; url: string; poster: string };

export type GifMedia = { provider: string; id: string; title: string; gif: Media | null; mp4: Media | null; preview: Media | null };

export type Rich = { sticker: Sticker } | { gif: GifMedia };

export type Mention = { id: number; name: string; token: string | null };

export type PendingFile = {
  key: string;
  uri: string;
  name: string;
  mimetype: string;
  size: number;
  voice: boolean;
  durationMs: number | null;
  attachmentId: number | null;
  ownershipToken: string | null;
};

export type PendingState = 'queued' | 'sending' | 'failed';

export type Pending = {
  key: string;
  accountId: string;
  channelId: number;
  text: string;
  parentId: number | null;
  mentions: Mention[];
  files: PendingFile[];
  createdAt: number;
  attempts: number;
  urgent?: boolean;
  rich?: Rich;
  state: PendingState;
  error: string | null;
};

export type Member = { partnerId: number; seenMessageId: number };
