import type { Account } from '../../auth/oauth';
import { rpc } from '../../api/odoo';

export type Choice = { value: string; label: string };

export type Me = {
  email: string;
  phone: string;
  tz: string;
  lang: string;
  signature: string;
  notificationType: string;
  outOfOfficeFrom: string;
  outOfOfficeTo: string;
  outOfOfficeMessage: string;
  calendarPrivacy: string;
  totpEnabled: boolean;
};

const meFields = [
  'email',
  'phone',
  'tz',
  'lang',
  'signature',
  'notification_type',
  'out_of_office_from',
  'out_of_office_to',
  'out_of_office_message',
  'calendar_default_privacy',
  'totp_enabled',
];

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function meFrom(row: Record<string, unknown>): Me {
  return {
    email: text(row.email),
    phone: text(row.phone),
    tz: text(row.tz),
    lang: text(row.lang),
    signature: text(row.signature),
    notificationType: text(row.notification_type),
    outOfOfficeFrom: text(row.out_of_office_from),
    outOfOfficeTo: text(row.out_of_office_to),
    outOfOfficeMessage: text(row.out_of_office_message),
    calendarPrivacy: text(row.calendar_default_privacy),
    totpEnabled: row.totp_enabled === true,
  };
}

export async function readMe(account: Account): Promise<Me> {
  const rows = await rpc<Record<string, unknown>[]>(account, 'res.users', 'read', [[account.userId], meFields]);
  return meFrom(rows[0] ?? {});
}

export type MeChange = Partial<{
  email: string;
  phone: string;
  tz: string;
  lang: string;
  signature: string;
  notification_type: string;
  out_of_office_from: string | false;
  out_of_office_to: string | false;
  out_of_office_message: string;
  calendar_default_privacy: string;
}>;

export function writeMe(account: Account, change: MeChange) {
  return rpc<boolean>(account, 'res.users', 'write', [[account.userId], change]);
}

export function selectionOf(fields: Record<string, unknown>, name: string): Choice[] {
  const field = fields[name] as { selection?: unknown } | undefined;
  if (!Array.isArray(field?.selection)) return [];
  return field.selection
    .filter((pair): pair is [string, string] => Array.isArray(pair) && typeof pair[0] === 'string')
    .map(([value, label]) => ({ value, label: typeof label === 'string' ? label : value }));
}

export type Choices = { tz: Choice[]; notificationType: Choice[]; calendarPrivacy: Choice[]; languages: Choice[] };

export async function choices(account: Account): Promise<Choices> {
  const [fields, languages] = await Promise.all([
    rpc<Record<string, unknown>>(account, 'res.users', 'fields_get', [['tz', 'notification_type', 'calendar_default_privacy']], { attributes: ['selection'] }),
    rpc<unknown[]>(account, 'res.lang', 'get_installed'),
  ]);
  return {
    tz: selectionOf(fields, 'tz'),
    notificationType: selectionOf(fields, 'notification_type'),
    calendarPrivacy: selectionOf(fields, 'calendar_default_privacy'),
    languages: selectionOf({ lang: { selection: languages } }, 'lang'),
  };
}

export type ChannelNotifications = 'all' | 'mentions' | 'no_notif';

export type DiscussSettings = { id: number; channelNotifications: ChannelNotifications } | null;

export async function discussSettings(account: Account): Promise<DiscussSettings> {
  const rows = await rpc<Record<string, unknown>[]>(account, 'res.users.settings', 'search_read', [[['user_id', '=', account.userId]]], { fields: ['channel_notifications'], limit: 1 });
  const row = rows[0];
  if (!row || typeof row.id !== 'number') return null;
  const value = row.channel_notifications;
  return { id: row.id, channelNotifications: value === 'all' || value === 'no_notif' ? value : 'mentions' };
}

export function setChannelNotifications(account: Account, settingsId: number, value: ChannelNotifications) {
  return rpc<unknown>(account, 'res.users.settings', 'set_res_users_settings', [[settingsId]], { new_settings: { channel_notifications: value === 'mentions' ? false : value } });
}

export function plainSignature(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function signatureHtml(plain: string): string {
  const escaped = plain.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped ? `<div>${escaped.split('\n').join('<br>')}</div>` : '';
}

export function odooDateTime(day: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())} ${pad(day.getUTCHours())}:${pad(day.getUTCMinutes())}:${pad(day.getUTCSeconds())}`;
}

export function localDayFromOdoo(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!match) return '';
  const day = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

export function startOfLocalDay(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0);
}

export function endOfLocalDay(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59);
}
