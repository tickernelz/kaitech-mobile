import { route, rpc, serverLanguage } from '../../api/odoo';
import type { Account } from '../../auth/oauth';

export type FieldInfo = {
  type: string;
  string: string;
  relation?: string;
  relation_field?: string;
  selection?: [string, string][];
  readonly?: boolean;
  required?: boolean;
  help?: string;
  currency_field?: string;
};

export type Fields = Record<string, FieldInfo>;

export type ViewRef = [number | false, string];

export type LoadedViews = {
  views: Record<string, { arch: string; id: number | false }>;
  models: Record<string, { fields: Fields }>;
};

export type Relation = { id: number; display_name: string };

export type RecordValues = Record<string, unknown> & { id: number };

export type Spec = Record<string, { fields?: Spec; context?: Record<string, unknown> }>;

export type WindowAction = {
  type: 'ir.actions.act_window';
  id?: number;
  name?: string;
  res_model: string;
  res_id?: number | false;
  views?: ViewRef[];
  view_mode?: string;
  domain?: unknown;
  context?: unknown;
  target?: string;
};

export type Action =
  | WindowAction
  | { type: 'ir.actions.act_url'; url: string; target?: string }
  | { type: 'ir.actions.client'; tag: string; params?: Record<string, unknown>; context?: unknown; name?: string }
  | { type: 'ir.actions.act_window_close' }
  | { type: 'ir.actions.report'; report_name: string; report_type: string; context?: unknown; data?: unknown; name?: string }
  | { type: 'ir.actions.server'; id: number };

export type MenuRow = { id: number; name: string; parent_id: [number, string] | false; action: string | false };

export type SectionLink = { menuId: number; name: string; actionId: number; actionModel: string };

export type SectionGroup = { id: number; name: string; sections: SectionLink[] };

export function groupsOfMenus(root: MenuRow, rows: MenuRow[]): SectionGroup[] {
  const children = new Map<number, MenuRow[]>();
  for (const row of rows) {
    if (!row.parent_id) continue;
    children.set(row.parent_id[0], [...(children.get(row.parent_id[0]) ?? []), row]);
  }
  const linkOf = (menu: MenuRow): SectionLink | null => {
    const [actionModel, id] = typeof menu.action === 'string' ? menu.action.split(',') : [];
    const actionId = Number(id);
    return actionModel && Number.isInteger(actionId) && actionId > 0 ? { menuId: menu.id, name: menu.name, actionId, actionModel } : null;
  };
  const loose: SectionLink[] = [];
  const groups: SectionGroup[] = [];
  for (const child of children.get(root.id) ?? []) {
    const below = children.get(child.id) ?? [];
    if (below.length) {
      const sections = below.flatMap((menu) => {
        const link = linkOf(menu);
        return link ? [link] : [];
      });
      if (sections.length) groups.push({ id: child.id, name: child.name, sections });
    } else {
      const link = linkOf(child);
      if (link) loose.push(link);
    }
  }
  return loose.length ? [{ id: root.id, name: root.name, sections: loose }, ...groups] : groups;
}

export async function sectionGroups(account: Account): Promise<SectionGroup[]> {
  const roots = await rpc<MenuRow[]>(account, 'ir.ui.menu', 'search_read', [[['parent_id', '=', false], ['web_icon', '=like', 'erp_discovery,%']]], {
    fields: ['name', 'parent_id', 'action'],
    limit: 1,
  });
  if (!roots.length) return [];
  const rows = await rpc<MenuRow[]>(
    account,
    'ir.ui.menu',
    'search_read',
    [[['id', 'child_of', roots[0].id], '|', ['group_ids', '=', false], ['group_ids.all_user_ids', 'in', [account.userId]]]],
    { fields: ['name', 'parent_id', 'action'], order: 'sequence, id' },
  );
  return groupsOfMenus(roots[0], rows);
}

function withLang(context: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...context, lang: serverLanguage() };
}

export async function loadAction(account: Account, action: number | string, context: Record<string, unknown> = {}): Promise<Action> {
  const loaded = await route<Action>(account, '/web/action/load', { action_id: action, context: withLang(context) });
  if (loaded && loaded.type === 'ir.actions.server') return runServerAction(account, loaded.id, context);
  return loaded;
}

export async function runServerAction(account: Account, id: number, context: Record<string, unknown>): Promise<Action> {
  const ran = await route<Action | false>(account, '/web/action/run', { action_id: id, context: withLang(context) });
  return ran || { type: 'ir.actions.act_window_close' };
}

const viewCache = new Map<string, Promise<LoadedViews>>();

