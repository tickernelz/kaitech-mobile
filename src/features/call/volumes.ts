import type { Account } from '../../auth/oauth';
import { rpc } from '../../api/odoo';

async function settingsId(account: Account): Promise<number | null> {
  const rows = await rpc<Record<string, unknown>[]>(account, 'res.users.settings', 'search_read', [[['user_id', '=', account.userId]]], { fields: ['volume_settings_ids'], limit: 1 });
  return typeof rows[0]?.id === 'number' ? rows[0].id : null;
}

export async function loadVolumes(account: Account): Promise<Map<number, number>> {
  const rows = await rpc<Record<string, unknown>[]>(account, 'res.users.settings.volumes', 'search_read', [[['user_setting_id.user_id', '=', account.userId], ['partner_id', '!=', false]]], {
    fields: ['partner_id', 'volume'],
  });
  const volumes = new Map<number, number>();
  for (const row of rows) {
    const partner = Array.isArray(row.partner_id) ? row.partner_id[0] : null;
    if (typeof partner === 'number' && typeof row.volume === 'number') volumes.set(partner, row.volume);
  }
  return volumes;
}

export async function saveVolume(account: Account, partnerId: number, volume: number) {
  const id = (await settingsId(account)) ?? (await rpc<number>(account, 'res.users.settings', 'create', [{ user_id: account.userId }]));
  await rpc<unknown>(account, 'res.users.settings', 'set_volume_setting', [[id], partnerId, volume]);
}
