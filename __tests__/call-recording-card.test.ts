import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

const mockAnswers = new Map<number, unknown>();

jest.mock('expo-sqlite/kv-store', () => ({
  getItemSync: () => null,
  setItemSync: () => undefined,
  removeItemSync: () => undefined,
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../src/features/chat/chat', () => ({ chatClient: () => ({ account: { id: 'A' } }) }));
jest.mock('../src/api/odoo', () => ({
  bearer: (_account: unknown, path: string) => {
    const id = Number(path.split('/').pop());
    const answer = mockAnswers.get(id);
    return answer ? Promise.resolve(answer) : Promise.reject(Object.assign(new Error('gone'), { code: 'recording_not_found' }));
  },
}));

require('../src/i18n');
const { RecordingCard } = require('../src/features/call/ui/RecordingCard') as typeof import('../src/features/call/ui/RecordingCard');

function recording(values: Record<string, unknown>) {
  return { recording: { id: 7, channel_id: 12, audio_only: false, started_by: { partner_id: 3, name: 'Budi' }, ...values }, url: null };
}

describe('RecordingCard', () => {
  beforeEach(() => mockAnswers.clear());

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

  it('negative control: an unreachable recording offers a retry', async () => {
    await render(createElement(RecordingCard, { recordingId: 9, mine: false }));
    await waitFor(() => expect(screen.getByTestId('recording-card-9-detail')).toHaveTextContent(/try again|coba lagi/i));
  });
});
