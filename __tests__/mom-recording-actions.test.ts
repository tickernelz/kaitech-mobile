import { recordingVerbs } from '../src/features/mom/recordingActions';
import { rpc } from '../src/api/odoo';
import { recordPage, searchDomain } from '../src/features/mom/records';
import type { RecordingCard } from '../src/features/mom/records';

const card = (change: Partial<RecordingCard> = {}, progress: Partial<RecordingCard['transcription']> = {}): RecordingCard => ({
  id: 7,
  name: 'Kickoff',
  engagement: { id: 1, name: 'Programme' },
  meeting: { id: 2, name: 'Kickoff', start: false },
  department: false,
  state: 'transcribed',
  stateLabel: 'Transcribed',
  sourceLabel: 'Web',
  isDocument: false,
  hasDocument: false,
  filename: 'kickoff.m4a',
  sizeLabel: '1 MB',
  uploadedBy: 'Tester',
  uploadedAt: false,
  isUploader: true,
  failureNote: '',
  larkUrl: false,
  clientDepartments: [],
  transcription: { hasMedia: true, reviewed: false, job: { state: 'done' }, comparison: { state: 'ready' }, ...progress },
  ...change,
});

const team = { canChange: true, isClient: false };

jest.mock('../src/api/odoo', () => ({ rpc: jest.fn() }));

describe('record search', () => {
  it('asks for the state labels once per account and model, while every page is read again', async () => {
    const mocked = jest.mocked(rpc);
    mocked.mockReset();
    mocked.mockImplementation(async (_account, _model, method) =>
      method === 'fields_get' ? { state: { selection: [['transcribed', 'Transcribed']] } } : { length: 1, records: [{ id: 3, name: 'Kickoff', state: 'transcribed', engagement_id: false, meeting_id: false, department_id: false, size_label: '1 MB', uploaded_by_id: false }] },
    );
    const account = { id: 'a1' } as Parameters<typeof recordPage>[0];
    const first = await recordPage(account, 'recordings', '', 40);
    await recordPage(account, 'recordings', 'kick', 80);
    await recordPage({ id: 'a2' } as Parameters<typeof recordPage>[0], 'recordings', '', 40);
    expect(first.lines[0].state).toBe('Transcribed');
    const methods = mocked.mock.calls.map((call) => call[2]);
    expect(methods.filter((one) => one === 'fields_get')).toHaveLength(2);
    expect(methods.filter((one) => one === 'web_search_read')).toHaveLength(3);
  });

  it('looks in every field the web board searches, joined by or', () => {
    expect(searchDomain(['name', 'meeting_id.name', 'department_id.name'], 'hr')).toEqual([
      '|',
      '|',
      ['name', 'ilike', 'hr'],
      ['meeting_id.name', 'ilike', 'hr'],
      ['department_id.name', 'ilike', 'hr'],
    ]);
    expect(searchDomain(['title'], 'x')).toEqual([['title', 'ilike', 'x']]);
  });
});

describe('recording verbs follow the web board', () => {
  it('offers transcribe again, compare and remove on a transcribed recording its uploader owns', () => {
    expect(recordingVerbs(card(), team)).toEqual(['transcribeAgain', 'compare', 'remove']);
  });

  it('offers nothing that changes the recording to a reader', () => {
    expect(recordingVerbs(card({ isUploader: false }), { canChange: false, isClient: false })).toEqual([]);
  });

  it('holds transcription while a run is going and after someone reviewed the transcript', () => {
    expect(recordingVerbs(card({}, { job: { state: 'running' } }), team)).toEqual(['compare', 'remove']);
    expect(recordingVerbs(card({}, { reviewed: true }), team)).toEqual(['compare', 'remove']);
  });

  it('never compares or transcribes a written document, and holds compare while one is pending', () => {
    expect(recordingVerbs(card({ isDocument: true }), team)).toEqual(['remove']);
    expect(recordingVerbs(card({}, { comparison: { state: 'pending' } }), team)).toEqual(['transcribeAgain', 'remove']);
  });

  it('imports from Lark for the team only, and refuses removal while uploading', () => {
    const lark = card({ state: 'awaiting_import', larkUrl: 'https://lark.example/m/1' }, { hasMedia: false });
    expect(recordingVerbs(lark, team)).toEqual(['importLark', 'remove']);
    expect(recordingVerbs(lark, { canChange: true, isClient: true })).toEqual(['remove']);
    expect(recordingVerbs(card({ state: 'uploading' }), team)).toEqual([]);
  });
});
