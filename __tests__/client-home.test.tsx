import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '../src/api/odoo';
import { homeFrom, type ProgrammeBlock } from '../src/features/client/home';

require('../src/i18n');

const mockHome = jest.fn<Promise<ProgrammeBlock[]>, []>();
const mockCorrect = jest.fn<Promise<void>, [unknown, number, string]>();
const mockNotify = jest.fn();
const mockPrompt = jest.fn<Promise<string | null>, []>();
const mockOnline = { value: true };
let mockAccount = { id: 'u31_a', origin: 'https://lab0.test', db: 'lab0', userId: 31, partnerId: 41, deviceId: 5, name: 'Klien', login: 'klien@example.com', signedInAt: 0, access: { role: 'external', capabilities: ['client.home'] } };

jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined } }));
jest.mock('expo-network', () => ({ useNetworkState: () => (mockOnline.value ? { isConnected: true, isInternetReachable: true } : { isConnected: false }) }));
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) };
});
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return { __esModule: true, default: { View }, Easing: chain(), useReducedMotion: () => true, useSharedValue: (value: unknown) => ({ get: () => value, set: () => undefined }), useAnimatedStyle: (style: () => object) => style(), withTiming: (value: unknown) => value };
});
jest.mock('react-native/Libraries/Components/RefreshControl/RefreshControl', () => {
  const { View } = jest.requireActual('react-native');
  const Control = (props: object) => <View {...props} />;
  return { __esModule: true, default: Control };
});
jest.mock('../src/auth/session', () => ({ useSession: () => ({ active: mockAccount }), onAccountForgotten: () => undefined, accountKnown: () => true, tokenFor: async () => 't' }));
jest.mock('../src/screens/HeaderActions', () => ({ HeaderActions: () => null }));
jest.mock('../src/ui/dialog', () => ({ notify: (text: string) => mockNotify(text), prompt: () => mockPrompt() }));
jest.mock('../src/features/chat/media/viewer', () => ({ openPdf: jest.fn() }));
jest.mock('../src/features/client/api', () => ({
  clientHome: () => mockHome(),
  askCorrection: (account: unknown, id: number, words: string) => mockCorrect(account, id, words),
  handOver: jest.fn(),
  reportDone: jest.fn(),
  interviewUrl: jest.fn(),
  minutesFilePath: (id: number) => `/kaitech_mobile/client/minutes/${id}/file`,
}));

const raw = {
  programmes: [
    {
      engagement_id: 51,
      programme: 'PT Sumber Makmur - ERP Discovery',
      stage: 'Discovery',
      profile_id: 8,
      person: 'Klien',
      interviews: [{ invite_id: 3, questions_left: 4, summaries_waiting: 0, expires_on: '2026-12-02', link: 'https://x/secret' }],
      documents: [
        { request_id: 11, document: 'Daftar vendor aktif', why: 'Untuk proses pembelian', asked_on: '2026-11-25', handed_over: '', handed_over_unreadable: false, handed_over_on: '' },
        { request_id: 12, document: 'Struktur approval', why: '', asked_on: '2026-11-25', handed_over: 'approval.pdf', handed_over_unreadable: false, handed_over_on: '2026-11-26' },
      ],
      data: [],
      minutes: [
        { meeting_id: 21, subject: 'Rapat kickoff', kind: 'Kickoff', held_on: '2026-11-20', number: 'MOM-1', state: 'open', corrections_until: '2026-11-28', download: '/my/discovery/minutes/21/download' },
        { meeting_id: 22, subject: 'Rapat proses', kind: 'Workshop', held_on: '2026-11-22', number: 'MOM-2', state: 'approved', corrections_until: '', download: '' },
      ],
      todos: [{ action_id: 31, name: 'Kirim struktur approval', due: '2026-12-01', late: false, meeting: 'Rapat kickoff', meeting_on: '2026-11-20', reported_on: '', sent_back: false }],
      published: 3,
      team: [{ person: 'Rina', waiting: { total: 2 } }, { person: 'Budi', waiting: { total: 1 } }, { person: 'Sari', waiting: { total: 0 } }],
      waiting: { total: 4 },
      next_due: '2026-11-28',
    },
    { engagement_id: 52, programme: 'PT Lain', stage: '', interviews: [], documents: [], data: [], minutes: [], todos: [], published: 0, team: [] },
  ],
};

let run = 0;
beforeEach(() => {
  run += 1;
  mockAccount = { ...mockAccount, id: `u31_run${run}` };
  mockOnline.value = true;
  mockHome.mockReset();
  mockCorrect.mockReset();
  mockNotify.mockReset();
  mockPrompt.mockReset();
});

