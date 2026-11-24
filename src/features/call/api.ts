import type { Account } from '../../auth/oauth';
import { bearer, route } from '../../api/odoo';

export type Joined = { sessionId: number; channelId: number; url: string; token: string };

export type SessionValues = { is_muted?: boolean; is_camera_on?: boolean; is_deaf?: boolean; is_screen_sharing_on?: boolean };

export class CallClient {
  constructor(readonly account: Account) {}

  async join(channelId: number): Promise<Joined> {
    const answer = await bearer<Record<string, unknown>>(this.account, '/kaitech_mobile/call/join', {
      method: 'POST',
      body: { channel_id: channelId, camera: false },
    });
    const sessionId = Number(answer.session_id);
    if (!Number.isInteger(sessionId) || typeof answer.url !== 'string' || typeof answer.token !== 'string') {
      throw new Error('call_join_invalid');
    }
    return { sessionId, channelId, url: answer.url, token: answer.token };
  }

  ping(channelId: number, sessionId: number, known: number[]) {
    return route<Record<string, unknown>>(this.account, '/discuss/channel/ping', {
      channel_id: channelId,
      rtc_session_id: sessionId,
      check_rtc_session_ids: known,
    });
  }

  update(sessionId: number, values: SessionValues) {
    return route(this.account, '/mail/rtc/session/update_and_broadcast', { session_id: sessionId, values });
  }

  leave(channelId: number, sessionId: number) {
    return route(this.account, '/mail/rtc/channel/leave_call', { channel_id: channelId, session_id: sessionId });
  }

  decline(channelId: number) {
    return route(this.account, '/mail/rtc/channel/cancel_call_invitation', { channel_id: channelId });
  }

  invitations(channelId: number | null, selfChannelIds: number[] = []) {
    return route<Record<string, unknown>>(this.account, '/mail/data', {
      fetch_params: channelId ? [['discuss.channel', [channelId]]] : [['discuss.channel', selfChannelIds]],
    });
  }
}
