jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined } }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../src/features/call/call', () => ({ callState: () => ({ phase: 'idle' }), startCall: jest.fn() }));
jest.mock('../src/features/chat/chat', () => ({ conversationById: () => null, getChat: () => null }));
jest.mock('../src/features/chat/ui/MediaControls', () => ({ UploadProgress: () => null }));
jest.mock('../src/features/chat/ui/VoiceNote', () => ({ VoiceNote: () => null }));
jest.mock('../src/features/call/ui/RecordingCard', () => ({ RecordingCard: () => null }));
jest.mock('../src/features/chat/ui/useOpenAttachment', () => ({ useOpenAttachment: () => () => undefined }));
jest.mock('../src/features/chat/ui/useCookie', () => ({ useCookie: () => null }));
jest.mock('../src/features/chat/ui/coworker/Cards', () => ({ AgentSaid: () => null }));
jest.mock('../src/features/chat/ui/Avatar', () => {
  const { createElement } = require('react');
  const { View } = require('react-native');
  return { Avatar: ({ size }: { size: number }) => createElement(View, { style: { width: size, height: size } }) };
});
require('../src/i18n');
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRendererJSON } from 'react-test-renderer';
import type { Message, Pending } from '../src/features/chat/types';
import { MessageBubble, PendingBubble, type AuthorFace } from '../src/features/chat/ui/MessageBubble';

type Spec = { style: Record<string, unknown>; testID?: string; text?: string; children: Spec[] };

const phone = 411;
const tablet = 1194;
const gutter = 16;
const short = 'Oke, siap';
const long = 'Barang untuk PO/2026/0117 sudah dikirim pagi ini dari gudang utama, tolong cek di penerimaan sore nanti dan kabari kalau ada selisih jumlah atau kemasan rusak.';

function textOf(node: ReactTestRendererJSON | string): string {
  return typeof node === 'string' ? node : (node.children ?? []).map(textOf).join('');
}

function spec(node: ReactTestRendererJSON): Spec {
  const style = (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;
  const testID = node.props.testID as string | undefined;
  if (node.type === 'Text') return { style, testID, text: textOf(node), children: [] };
  return { style, testID, children: (node.children ?? []).filter((child): child is ReactTestRendererJSON => typeof child !== 'string').map(spec) };
}

function layout(element: ReactElement, width: number): Record<string, { left: number; width: number }> {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(element);
  });
  const json = tree?.toJSON();
  const roots = (Array.isArray(json) ? json : [json]).filter((node): node is ReactTestRendererJSON => !!node);
  const input = JSON.stringify({ width, tree: { style: {}, children: roots.map(spec) } });
  const output = execFileSync(process.execPath, [join(__dirname, 'fixtures', 'yoga-layout.mjs')], { input, encoding: 'utf8' });
  return JSON.parse(output);
}

function message(id: number, body: string): Message {
  return { id, channelId: 7, authorId: 40, author: 'Rina Kusuma', body, date: Date.UTC(2026, 10, 25, 3, 0), type: 'comment', attachments: [], parentId: null, reactions: [] };
}

function bubble(id: number, body: string, mine: boolean, width: number, face: AuthorFace = 'none') {
  const box = layout(
    <MessageBubble
      message={message(id, body)}
      mine={mine}
      showAuthor={face === 'show'}
      face={face}
      readState={mine ? 'sent' : null}
      quote={null}
      origin="https://lab0.example"
      hasThread={false}
      onLongPress={() => undefined}
      onQuotePress={() => undefined}
      onReact={() => undefined}
      onOpenThread={() => undefined}
    />,
    width,
  )['bubble-' + id];
  return { ...box, right: width - box.left - box.width };
}

const lane = (width: number) => Math.min(width, 720 + 2 * gutter) - 2 * gutter;

describe('message bubble width', () => {
  it('keeps a long message of mine to 80% of the lane, on the right, leaving the left side open', () => {
    const mine = bubble(1, long, true, phone);
    expect(mine.width).toBeLessThanOrEqual(Math.ceil(lane(phone) * 0.8));
    expect(mine.right).toBe(gutter);
    expect(mine.left).toBeGreaterThanOrEqual(gutter + Math.floor(lane(phone) * 0.2));
  });

  it('caps mine and theirs at the same width in a direct chat, theirs on the left', () => {
    const mine = bubble(1, long, true, phone);
    const theirs = bubble(2, long, false, phone);
    expect(theirs.width).toBe(mine.width);
    expect(theirs.left).toBe(gutter);
    expect(theirs.right).toBeGreaterThanOrEqual(gutter + Math.floor(lane(phone) * 0.2));
  });

  it('sizes a short message to its text on both sides', () => {
    const mine = bubble(1, short, true, phone);
    const theirs = bubble(2, short, false, phone);
    expect(mine.width).toBeLessThan(lane(phone) / 2);
    expect(theirs.width).toBeLessThan(lane(phone) / 2);
    expect(mine.right).toBe(gutter);
    expect(theirs.left).toBe(gutter);
  });

  it('keeps a group sender bubble beside the avatar under 80% of the space it can use', () => {
    const shown = bubble(2, long, false, phone, 'show');
    const spaced = bubble(3, long, false, phone, 'space');
    expect(shown.left).toBeGreaterThan(gutter);
    expect(shown.width).toBeLessThanOrEqual(Math.ceil((phone - shown.left - gutter) * 0.8));
    expect(spaced.left).toBe(shown.left);
    expect(spaced.width).toBe(shown.width);
    expect(bubble(4, short, false, phone, 'show').width).toBeLessThan(lane(phone) / 2);
  });

  it('keeps a message still sending or failed to the same width as a sent one', () => {
    const sent = bubble(1, long, true, phone);
    for (const state of ['sending', 'failed'] as const) {
      const pending: Pending = { key: 'k-' + state, accountId: 'a', channelId: 7, text: long, parentId: null, mentions: [], files: [], createdAt: 0, attempts: 1, state, error: null };
      const tree = layout(<PendingBubble pending={pending} offline={false} onRetry={() => undefined} onDiscard={() => undefined} />, phone);
      const box = tree['bubble-pending'];
      expect(box.width).toBe(sent.width);
      expect(phone - box.left - box.width).toBe(gutter);
    }
  });

  it('centres the lane on a wide screen so a bubble never grows past 576dp', () => {
    const mine = bubble(1, long.repeat(3), true, tablet);
    const theirs = bubble(2, long.repeat(3), false, tablet);
    expect(mine.width).toBe(576);
    expect(theirs.width).toBe(576);
    expect(theirs.left).toBe(Math.round((tablet - 720) / 2));
    expect(mine.right).toBe(Math.round((tablet - 720) / 2));
  });
});