describe('homeFrom', () => {
  it('drops rows without an id and never keeps the interview link that carries a token', () => {
    const blocks = homeFrom({ programmes: [{ ...raw.programmes[0], documents: [{ document: 'no id' }, ...raw.programmes[0].documents] }] });
    expect(blocks[0].documents.map((row) => row.requestId)).toEqual([11, 12]);
    expect(JSON.stringify(blocks)).not.toContain('secret');
  });

  it('refuses an answer that is not a home', () => {
    expect(() => homeFrom({ error: 'forbidden' })).toThrow('home_invalid');
  });
});

describe('ClientHome', () => {
  const { ClientHome } = require('../src/features/client/ClientHome') as typeof import('../src/features/client/ClientHome');

  it('shows one part per Programme with only what waits, and a quiet line for a Programme with nothing', async () => {
    mockHome.mockResolvedValue(homeFrom(raw));
    await render(<ClientHome />);
    await waitFor(() => expect(screen.getByText('PT Sumber Makmur - ERP Discovery')).toBeTruthy());
    expect(screen.getByText('Stage: Discovery')).toBeTruthy();
    expect(screen.getByTestId('home-send-11')).toBeTruthy();
    expect(screen.queryByTestId('home-send-12')).toBeNull();
    expect(screen.getByText('Sent Nov 26, your consultant is checking it')).toBeTruthy();
    expect(screen.getByTestId('home-correct-21')).toBeTruthy();
    expect(screen.queryByTestId('home-correct-22')).toBeNull();
    expect(screen.getByTestId('home-report-31')).toBeTruthy();
    expect(screen.getByTestId('home-published-51')).toHaveTextContent('3 documents published');
    expect(screen.getByTestId('home-team-51')).toHaveTextContent('Waiting for other members: Rina 2, Budi 1');
    expect(screen.queryByText('Data permission')).toBeNull();
    expect(screen.getByTestId('home-quiet-52')).toHaveTextContent('Nothing is waiting for you in this programme.');
  });

  it('names an interview by its subject and says where it stands, never how many questions are left', async () => {
    const interviews = [
      { invite_id: 3, questions_left: 0, summaries_waiting: 0, topic: 'Rantai pembelian', stage: 'answered', expires_on: '2026-12-05' },
      { invite_id: 4, questions_left: 0, summaries_waiting: 0, expires_on: '' },
    ];
    mockHome.mockResolvedValue(homeFrom({ programmes: [{ ...raw.programmes[0], interviews }] }));
    await render(<ClientHome />);
    await waitFor(() => expect(screen.getByTestId('home-interview-3')).toBeTruthy());
    expect(screen.getByTestId('home-interview-3')).toHaveTextContent('Rantai pembelianAll answered, your consultant is reviewing · open until Dec 5');
    expect(screen.getByTestId('home-interview-4')).toHaveTextContent('Interview');
    expect(screen.queryByText(/questions? left/)).toBeNull();
  });

  it('says so when no Programme is open yet', async () => {
    mockHome.mockResolvedValue([]);
    await render(<ClientHome />);
    await waitFor(() => expect(screen.getByTestId('home-empty')).toBeTruthy());
    expect(screen.getByText('No programme yet')).toBeTruthy();
  });

  it('shows a failed load with a retry that loads again', async () => {
    mockHome.mockRejectedValueOnce(new ApiError('server', 500));
    await render(<ClientHome />);
    await waitFor(() => expect(screen.getByTestId('home-error')).toBeTruthy());
    mockHome.mockResolvedValue(homeFrom(raw));
    await fireEvent.press(screen.getByText('Try again'));
    await waitFor(() => expect(screen.getByText('PT Sumber Makmur - ERP Discovery')).toBeTruthy());
  });

  it('shows the offline state instead of an empty home', async () => {
    mockOnline.value = false;
    mockHome.mockRejectedValue(new TypeError('Network request failed'));
    await render(<ClientHome />);
    await waitFor(() => expect(screen.getByTestId('home-offline')).toBeTruthy());
    expect(screen.queryByTestId('home-empty')).toBeNull();
  });

  it('shows the reason the server gives when it refuses a correction', async () => {
    mockHome.mockResolvedValue(homeFrom(raw));
    mockPrompt.mockResolvedValue('Nama vendor salah');
    mockCorrect.mockRejectedValue(new ApiError('refused', 409, 'Waktu koreksi notulen ini sudah berakhir.'));
    await render(<ClientHome />);
    await waitFor(() => expect(screen.getByTestId('home-correct-21')).toBeTruthy());
    await act(async () => fireEvent.press(screen.getByTestId('home-correct-21')));
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('Waktu koreksi notulen ini sudah berakhir.'));
    expect(mockCorrect).toHaveBeenCalledWith(expect.anything(), 21, 'Nama vendor salah');
  });
});
