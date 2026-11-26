import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

const mockAnswers = new Map<number, unknown>();
const mockAsked: number[] = [];
const mockForgotten: ((id: string) => void)[] = [];

jest.mock('expo-sqlite/kv-store', () => ({
  getItemSync: () => null,
  setItemSync: () => undefined,
  removeItemSync: () => undefined,
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
const mockClient = { account: { id: 'A' } };
jest.mock('../src/features/chat/chat', () => ({ chatClient: () => mockClient }));
jest.mock('../src/auth/session', () => ({ onAccountForgotten: (listener: (id: string) => void) => mockForgotten.push(listener) }));
jest.mock('../src/api/odoo', () => ({
  bearer: (_account: unknown, path: string) => {
    const id = Number(path.split('/').pop());
    mockAsked.push(id);
    const answer = mockAnswers.get(id);
    if (answer instanceof Promise) return answer;
    return answer ? Promise.resolve(answer) : Promise.reject(Object.assign(new Error('gone'), { code: 'recording_not_found' }));
  },
}));

require('../src/i18n');
const { RecordingCard } = require('../src/features/call/ui/RecordingCard') as typeof import('../src/features/call/ui/RecordingCard');

function recording(values: Record<string, unknown>) {
  return { recording: { id: 7, channel_id: 12, audio_only: false, started_by: { partner_id: 3, name: 'Budi' }, ...values }, url: null };
}

describe('RecordingCard', () => {
  beforeEach(() => {
    mockAnswers.clear();
    mockAsked.length = 0;
  });

  it('shows the duration and the automatic deletion date of a saved recording', async () => {
    mockAnswers.set(7, { ...recording({ state: 'done', duration: 125, expires_at: '2026-12-05 02:00:00' }), url: 'https://r2.test/7.mp4' });
    await render(createElement(RecordingCard, { recordingId: 7, mine: false }));
    await waitFor(() => expect(screen.getByTestId('recording-card-7-detail')).toHaveTextContent(/2:05/));
    expect(screen.getByTestId('recording-card-7-detail')).toHaveTextContent(/2026/);
  });

  it('shows a deleted recording without an error', async () => {
    mockAnswers.set(8, recording({ id: 8, state: 'deleted', duration: 125, deleted_at: '2026-12-05 02:00:00' }));
    await render(createElement(RecordingCard, { recordingId: 8, mine: true }));
    await waitFor(() => expect(screen.getByTestId('recording-card-8-detail')).toHaveTextContent(/2026/));
    expect(screen.getByTestId('recording-card-8-detail')).not.toHaveTextContent(/try again|coba lagi/i);
  });

  it('shows a saved recording at once when its row is drawn again, without asking the server', async () => {
    mockAnswers.set(10, { ...recording({ id: 10, state: 'done', duration: 65 }), url: 'https://r2.test/10.mp4' });
    const first = await render(createElement(RecordingCard, { recordingId: 10, mine: false }));
    await waitFor(() => expect(screen.getByTestId('recording-card-10-detail')).toHaveTextContent(/1:05/));
    await first.unmount();
    await render(createElement(RecordingCard, { recordingId: 10, mine: false }));
    expect(screen.getByTestId('recording-card-10-detail')).toHaveTextContent(/1:05/);
    expect(mockAsked.filter((id) => id === 10)).toHaveLength(1);
  });

  it('never shows the previous recording when a recycled row gets another one', async () => {
    mockAnswers.set(11, { ...recording({ id: 11, state: 'done', duration: 61 }), url: 'https://r2.test/11.mp4' });
    let answer12: (value: unknown) => void = () => undefined;
    mockAnswers.set(12, new Promise((resolve) => (answer12 = resolve)));
    const view = await render(createElement(RecordingCard, { recordingId: 11, mine: false }));
    await waitFor(() => expect(screen.getByTestId('recording-card-11-detail')).toHaveTextContent(/1:01/));
    await view.rerender(createElement(RecordingCard, { recordingId: 12, mine: false }));
    expect(screen.getByTestId('recording-card-12-detail')).not.toHaveTextContent(/1:01/);
    answer12({ ...recording({ id: 12, state: 'done', duration: 192 }), url: 'https://r2.test/12.mp4' });
    await waitFor(() => expect(screen.getByTestId('recording-card-12-detail')).toHaveTextContent(/3:12/));
  });

  it('forgets saved recordings of an account that signs out', async () => {
    mockAnswers.set(13, { ...recording({ id: 13, state: 'done', duration: 70 }), url: 'https://r2.test/13.mp4' });
    const first = await render(createElement(RecordingCard, { recordingId: 13, mine: false }));
    await waitFor(() => expect(screen.getByTestId('recording-card-13-detail')).toHaveTextContent(/1:10/));
    await first.unmount();
    mockForgotten.forEach((listener) => listener('A'));
    await render(createElement(RecordingCard, { recordingId: 13, mine: false }));
    await waitFor(() => expect(screen.getByTestId('recording-card-13-detail')).toHaveTextContent(/1:10/));
    expect(mockAsked.filter((id) => id === 13)).toHaveLength(2);
  });

  it('negative control: an unreachable recording offers a retry', async () => {
    await render(createElement(RecordingCard, { recordingId: 9, mine: false }));
    await waitFor(() => expect(screen.getByTestId('recording-card-9-detail')).toHaveTextContent(/try again|coba lagi/i));
  });
});
