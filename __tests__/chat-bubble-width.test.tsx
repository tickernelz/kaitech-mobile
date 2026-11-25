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

type Box = { left: number; width: number; right: number };
type Scene = { element: ReactElement; width: number; testID: string };

function tree(element: ReactElement): Spec {
  let rendered: ReturnType<typeof create> | undefined;
  act(() => {
    rendered = create(element);
  });
  const json = rendered?.toJSON();
  const roots = (Array.isArray(json) ? json : [json]).filter((node): node is ReactTestRendererJSON => !!node);
  return { style: {}, children: roots.map(spec) };
}

function measure(scenes: Record<string, Scene>): Record<string, Box> {
  const names = Object.keys(scenes);
  const input = JSON.stringify(names.map((name) => ({ width: scenes[name].width, tree: tree(scenes[name].element) })));
  const output = JSON.parse(execFileSync(process.execPath, [join(__dirname, 'fixtures', 'yoga-layout.mjs')], { input, encoding: 'utf8' })) as Record<string, { left: number; width: number }>[];
  return Object.fromEntries(
    names.map((name, index) => {
      const box = output[index][scenes[name].testID];
      return [name, { ...box, right: scenes[name].width - box.left - box.width }];
    }),
  );
}

function message(id: number, body: string): Message {
  return { id, channelId: 7, authorId: 40, author: 'Rina Kusuma', body, date: Date.UTC(2026, 10, 25, 3, 0), type: 'comment', attachments: [], parentId: null, reactions: [] };
}

function bubble(id: number, body: string, mine: boolean, width: number, face: AuthorFace = 'none'): Scene {
  return {
    width,
    testID: 'bubble-' + id,
    element: (
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
      />
    ),
  };
}

function pending(state: 'sending' | 'failed'): Scene {
  const item: Pending = { key: 'k-' + state, accountId: 'a', channelId: 7, text: long, parentId: null, mentions: [], files: [], createdAt: 0, attempts: 1, state, error: null };
  return { width: phone, testID: 'bubble-pending', element: <PendingBubble pending={item} offline={false} onRetry={() => undefined} onDiscard={() => undefined} /> };
}

const lane = (width: number) => Math.min(width, 720 + 2 * gutter) - 2 * gutter;

let box: Record<string, Box>;

beforeAll(() => {
  box = measure({
    mineLong: bubble(1, long, true, phone),
    theirsLong: bubble(2, long, false, phone),
    mineShort: bubble(1, short, true, phone),
    theirsShort: bubble(2, short, false, phone),
    groupShown: bubble(2, long, false, phone, 'show'),
    groupSpaced: bubble(3, long, false, phone, 'space'),
    groupShort: bubble(4, short, false, phone, 'show'),
    sending: pending('sending'),
    failed: pending('failed'),
    tabletMine: bubble(1, long.repeat(3), true, tablet),
    tabletTheirs: bubble(2, long.repeat(3), false, tablet),
  });
});

describe('message bubble width', () => {
  it('keeps a long message of mine to 80% of the lane, on the right, leaving the left side open', () => {
    expect(box.mineLong.width).toBeLessThanOrEqual(Math.ceil(lane(phone) * 0.8));
    expect(box.mineLong.right).toBe(gutter);
    expect(box.mineLong.left).toBeGreaterThanOrEqual(gutter + Math.floor(lane(phone) * 0.2));
  });

  it('caps mine and theirs at the same width in a direct chat, theirs on the left', () => {
    expect(box.theirsLong.width).toBe(box.mineLong.width);
    expect(box.theirsLong.left).toBe(gutter);
    expect(box.theirsLong.right).toBeGreaterThanOrEqual(gutter + Math.floor(lane(phone) * 0.2));
  });

  it('sizes a short message to its text on both sides', () => {
    expect(box.mineShort.width).toBeLessThan(lane(phone) / 2);
    expect(box.theirsShort.width).toBeLessThan(lane(phone) / 2);
    expect(box.mineShort.right).toBe(gutter);
    expect(box.theirsShort.left).toBe(gutter);
  });

  it('keeps a group sender bubble beside the avatar under 80% of the space it can use', () => {
    const { groupShown, groupSpaced, groupShort } = box;
    expect(groupShown.left).toBeGreaterThan(gutter);
    expect(groupShown.width).toBeLessThanOrEqual(Math.ceil((phone - groupShown.left - gutter) * 0.8));
    expect(groupSpaced.left).toBe(groupShown.left);
    expect(groupSpaced.width).toBe(groupShown.width);
    expect(groupShort.width).toBeLessThan(lane(phone) / 2);
  });

  it('keeps a message still sending or failed to the same width as a sent one', () => {
    for (const state of [box.sending, box.failed]) {
      expect(state.width).toBe(box.mineLong.width);
      expect(state.right).toBe(gutter);
    }
  });

  it('centres the lane on a wide screen so a bubble never grows past 576dp', () => {
    expect(box.tabletMine.width).toBe(576);
    expect(box.tabletTheirs.width).toBe(576);
    expect(box.tabletTheirs.left).toBe(Math.round((tablet - 720) / 2));
    expect(box.tabletMine.right).toBe(Math.round((tablet - 720) / 2));
  });
});
