import { bearer, bearerFile } from '../../api/odoo';
import type { Account } from '../../auth/oauth';
import { homeFrom, type ProgrammeBlock } from './home';

export async function clientHome(account: Account): Promise<ProgrammeBlock[]> {
  return homeFrom(await bearer<unknown>(account, '/kaitech_mobile/client/home'));
}

export async function handOver(account: Account, requestId: number, uri: string, mimeType: string): Promise<void> {
  await bearerFile<unknown>(account, `/kaitech_mobile/client/documents/${requestId}/hand-over`, uri, mimeType);
}

export async function askCorrection(account: Account, meetingId: number, words: string): Promise<void> {
  await bearer<unknown>(account, `/kaitech_mobile/client/minutes/${meetingId}/correct`, { method: 'POST', body: { words } });
}

export async function reportDone(account: Account, actionId: number, note: string): Promise<void> {
  await bearer<unknown>(account, `/kaitech_mobile/client/todos/${actionId}/report`, { method: 'POST', body: { note } });
}

export async function interviewUrl(account: Account, inviteId: number): Promise<string> {
  const answer = await bearer<{ url?: unknown }>(account, `/kaitech_mobile/client/interviews/${inviteId}/open`, { method: 'POST', body: {} });
  if (typeof answer.url !== 'string' || !answer.url) throw new Error('interview_invalid');
  return answer.url.startsWith('/') ? `${account.origin}${answer.url}` : answer.url;
}

export function minutesFilePath(meetingId: number): string {
  return `/kaitech_mobile/client/minutes/${meetingId}/file`;
}
