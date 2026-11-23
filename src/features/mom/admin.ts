import { rpc } from '../../api/odoo';
import type { Account } from '../../auth/oauth';

type Named = { id: number; name: string };

export type McpKey = { id: number; name: string; keyIndex: string; createdAt: string; programmes: string[] };

type RawKey = { id: number; name: string; key_index: string; create_date: string; engagement_ids: { id: number; display_name: string }[] };

export async function mcpKeys(account: Account): Promise<McpKey[]> {
  const page = await rpc<{ records: RawKey[] }>(account, 'ck.mom.mcp.key', 'web_search_read', [], {
    domain: [],
    specification: { name: {}, key_index: {}, create_date: {}, engagement_ids: { fields: { display_name: {} } } },
    order: 'create_date desc, id desc',
    limit: 200,
  });
  return page.records.map((row) => ({ id: row.id, name: row.name, keyIndex: row.key_index, createdAt: row.create_date, programmes: row.engagement_ids.map((one) => one.display_name) }));
}

export async function offeredProgrammes(account: Account): Promise<Named[]> {
  const page = await rpc<{ records: { id: number; display_name: string }[] }>(account, 'ck.engagement', 'web_search_read', [], {
    domain: ['|', ['mom_private', '=', false], ['member_ids', 'in', [account.userId]]],
    specification: { display_name: {} },
    order: 'name',
    limit: 500,
  });
  return page.records.map((row) => ({ id: row.id, name: row.display_name }));
}

export type KeyShown = { key: string; url: string; header: string; claude_desktop: string; hermes_env: string; hermes_config: string };

type Action = { res_model?: string; res_id?: number; context?: Record<string, string> };

export function shownKey(action: Action): KeyShown | null {
  if (action.res_model !== 'ck.mom.mcp.key.show' || !action.context) return null;
  const read = (name: string) => action.context?.[`default_${name}`] ?? '';
  return { key: read('key'), url: read('url'), header: read('header'), claude_desktop: read('claude_desktop'), hermes_env: read('hermes_env'), hermes_config: read('hermes_config') };
}

export async function makeKey(account: Account, client: string, programmes: number[], password: string): Promise<KeyShown> {
  const wizard = await rpc<number>(account, 'ck.mom.mcp.key.new', 'create', [{ name: client.trim(), engagement_ids: [[6, 0, programmes]] }]);
  let action = await rpc<Action>(account, 'ck.mom.mcp.key.new', 'make_key', [[wizard]]);
  if (action.res_model === 'res.users.identitycheck' && action.res_id) {
    action = await rpc<Action>(account, 'res.users.identitycheck', 'run_check', [[action.res_id]], { context: { password } });
  }
  const shown = shownKey(action);
  if (!shown) throw new Error('mcp_key_not_shown');
  return shown;
}

export function revokeKey(account: Account, key: number): Promise<unknown> {
  return rpc(account, 'ck.mom.mcp.key', 'action_revoke', [[key]]);
}

export type Prompt = { kind: string; label: string; description: string; text: string; default: string; custom: boolean; updatedAt: string | false; updatedBy: string; limit: number };

export type Rate = { vendor: string; label: string; model: string; perMinute: number | null; currency: string; symbol: string; since: string | false; source: string };

export type Settings = {
  keys: { id: string; label: string; purpose: string; configured: boolean; where: string }[];
  configPath: string;
  transcription: {
    models: { deepgram: string; openai: string; elevenlabs: string };
    defaults: { deepgram: string; openai: string; elevenlabs: string };
    audioMode: 'auto' | 'preserve_source' | 'speech_optimized';
    compareEnabled: boolean;
    aiFilter: boolean;
    matchAt: number;
    divergentBelow: number;
  };
  coworkerModel: string;
  prompts: Prompt[];
  rates: Rate[];
};

const SETTINGS = 'ck.mom.settings';

export function readSettings(account: Account): Promise<Settings> {
  return rpc(account, SETTINGS, 'read_settings', []);
}

export function saveTranscription(account: Account, value: Settings['transcription']): Promise<Settings> {
  return rpc(account, SETTINGS, 'save_transcription', [
    { models: value.models, audioMode: value.audioMode, compareEnabled: value.compareEnabled, aiFilter: value.aiFilter, matchAt: value.matchAt, divergentBelow: value.divergentBelow },
  ]);
}

export function thresholdProblem(matchAt: number, divergentBelow: number): 'range' | 'order' | null {
  if ([matchAt, divergentBelow].some((value) => !Number.isFinite(value) || value < 0 || value > 1)) return 'range';
  if (divergentBelow > matchAt) return 'order';
  return null;
}

export function savePrompt(account: Account, kind: string, text: string): Promise<Prompt> {
  return rpc(account, SETTINGS, 'save_prompt', [kind, text]);
}

export function resetPrompt(account: Account, kind: string): Promise<Prompt> {
  return rpc(account, SETTINGS, 'reset_prompt', [kind]);
}

export function saveRate(account: Account, vendor: string, perMinute: number): Promise<Rate> {
  return rpc(account, SETTINGS, 'save_speech_rate', [vendor, perMinute]);
}

export function testLark(account: Account): Promise<{ ok: boolean; message: string }> {
  return rpc(account, SETTINGS, 'test_lark', []);
}

export type RunSummary = {
  id: number;
  name: string;
  kind: string;
  state: string;
  stateLabel: string;
  verdictLabel: string;
  startedAt: string | false;
  finishedAt: string | false;
  startedBy: string;
  created: number;
  updated: number;
  unchanged: number;
  conflicts: number;
  failed: number;
  missing: number;
};

export type ImportProject = {
  id: number;
  code: string;
  name: string;
  recordings: number;
  rows: number;
  decision: string;
  decisionLabel: string;
  programmeId: number | false;
  programme: string;
  landsIn: string;
  decidedBy: string;
  importedAt: string | false;
  private: boolean;
  archived: boolean;
};

export type ImportOverview = { runs: RunSummary[]; projects: ImportProject[]; programmes: Named[] };

export type RunDetail = RunSummary & {
  problems: string[];
  warnings: string[];
  events: { id: number; kindLabel: string; table: string; programme: string; message: string }[];
  eventTotal: number;
  offset: number;
  canRollBack: boolean;
  rollbackRefusal: string;
  rollbackNote: string;
  rolledBackAt: string | false;
};

export function importOverview(account: Account): Promise<ImportOverview> {
  return rpc(account, 'ck.mom.import.run', 'import_overview', []);
}

export function decideProject(account: Account, project: number, decision: 'map' | 'skip' | 'reopen', programme?: number): Promise<ImportOverview> {
  const method = { map: 'action_map', skip: 'action_skip', reopen: 'action_reopen' }[decision];
  return rpc(account, 'ck.mom.import.project', method, decision === 'map' ? [[project], programme] : [[project]]);
}

export function runDetail(account: Account, run: number, offset: number): Promise<RunDetail> {
  return rpc(account, 'ck.mom.import.run', 'run_detail', [run, offset]);
}

export function rollBack(account: Account, run: number): Promise<unknown> {
  return rpc(account, 'ck.mom.import.run', 'action_roll_back', [[run]]);
}
