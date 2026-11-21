export type CallAction = 'mute' | 'camera' | 'flip' | 'share' | 'record' | 'speaker' | 'people' | 'pip' | 'more' | 'hangup' | 'close';

export type ControlInput = {
  phase: 'idle' | 'incoming' | 'outgoing' | 'connecting' | 'active' | 'reconnecting' | 'ended';
  video: boolean;
  cameraOn: boolean;
  sharing: boolean;
  share: boolean;
  record: boolean;
  pip: boolean;
  wide: boolean;
};

export const pillLimit = { phone: 5, wide: 6 } as const;

export function controlsFor(input: ControlInput): { pill: CallAction[]; more: CallAction[] } {
  if (input.phase === 'ended') return { pill: ['close'], more: [] };
  const extras: CallAction[] = [];
  if (input.share && !input.sharing) extras.push('share');
  if (input.record) extras.push('record');
  extras.push('people');
  if (input.pip) extras.push('pip');
  let lead: CallAction[];
  if (input.sharing) lead = ['share', 'mute'];
  else if (input.video) lead = [...(input.cameraOn ? (['flip'] as const) : []), 'mute', 'camera'];
  else lead = ['speaker', 'mute'];
  const more: CallAction[] = [...(input.video || input.sharing ? (['speaker'] as const) : []), ...extras];
  if (input.wide) {
    lead.push('people');
    more.splice(more.indexOf('people'), 1);
  }
  return { pill: [...lead, ...(more.length ? (['more'] as const) : []), 'hangup'], more };
}
