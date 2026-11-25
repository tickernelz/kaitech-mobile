type Raw = Record<string, unknown>;

export type ChatFeatures = {
  on: string[];
  isAdmin: boolean;
  canMakeTask: boolean;
  readByAdmin: boolean;
  channelAdmin: boolean;
  agentPartnerIds: number[];
  coworkerPartnerId: number | null;
  translateAuto: boolean;
  translateLanguage: string | null;
  urgentQuota: number | null;
  urgentLeft: number | null;
  internalGroupId: number | null;
};

export const noFeatures: ChatFeatures = {
  on: [],
  isAdmin: false,
  canMakeTask: false,
  readByAdmin: false,
  channelAdmin: false,
  agentPartnerIds: [],
  coworkerPartnerId: null,
  translateAuto: false,
  translateLanguage: null,
  urgentQuota: null,
  urgentLeft: null,
  internalGroupId: null,
};

function isRecord(value: unknown): value is Raw {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function idOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (isRecord(value)) return idOf(value.id);
  return null;
}

function numberOr(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function recordsOf(data: Raw, model: string): Raw[] {
  const value = data[model];
  if (Array.isArray(value)) return value.filter(isRecord);
  return isRecord(value) ? [value] : [];
}

function selfIsAdmin(data: Raw, globals: Raw): boolean {
  const partnerId = idOf(globals.self_partner);
  const partner = recordsOf(data, 'res.partner').find((item) => idOf(item.id) === partnerId);
  const userId = idOf(partner?.main_user_id);
  const user = recordsOf(data, 'res.users').find((item) => idOf(item.id) === userId);
  return user?.is_admin === true;
}

export function featuresFromSession(info: unknown): ChatFeatures {
  const data = isRecord(info) && isRecord(info.storeData) ? info.storeData : null;
  const globals = data && isRecord(data.Store) ? data.Store : null;
  if (!data || !globals) return noFeatures;
  const on = Array.isArray(globals.kaitech_chat_features) ? globals.kaitech_chat_features.filter((item): item is string => typeof item === 'string') : [];
  const isAdmin = selfIsAdmin(data, globals);
  return {
    on,
    isAdmin,
    canMakeTask: globals.kaitech_chat_can_make_task === true,
    readByAdmin: globals.kaitech_chat_read_by_admin === true,
    channelAdmin: globals.kaitech_chat_channel_admin === true,
    agentPartnerIds: Array.isArray(globals.kaitech_chat_agent_partner_ids) ? globals.kaitech_chat_agent_partner_ids.map(idOf).filter((item): item is number => item !== null) : [],
    coworkerPartnerId: idOf(globals.kaitech_chat_coworker_partner_id),
    translateAuto: globals.kaitech_chat_translate_auto === true,
    translateLanguage: typeof globals.kaitech_chat_translate_language === 'string' ? globals.kaitech_chat_translate_language : null,
    urgentQuota: numberOr(globals.kaitech_chat_urgent_quota),
    urgentLeft: numberOr(globals.kaitech_chat_urgent_left),
    internalGroupId: idOf(globals.internalUserGroupId),
  };
}

export function urgentLeftFrom(storeData: unknown): number | null {
  const globals = isRecord(storeData) && isRecord(storeData.Store) ? storeData.Store : null;
  return globals ? numberOr(globals.kaitech_chat_urgent_left) : null;
}

export function hasFeature(features: ChatFeatures, name: string): boolean {
  return features.on.includes(name);
}
