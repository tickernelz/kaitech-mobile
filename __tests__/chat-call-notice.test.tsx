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
jest.mock('../src/features/chat/ui/SwipeReply', () => ({ SwipeReply: ({ children }: { children: unknown }) => children }));
require('../src/i18n');
import { measure, type Box, type Scene } from './fixtures/measure';
import type { CallRecord, Message } from '../src/features/chat/types';
import { MessageBubble } from '../src/features/chat/ui/MessageBubble';

const phone = 411;
const tablet = 1194;
const touch = 48;

function notice(id: number, call: CallRecord, width: number, part: '' | '-pill' | '-join'): Scene {
  const message: Message = {
    id,
    channelId: 7,
    authorId: 40,
    author: 'Rina Kusuma',
    body: '<div data-oe-type="call" class="o_mail_notification"></div>',
    date: Date.UTC(2026, 10, 27, 2, 18),
    type: 'notification',
    attachments: [],
    parentId: null,
    reactions: [],
    call,
  };
  return {
    width,
    testID: `call-notice-${id}${part}`,
    element: (
      <MessageBubble
        message={message}
        mine={false}
        showAuthor={false}
        readState={null}
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

const ended: CallRecord = { minutes: 17, ongoing: false };
const live: CallRecord = { minutes: 0, ongoing: true };
let box: Record<string, Box>;

beforeAll(() => {
  box = measure({
    endedRow: notice(1, ended, phone, ''),
    endedPill: notice(1, ended, phone, '-pill'),
    liveRow: notice(2, live, phone, ''),
    livePill: notice(2, live, phone, '-pill'),
    liveJoin: notice(2, live, phone, '-join'),
    tabletEndedPill: notice(1, ended, tablet, '-pill'),
    tabletLivePill: notice(2, live, tablet, '-pill'),
  });
});

describe('call notice pills in a thread', () => {
  it('draws a call in progress and a finished call as pills of one height', () => {
    expect(box.livePill.height).toBe(box.endedPill.height);
    expect(box.tabletLivePill.height).toBe(box.tabletEndedPill.height);
  });

  it('gives both notices the same row, so the thread keeps one rhythm around them', () => {
    expect(box.liveRow.height).toBe(box.endedRow.height);
  });

  it('keeps Join at least 48 dp to touch without growing the pill, and inside its own row', () => {
    expect(box.liveJoin.height).toBeGreaterThanOrEqual(touch);
    expect(box.liveJoin.width).toBeGreaterThanOrEqual(touch);
    expect(box.liveJoin.height).toBeGreaterThan(box.livePill.height);
    expect(box.liveJoin.top).toBeGreaterThanOrEqual(box.liveRow.top);
    expect(box.liveJoin.top + box.liveJoin.height).toBeLessThanOrEqual(box.liveRow.top + box.liveRow.height);
  });
});
