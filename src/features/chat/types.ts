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
  starred?: boolean;
  pinnedAt?: string | null;
  edited?: boolean;
};

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
  state: PendingState;
  error: string | null;
};

export type Member = { partnerId: number; seenMessageId: number };
