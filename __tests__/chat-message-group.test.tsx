jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return {
    __esModule: true,
    default: { View },
    Easing: chain(),
    useReducedMotion: () => true,
    useSharedValue: (value: unknown) => ({ get: () => value, set: () => undefined }),
    useAnimatedStyle: (style: () => object) => style(),
    withTiming: (value: unknown) => value,
    withSpring: (value: unknown) => value,
  };
});
jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined } }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../src/features/call/call', () => ({ callState: () => ({ phase: 'idle' }), startCall: jest.fn() }));
jest.mock('../src/features/chat/chat', () => ({ conversationById: () => null, getChat: () => null, useChat: () => null }));
jest.mock('../src/features/chat/ui/MediaControls', () => ({ UploadProgress: () => null }));
jest.mock('../src/features/chat/ui/VoiceNote', () => ({ VoiceNote: () => null }));
jest.mock('../src/features/call/ui/RecordingCard', () => ({ RecordingCard: () => null }));
jest.mock('../src/features/chat/ui/useOpenAttachment', () => ({ useOpenAttachment: () => () => undefined }));
jest.mock('../src/features/chat/ui/useCookie', () => ({ useCookie: () => null }));
jest.mock('../src/features/chat/ui/SwipeReply', () => ({ SwipeReply: ({ children }: { children: unknown }) => children }));
jest.mock('../src/features/chat/ui/coworker/Tickets', () => ({ TicketCard: () => null, TicketAskCard: () => null }));
jest.mock('../src/features/discovery/DecisionCard', () => ({ DecisionCard: () => null }));
jest.mock('../src/features/chat/ui/Avatar', () => {
  const { createElement } = require('react');
  const { View } = require('react-native');
  return { Avatar: ({ size }: { size: number }) => createElement(View, { style: { width: size, height: size } }) };
});
require('../src/i18n');
import { render } from '@testing-library/react-native';
import { View } from 'react-native';
import { act, create } from 'react-test-renderer';
import { buildRows } from '../src/features/chat/rows';
import { createCardStore, type AgentCard, type RecordCard } from '../src/features/chat/coworker';
import type { Message } from '../src/features/chat/types';
import { MessageCards, MessageGroup } from '../src/features/chat/ui/coworker/Cards';
import { MessageBubble, type AuthorFace } from '../src/features/chat/ui/MessageBubble';
import type { Ticket } from '../src/features/chat/tickets';
import { space } from '../src/theme/tokens';
import { measureRendered, type Box } from './fixtures/measure';

const day = (a: number, b: number) => Math.floor(a / 86_400_000) === Math.floor(b / 86_400_000);
const start = Date.UTC(2026, 10, 28, 3);
const long = 'Barang untuk PO/2026/0117 sudah dikirim pagi ini dari gudang utama, tolong cek di penerimaan sore nanti dan kabari kalau ada selisih jumlah atau kemasan rusak.';

function message(id: number, extra: Partial<Message> = {}): Message {
  return { id, channelId: 7, authorId: 40, author: 'Coworker', body: '<p>' + long + '</p>', date: start + id * 1000, type: 'comment', attachments: [], parentId: null, reactions: [], ...extra };
}

const noCards: AgentCard = { packets: [], wardmote: null, handedBy: null, said: '', ticket: null, ticketAsk: null };
const ticket = { id: 5, number: 'TK-2', name: 'Daftar periksa', state: 'done' } as unknown as Ticket;

describe('message groups', () => {
  it('shows the name on the first bubble of a run and the photo and tail on its last', () => {
    const rows = buildRows([message(1), message(2), message(3), message(4, { authorId: 41, author: 'Rina' })], [], [], day).filter((row) => row.kind === 'message');
    expect(rows.map((row) => row.kind === 'message' && [row.showAuthor, row.endsGroup, row.follows?.id ?? null])).toEqual([
      [true, false, null],
      [false, false, 1],
      [false, true, 2],
      [true, true, null],
    ]);
  });

  it('lets a notice end the run before it and start a new one after it', () => {
    const rows = buildRows([message(1), message(2, { type: 'notification', body: '<p>joined</p>' }), message(3)], [], [], day).filter((row) => row.kind === 'message');
    expect(rows.map((row) => row.kind === 'message' && [row.showAuthor, row.endsGroup])).toEqual([
      [true, true],
      [true, true],
      [true, true],
    ]);
  });

  it('breaks a run of one sender at a ticket card: the bubble before it ends a group, the bubble after it starts one', async () => {
    const agents = createCardStore<number, AgentCard>(async () => null);
    const records = createCardStore<string, RecordCard | null>(async () => null);
    agents.put(1, noCards);
    agents.put(2, { ...noCards, ticket });
    agents.put(3, noCards);
    const rows = buildRows([message(1), message(2), message(3)], [], [], day).flatMap((row) => (row.kind === 'message' ? [row] : []));
    const seen: Record<number, [boolean, boolean]> = {};
    await render(
      <View>
        {rows.map((row) => (
          <MessageGroup key={row.key} agents={agents} records={records} follows={row.follows?.id ?? null} followsUrls={[]} self={row.message.id} selfUrls={[]} startsGroup={row.showAuthor} endsGroup={row.endsGroup}>
            {(first, last) => {
              seen[row.message.id] = [first, last];
              return <View />;
            }}
          </MessageGroup>
        ))}
      </View>,
    );
    expect(seen).toEqual({ 1: [true, false], 2: [false, true], 3: [true, true] });
  });
});

