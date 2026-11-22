export type CallAction =
  | 'mute'
  | 'camera'
  | 'flip'
  | 'share'
  | 'record'
  | 'speaker'
  | 'output'
  | 'deafen'
  | 'hand'
  | 'spotlight'
  | 'videoOnly'
  | 'invite'
  | 'people'
  | 'pip'
  | 'more'
  | 'hangup'
  | 'close';

export type MoreGroup = 'sound' | 'video' | 'people';

const groupOf: Partial<Record<CallAction, MoreGroup>> = {
  speaker: 'sound',
  output: 'sound',
  deafen: 'sound',
  share: 'video',
  record: 'video',
  spotlight: 'video',
  videoOnly: 'video',
  pip: 'video',
  hand: 'people',
  invite: 'people',
  people: 'people',
};

export function groupedMore(actions: CallAction[]): { group: MoreGroup; actions: CallAction[] }[] {
  return (['sound', 'video', 'people'] as const)
    .map((group) => ({ group, actions: actions.filter((action) => (groupOf[action] ?? 'video') === group) }))
    .filter((entry) => entry.actions.length > 0);
}

export type ControlInput = {
  phase: 'idle' | 'incoming' | 'outgoing' | 'connecting' | 'active' | 'reconnecting' | 'ended';
  cameraOn: boolean;
  sharing: boolean;
  share: boolean;
  record: boolean;
  pip: boolean;
  wide: boolean;
  invite: boolean;
  crowd: boolean;
};

export const pillLimit = { phone: 5, wide: 6 } as const;

export function controlsFor(input: ControlInput): { pill: CallAction[]; more: CallAction[] } {
  if (input.phase === 'ended') return { pill: ['close'], more: [] };
  const extras: CallAction[] = [];
  const live = input.phase === 'active';
  if (input.share && !input.sharing) extras.push('share');
  if (input.record) extras.push('record');
  if (live && input.crowd) extras.push('spotlight', 'videoOnly');
  if (input.pip) extras.push('pip');
  if (live) extras.push('hand');
  if (live && input.invite) extras.push('invite');
  extras.push('people');
  let lead: CallAction[];
  if (input.sharing) lead = ['share', 'mute'];
  else lead = [input.cameraOn ? 'flip' : 'speaker', 'mute', 'camera'];
  const more: CallAction[] = [
    ...(input.cameraOn || input.sharing ? (['speaker'] as const) : []),
    ...(live ? (['output', 'deafen'] as const) : []),
    ...(input.sharing ? (['camera'] as const) : []),
    ...extras,
  ];
  if (input.wide) {
    lead.push('people');
    more.splice(more.indexOf('people'), 1);
  }
  return { pill: [...lead, ...(more.length ? (['more'] as const) : []), 'hangup'], more };
}