export function getViews(account: Account, model: string, refs: ViewRef[]): Promise<LoadedViews> {
  const key = `${account.id}|${serverLanguage()}|${model}|${JSON.stringify(refs)}`;
  let held = viewCache.get(key);
  if (!held) {
    held = rpc<LoadedViews>(account, model, 'get_views', [refs], { options: {} });
    viewCache.set(key, held);
    held.catch(() => viewCache.delete(key));
  }
  return held;
}

export function forgetViews() {
  viewCache.clear();
}

export function specOf(names: Iterable<string>, fields: Fields): Spec {
  const spec: Spec = {};
  for (const name of names) {
    const field = fields[name];
    if (!field) continue;
    spec[name] = field.type === 'many2one' || field.type === 'reference' || field.type === 'many2many' ? { fields: { display_name: {} } } : {};
  }
  spec.display_name = {};
  return spec;
}

export function searchRecords(
  account: Account,
  model: string,
  query: { domain: unknown[]; spec: Spec; offset: number; limit: number; order?: string; context?: Record<string, unknown> },
) {
  return rpc<{ length: number; records: RecordValues[] }>(account, model, 'web_search_read', [], {
    domain: query.domain,
    specification: query.spec,
    offset: query.offset,
    limit: query.limit,
    order: query.order || undefined,
    count_limit: 10001,
    context: query.context,
  });
}

export type Group = Record<string, unknown> & { __count: number; __extra_domain: unknown[] };

export function readGroups(account: Account, model: string, domain: unknown[], groupby: string, context?: Record<string, unknown>) {
  return rpc<Group[]>(account, model, 'formatted_read_group', [], { domain, groupby: [groupby], aggregates: ['__count'], limit: 200, context });
}

export async function readRecord(account: Account, model: string, id: number, spec: Spec, context?: Record<string, unknown>): Promise<RecordValues | null> {
  const rows = await rpc<RecordValues[]>(account, model, 'web_read', [[id]], { specification: spec, context });
  return rows[0] ?? null;
}

export async function saveRecord(
  account: Account,
  model: string,
  id: number | null,
  values: Record<string, unknown>,
  spec: Spec,
  context?: Record<string, unknown>,
): Promise<RecordValues> {
  const rows = await rpc<RecordValues[]>(account, model, 'web_save', [id ? [id] : [], values], { specification: spec, context });
  return rows[0];
}

export async function onchange(
  account: Account,
  model: string,
  id: number | null,
  values: Record<string, unknown>,
  changed: string[],
  spec: Spec,
  context?: Record<string, unknown>,
): Promise<{ value: Record<string, unknown>; warning?: { title?: string; message?: string } }> {
  return rpc(account, model, 'onchange', [id ? [id] : [], values, changed, spec], { context });
}

export function callButton(account: Account, model: string, method: string, ids: number[], context: Record<string, unknown> = {}) {
  return route<Action | false>(account, `/web/dataset/call_button/${model}/${method}`, {
    model,
    method,
    args: [ids],
    kwargs: { context: withLang(context) },
  });
}

export function unlinkRecord(account: Account, model: string, id: number) {
  return rpc<boolean>(account, model, 'unlink', [[id]]);
}

export function nameSearch(account: Account, model: string, text: string, domain: unknown[], context?: Record<string, unknown>) {
  return rpc<[number, string][]>(account, model, 'name_search', [], { name: text, domain, limit: 30, context });
}

export type Message = { id: number; body: string; date: string; author_id: [number, string] | false; message_type: string; subtype_id: [number, string] | false; attachment_ids: number[] };

export function messages(account: Account, model: string, id: number, offset = 0) {
  return rpc<Message[]>(account, 'mail.message', 'search_read', [[['model', '=', model], ['res_id', '=', id], ['message_type', 'in', ['comment', 'notification', 'email']]]], {
    fields: ['body', 'date', 'author_id', 'message_type', 'subtype_id', 'attachment_ids'],
    order: 'id desc',
    limit: 30,
    offset,
  });
}

export function postNote(account: Account, model: string, id: number, text: string, note: boolean) {
  return rpc<number>(account, model, 'message_post', [[id]], {
    body: text,
    message_type: 'comment',
    subtype_xmlid: note ? 'mail.mt_note' : 'mail.mt_comment',
  });
}

export type AttachmentRow = { id: number; name: string; mimetype: string; file_size: number };

export function attachments(account: Account, ids: number[]) {
  return ids.length
    ? rpc<AttachmentRow[]>(account, 'ir.attachment', 'read', [ids], { fields: ['name', 'mimetype', 'file_size'] })
    : Promise.resolve([] as AttachmentRow[]);
}

export function createAttachment(account: Account, file: { name: string; mimetype: string; datas: string }, model: string, id: number | false) {
  return rpc<number>(account, 'ir.attachment', 'create', [{ name: file.name, mimetype: file.mimetype, datas: file.datas, res_model: model, res_id: id || 0 }]);
}