function bubble(id: number, mine: boolean, face: AuthorFace, first: boolean, last: boolean) {
  return (
    <MessageBubble
      key={'b' + id}
      message={message(id, mine ? { authorId: 3, author: 'Saya' } : {})}
      mine={mine}
      showAuthor={first && face !== 'none'}
      face={face}
      tail={last}
      startsGroup={first}
      readState={null}
      quote={null}
      origin="https://lab0.example"
      hasThread={false}
      onLongPress={() => undefined}
      onQuotePress={() => undefined}
      onReact={() => undefined}
      onOpenThread={() => undefined}
    />
  );
}

describe('message lane', () => {
  const phone = 411;
  const gutter = space.lg;
  let box: Record<string, Box>;
  let faceSlop: unknown;
  beforeAll(() => {
    const records = createCardStore<string, RecordCard | null>(async () => null);
    const card = (id: number): RecordCard => ({ kind: 'project', model: 'project.project', id, locked: false, title: 'Implementasi lab0', status: 'Berjalan', key: '', parent: '', people: [] });
    records.put('u5', card(5));
    records.put('u6', card(6));
    let rendered: ReturnType<typeof create> | undefined;
    act(() => {
      rendered = create(
        <View>
          {bubble(1, false, 'space', true, false)}
          {bubble(2, false, 'show', false, true)}
          <MessageCards messageId={2} urls={['u5']} mine={false} indent agents={null} records={records} onOpen={() => undefined} />
          {bubble(3, false, 'show', true, true)}
          {bubble(4, true, 'none', true, true)}
          <MessageCards messageId={4} urls={['u6']} mine indent={false} agents={null} records={records} onOpen={() => undefined} />
        </View>,
      );
    });
    box = measureRendered(rendered?.toJSON() ?? null, phone);
    faceSlop = rendered?.root.findAll((node) => node.props.testID === 'message-2-author' && node.props.hitSlop)[0]?.props.hitSlop;
  });

  it('puts a card in the bubble column of its sender, same left edge and same widest width', () => {
    const cardBox = box['record-card-project.project-5'];
    expect(box['bubble-1'].left).toBe(gutter + 32 + space.md);
    expect(box['bubble-2'].left).toBe(box['bubble-1'].left);
    expect(cardBox.left).toBe(box['bubble-2'].left);
    expect(cardBox.width).toBe(box['bubble-2'].width);
  });

  it('keeps my card on my bubble right edge with the screen gutter', () => {
    const cardBox = box['record-card-project.project-6'];
    expect(box['bubble-4'].right).toBe(gutter);
    expect(cardBox.right).toBe(gutter);
    expect(cardBox.width).toBe(box['bubble-4'].width);
  });

  it('gives the photo a 48dp touch area that stays 8dp clear of the bubble beside it', () => {
    const face = box['message-2-author'];
    const slop = faceSlop as { left: number; right: number; top: number; bottom: number };
    expect(face.width + slop.left + slop.right).toBeGreaterThanOrEqual(48);
    expect(face.height + slop.top + slop.bottom).toBeGreaterThanOrEqual(48);
    expect(box['bubble-2'].left - (face.left + face.width + slop.right)).toBeGreaterThanOrEqual(8);
  });

  it('sets the photo beside the bottom of the last bubble, where its tail points', () => {
    const face = box['message-2-author'];
    expect(face.top + face.height).toBe(box['bubble-2'].top + box['bubble-2'].height);
    expect(box['message-1-author']).toBeUndefined();
    expect(face.left).toBe(gutter);
  });

  it('spaces bubbles of one run 4dp apart and a new group 8dp from what ends before it', () => {
    const cardBox = box['record-card-project.project-5'];
    expect(box['bubble-2'].top - (box['bubble-1'].top + box['bubble-1'].height)).toBe(space.xs);
    expect(cardBox.top - (box['bubble-2'].top + box['bubble-2'].height)).toBe(space.xs);
    expect(box['bubble-3'].top - (cardBox.top + cardBox.height)).toBe(space.sm);
  });
});
