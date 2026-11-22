import { recordingVerbs } from '../src/features/mom/recordingActions';
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
