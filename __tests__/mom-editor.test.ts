import { speakerMappings, visibleSegments, type EditorSegment } from '../src/features/mom/editor';

jest.mock('../src/api/odoo', () => ({ rpc: jest.fn(), sessionCookie: jest.fn() }));
jest.mock('../src/features/chat/files', () => ({ downloadForOpening: jest.fn() }));

const line = (id: number, change: Partial<EditorSegment>): EditorSegment => ({
  id,
  start: id,
  clock: '0:0' + id,
  speaker: 'S1',
  person: '',
  text: 'halo',
  transcribedText: 'halo',
  corrected: false,
  speakerChanged: false,
  flagged: false,
  altText: '',
  verdict: '',
  verdictLabel: '',
  reason: '',
  doubts: [],
  ...change,
});

const lines = [
  line(1, { flagged: true }),
  line(2, { doubts: [9] }),
  line(3, { verdict: 'divergent', speaker: 'S2', person: 'Ani' }),
  line(4, { speakerChanged: true, text: 'harga naik' }),
  line(5, { corrected: true }),
];

describe('transcript editor filters follow the web', () => {
  it('filters by mark, speaker and words in the text or the person', () => {
    const ids = (list: EditorSegment[]) => list.map((one) => one.id);
    expect(ids(visibleSegments(lines, 'flagged', '', ''))).toEqual([1]);
    expect(ids(visibleSegments(lines, 'doubts', '', ''))).toEqual([2]);
    expect(ids(visibleSegments(lines, 'different', '', ''))).toEqual([3]);
    expect(ids(visibleSegments(lines, 'changed', '', ''))).toEqual([4, 5]);
    expect(ids(visibleSegments(lines, 'all', 'S2', ''))).toEqual([3]);
    expect(ids(visibleSegments(lines, 'all', '', 'ANI'))).toEqual([3]);
    expect(ids(visibleSegments(lines, 'all', '', 'harga'))).toEqual([4]);
  });
});

describe('speaker map', () => {
  it('sends only changed labels, so two labels can swap in one save', () => {
    expect(speakerMappings(['S1', 'S2', 'S3'], { S1: 'S2', S2: 'S1', S3: 'S3' })).toEqual([
      { from: 'S1', to: 'S2' },
      { from: 'S2', to: 'S1' },
    ]);
    expect(speakerMappings(['S1'], { S1: '  ' })).toEqual([]);
  });
});
