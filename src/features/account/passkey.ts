import { requireOptionalNativeModule } from 'expo';
import type { Account } from '../../auth/oauth';
import { rpc } from '../../api/odoo';
import { identityOf, type Action, type Step } from './security';

type NativePasskey = { create(requestJson: string): Promise<string> };

export type PasskeyFailure = 'cancelled' | 'noProvider' | 'failed';

export class PasskeyError extends Error {
  constructor(readonly reason: PasskeyFailure) {
    super(reason);
    this.name = 'PasskeyError';
  }
}

function native(): NativePasskey | null {
  return requireOptionalNativeModule<NativePasskey>('KaitechPasskey');
}

export function canCreatePasskey(): boolean {
  return native() !== null;
}

export function passkeyFailure(error: unknown): PasskeyFailure {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'ERR_PASSKEY_CANCELLED') return 'cancelled';
  if (code === 'ERR_PASSKEY_NO_PROVIDER') return 'noProvider';
  return 'failed';
}

export function creationOptions(result: unknown): Record<string, unknown> {
  const action = result as Action;
  const registration = action && action.res_model === 'auth.passkey.key.create' ? action.context?.registration : undefined;
  if (!registration || typeof registration !== 'object' || Array.isArray(registration)) throw new PasskeyError('failed');
  return registration as Record<string, unknown>;
}

export async function startPasskey(account: Account): Promise<Step<Record<string, unknown>>> {
  const result = await rpc<unknown>(account, 'res.users', 'action_create_passkey', [[account.userId]]);
  const checkId = identityOf(result);
  if (checkId !== null) return { kind: 'identity', checkId };
  return { kind: 'done', value: creationOptions(result) };
}

export async function createCredential(options: Record<string, unknown>): Promise<Record<string, unknown>> {
  const module = native();
  if (!module) throw new PasskeyError('noProvider');
  let text: string;
  try {
    text = await module.create(JSON.stringify(options));
  } catch (error) {
    throw new PasskeyError(passkeyFailure(error));
  }
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new PasskeyError('failed');
  return parsed as Record<string, unknown>;
}

export async function savePasskey(account: Account, name: string, credential: Record<string, unknown>): Promise<boolean> {
  const wizard = await rpc<number>(account, 'auth.passkey.key.create', 'create', [{ name: name.trim() }]);
  return rpc<boolean>(account, 'auth.passkey.key.create', 'make_key', [[wizard], credential]);
}
