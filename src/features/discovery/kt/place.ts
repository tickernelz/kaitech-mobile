import { createContext, useContext } from 'react';
import type { Account } from '../../../auth/oauth';
import type { TranscriptItem } from '../api';

export type RecordCard = {
  readable: boolean;
  name: string;
  model: string;
  fields: Record<string, { label: string; value: string | number | boolean | null; kind: 'text' | 'number' | 'date' | 'datetime' | 'boolean' }>;
  defaults: string[];
};
export type FileCard = { readable: boolean; name: string; mimetype: string; size: number; picture: boolean; unique: string };
export type BlockReads = { records: Record<string, RecordCard>; files: Record<string, FileCard> };

export type Thread = {
  account: Account | null;
  origin: string;
  items: TranscriptItem[];
  onReply?: (text: string) => void;
};

export type Place = { turnId: number | null; seq: number | null; index: number; reads: BlockReads | null };

export const ThreadContext = createContext<Thread>({ account: null, origin: '', items: [] });

export function useThread(): Thread {
  return useContext(ThreadContext);
}

export function webChatUrl(origin: string): string {
  return origin ? origin.replace(/\/+$/, '') + '/odoo/action-erp_discovery.ck_chat_action' : '';
}
