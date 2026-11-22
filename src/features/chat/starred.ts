import { route, rpc } from '../../api/odoo';
import { getChat } from './chat';
import { run } from './messageActions';
import { messagesFromStore } from './odoo';
import { setStarredCount } from './starredCount';
import type { Message } from './types';

const LIMIT = 100;

export function starredFrom(page: unknown, myPartnerId: number): Message[] {
  const data = page && typeof page === 'object' ? (page as Record<string, unknown>).data : undefined;
  return messagesFromStore(data, myPartnerId).sort((a, b) => b.id - a.id);
}

export function refreshStarred() {
  return run(async (account) => {
    const found = await rpc<unknown>(account, 'mail.message', 'search_count', [[['starred_partner_ids', 'in', [getChat().partnerId]], ['model', '=', 'discuss.channel']]]);
    const next = typeof found === 'number' ? found : 0;
    setStarredCount(next);
    return next;
  });
}

export function starredMessages() {
  return run(async (account) => {
    const page = await route<unknown>(account, '/mail/starred/messages', { fetch_params: { limit: LIMIT } });
    const messages = starredFrom(page, getChat().partnerId);
    if (messages.length < LIMIT) setStarredCount(messages.length);
    return messages;
  });
}

export function unstarAll() {
  return run(async (account) => {
    await rpc<unknown>(account, 'mail.message', 'unstar_all', []);
    setStarredCount(0);
  });
}
