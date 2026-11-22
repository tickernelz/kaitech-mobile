type Rec = Record<string, unknown>;

export type Invitation = {
  channelId: number;
  callId: number;
  callerName: string;
  callerPartnerId: number | null;
  channelType: string;
  channelName: string;
};

export type Person = { partnerId: number | null; name: string };

function isRec(value: unknown): value is Rec {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function records(store: unknown, model: string): Rec[] {
  const value = isRec(store) ? store[model] : undefined;
  return Array.isArray(value) ? value.filter(isRec) : [];
}

export function idOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (isRec(value)) return idOf(value.id);
  return null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function byId(rows: Rec[]): Map<number, Rec> {
  const out = new Map<number, Rec>();
  for (const row of rows) {
    const id = idOf(row.id);
    if (id) out.set(id, row);
  }
  return out;
}

function personOf(member: Rec | undefined, partners: Map<number, Rec>, guests: Map<number, Rec>): Person {
  const partnerId = idOf(member?.partner_id);
  const guestId = idOf(member?.guest_id);
  const name = partnerId ? text(partners.get(partnerId)?.name) : guestId ? text(guests.get(guestId)?.name) : '';
  return { partnerId, name };
}

export function invitationsFrom(store: unknown, partnerId: number): Invitation[] {
  const channels = byId(records(store, 'discuss.channel'));
  const sessions = byId(records(store, 'discuss.channel.rtc.session'));
  const members = byId(records(store, 'discuss.channel.member'));
  const partners = byId(records(store, 'res.partner'));
  const guests = byId(records(store, 'mail.guest'));
  const out: Invitation[] = [];
  for (const member of members.values()) {
    if (idOf(member.partner_id) !== partnerId) continue;
    const callId = idOf(member.rtc_inviting_session_id);
    const channelId = idOf(member.channel_id);
    if (!callId || !channelId) continue;
    const session = sessions.get(callId);
    const caller = personOf(members.get(idOf(session?.channel_member_id) ?? 0), partners, guests);
    const channel = channels.get(channelId);
    out.push({
      channelId,
      callId,
      callerName: caller.name,
      callerPartnerId: caller.partnerId,
      channelType: text(channel?.channel_type) || 'chat',
      channelName: text(channel?.name),
    });
  }
  return out;
}

export function peopleFrom(store: unknown): Map<number, Person> {
  const members = byId(records(store, 'discuss.channel.member'));
  const partners = byId(records(store, 'res.partner'));
  const guests = byId(records(store, 'mail.guest'));
  const out = new Map<number, Person>();
  for (const [id, session] of byId(records(store, 'discuss.channel.rtc.session'))) {
    out.set(id, personOf(members.get(idOf(session.channel_member_id) ?? 0), partners, guests));
  }
  return out;
}

export function sessionIdsFrom(store: unknown, channelId: number): { added: number[]; removed: number[] } {
  const channel = records(store, 'discuss.channel').find((row) => idOf(row.id) === channelId);
  const added: number[] = [];
  const removed: number[] = [];
  const commands = Array.isArray(channel?.rtc_session_ids) ? channel.rtc_session_ids : [];
  for (const command of commands) {
    if (!Array.isArray(command) || !Array.isArray(command[1])) continue;
    const ids = command[1].map(idOf).filter((id): id is number => id !== null);
    if (command[0] === 'ADD') added.push(...ids);
    if (command[0] === 'DELETE') removed.push(...ids);
  }
  return { added, removed };
}

export function invitationChannels(type: string, payload: unknown): number[] {
  if (type !== 'mail.record/insert') return [];
  return records(payload, 'discuss.channel')
    .filter((channel) => 'invited_member_ids' in channel)
    .map((channel) => idOf(channel.id))
    .filter((id): id is number => id !== null);
}
