import type { MoreAction } from './MoreSheet';
import type { MeetingRecordings, RecordingCard } from './records';

export type RecordingVerb = 'transcribe' | 'importLark' | 'transcribeAgain' | 'compare' | 'remove';

const working = ['queued', 'running', 'retrying'];

export function recordingVerbs(card: RecordingCard, board: Pick<MeetingRecordings, 'canChange' | 'isClient'>): RecordingVerb[] {
  const progress = card.transcription;
  const verbs: RecordingVerb[] = [];
  const busy = working.includes(progress.job.state);
  const mayTranscribe =
    !card.isDocument && board.canChange && !busy && !progress.reviewed && card.state !== 'uploading' && (progress.hasMedia ? true : !board.isClient && !!card.larkUrl);
  if (mayTranscribe) {
    if (!progress.hasMedia) verbs.push('importLark');
    else verbs.push(card.state === 'transcribed' || card.state === 'failed' ? 'transcribeAgain' : 'transcribe');
  }
  if (!card.isDocument && board.canChange && card.state === 'transcribed' && progress.comparison.state !== 'pending') verbs.push('compare');
  if (card.isUploader && card.state !== 'uploading') verbs.push('remove');
  return verbs;
}

export type VerbAction = Omit<MoreAction, 'label'> & { verb: RecordingVerb };

const icons = { transcribe: 'doc', importLark: 'cloudUpload', transcribeAgain: 'retry', compare: 'compass', remove: 'trash' } as const;

export function verbActions(card: RecordingCard, board: Pick<MeetingRecordings, 'canChange' | 'isClient'>, run: (verb: RecordingVerb, card: RecordingCard) => void): VerbAction[] {
  return recordingVerbs(card, board).map((verb) => ({
    key: `${verb}-${card.id}`,
    verb,
    icon: icons[verb],
    tone: verb === 'remove' ? 'danger' : undefined,
    onPress: () => run(verb, card),
  }));
}
