import { invitationChannels, invitationsFrom, peopleFrom, sessionIdsFrom } from '../src/features/call/odoo';

const ringing = {
  'discuss.channel': [{ id: 145, channel_type: 'chat', name: 'Web, HP', invited_member_ids: [['ADD', [1415]]], rtc_session_ids: [['ADD', [24]]] }],
  'discuss.channel.member': [
    { id: 1414, channel_id: { id: 145, model: 'discuss.channel' }, partner_id: 1122 },
    { id: 1415, channel_id: { id: 145, model: 'discuss.channel' }, partner_id: 1121, rtc_inviting_session_id: 24 },
  ],
  'discuss.channel.rtc.session': [{ id: 24, channel_member_id: 1414, is_camera_on: true, is_muted: false }],
  'res.partner': [
    { id: 1122, name: 'Web Caller' },
    { id: 1121, name: 'Phone Owner' },
  ],
};

describe('call invitations from the Odoo store', () => {
  it('names the caller for the invited phone owner, whatever the caller camera', () => {
    expect(invitationsFrom(ringing, 1121)).toEqual([
      { channelId: 145, callId: 24, callerName: 'Web Caller', callerPartnerId: 1122, channelType: 'chat', channelName: 'Web, HP' },
    ]);
  });

  it('gives the caller nothing to answer', () => {
    expect(invitationsFrom(ringing, 1122)).toEqual([]);
  });

  it('stops ringing once the invitation is gone', () => {
    const cancelled = {
      ...ringing,
      'discuss.channel.member': ringing['discuss.channel.member'].map((member) => ({ ...member, rtc_inviting_session_id: false })),
    };
    expect(invitationsFrom(cancelled, 1121)).toEqual([]);
  });

  it('names a guest caller', () => {
    const fromGuest = {
      ...ringing,
      'discuss.channel.member': [
        { id: 1414, channel_id: 145, guest_id: 9 },
        { id: 1415, channel_id: 145, partner_id: 1121, rtc_inviting_session_id: 24 },
      ],
      'mail.guest': [{ id: 9, name: 'Visitor' }],
    };
    expect(invitationsFrom(fromGuest, 1121)[0]).toMatchObject({ callerName: 'Visitor', callerPartnerId: null });
  });
});

describe('call bus and ping payloads', () => {
  it('finds the channels whose invitations changed on the bus', () => {
    expect(invitationChannels('mail.record/insert', ringing)).toEqual([145]);
    expect(invitationChannels('mail.record/insert', { 'discuss.channel': [{ id: 145, rtc_session_ids: [] }] })).toEqual([]);
    expect(invitationChannels('discuss.channel/new_message', ringing)).toEqual([]);
  });

  it('maps each rtc session to the person behind it', () => {
    expect(peopleFrom(ringing).get(24)).toEqual({ partnerId: 1122, name: 'Web Caller' });
  });

  it('reads added and removed sessions of the call channel only', () => {
    const ping = { 'discuss.channel': [{ id: 145, rtc_session_ids: [['ADD', [24, 25]], ['DELETE', [{ id: 20 }]]] }, { id: 7, rtc_session_ids: [['ADD', [99]]] }] };
    expect(sessionIdsFrom(ping, 145)).toEqual({ added: [24, 25], removed: [20] });
  });
});
