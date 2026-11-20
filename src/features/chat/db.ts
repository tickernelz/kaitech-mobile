import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import type { Conversation, Message, Pending } from './types';

const keepPerChannel = 200;

let opened: SQLiteDatabase | null = null;

function db(): SQLiteDatabase {
  if (opened) return opened;
  opened = openDatabaseSync('chat.db');
  opened.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS conversations (account TEXT NOT NULL, id INTEGER NOT NULL, activity INTEGER NOT NULL, json TEXT NOT NULL, PRIMARY KEY (account, id));
    CREATE TABLE IF NOT EXISTS messages (account TEXT NOT NULL, channel INTEGER NOT NULL, id INTEGER NOT NULL, json TEXT NOT NULL, PRIMARY KEY (account, id));
    CREATE INDEX IF NOT EXISTS messages_by_channel ON messages (account, channel, id);
    CREATE TABLE IF NOT EXISTS outbox (key TEXT PRIMARY KEY NOT NULL, account TEXT NOT NULL, created INTEGER NOT NULL, json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS drafts (account TEXT NOT NULL, channel INTEGER NOT NULL, json TEXT NOT NULL, PRIMARY KEY (account, channel));
  `);
  return opened;
}

function parse<T>(rows: { json: string }[]): T[] {
  const out: T[] = [];
  for (const row of rows) {
    try {
      out.push(JSON.parse(row.json) as T);
    } catch {
      continue;
    }
  }
  return out;
}

export function cachedConversations(account: string): Conversation[] {
  return parse<Conversation>(db().getAllSync<{ json: string }>('SELECT json FROM conversations WHERE account = ? ORDER BY activity DESC, id DESC', [account]));
}

export async function storeConversations(account: string, conversations: Conversation[], replace: boolean) {
  await db().withTransactionAsync(async () => {
    if (replace) await db().runAsync('DELETE FROM conversations WHERE account = ?', [account]);
    for (const conversation of conversations) {
      await db().runAsync('INSERT OR REPLACE INTO conversations (account, id, activity, json) VALUES (?, ?, ?, ?)', [
        account,
        conversation.id,
        conversation.activityAt,
        JSON.stringify(conversation),
      ]);
    }
  });
}

export function cachedMessages(account: string, channel: number): Message[] {
  return parse<Message>(
    db().getAllSync<{ json: string }>('SELECT json FROM (SELECT id, json FROM messages WHERE account = ? AND channel = ? ORDER BY id DESC LIMIT ?) ORDER BY id', [account, channel, keepPerChannel]),
  );
}

export async function storeMessages(account: string, channel: number, messages: Message[]) {
  if (!messages.length) return;
  await db().withTransactionAsync(async () => {
    for (const message of messages) {
      await db().runAsync('INSERT OR REPLACE INTO messages (account, channel, id, json) VALUES (?, ?, ?, ?)', [account, channel, message.id, JSON.stringify(message)]);
    }
    await db().runAsync(
      'DELETE FROM messages WHERE account = ? AND channel = ? AND id < (SELECT MIN(id) FROM (SELECT id FROM messages WHERE account = ? AND channel = ? ORDER BY id DESC LIMIT ?))',
      [account, channel, account, channel, keepPerChannel],
    );
  });
}

export function pendingFor(account: string): Pending[] {
  return parse<Pending>(db().getAllSync<{ json: string }>('SELECT json FROM outbox WHERE account = ? ORDER BY created', [account]));
}

export async function savePending(item: Pending) {
  await db().runAsync('INSERT OR REPLACE INTO outbox (key, account, created, json) VALUES (?, ?, ?, ?)', [item.key, item.accountId, item.createdAt, JSON.stringify(item)]);
}

export async function removePending(key: string) {
  await db().runAsync('DELETE FROM outbox WHERE key = ?', [key]);
}

export type Draft = { text: string; parentId: number | null; mentions: { id: number; name: string; token: string | null }[] };

export function cachedDraft(account: string, channel: number): Draft | null {
  const row = db().getFirstSync<{ json: string }>('SELECT json FROM drafts WHERE account = ? AND channel = ?', [account, channel]);
  return row ? (parse<Draft>([row])[0] ?? null) : null;
}

export function storeDraft(account: string, channel: number, draft: Draft | null) {
  if (!draft || (!draft.text.trim() && !draft.parentId)) {
    void db().runAsync('DELETE FROM drafts WHERE account = ? AND channel = ?', [account, channel]);
    return;
  }
  void db().runAsync('INSERT OR REPLACE INTO drafts (account, channel, json) VALUES (?, ?, ?)', [account, channel, JSON.stringify(draft)]);
}

export async function forgetAccount(account: string) {
  await db().withTransactionAsync(async () => {
    for (const table of ['conversations', 'messages', 'outbox', 'drafts']) {
      await db().runAsync(`DELETE FROM ${table} WHERE account = ?`, [account]);
    }
  });
}
