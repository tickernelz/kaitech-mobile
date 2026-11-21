import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { sessionCookie } from '../../api/odoo';
import type { Account } from '../../auth/oauth';
import { useSession } from '../../auth/session';
import { downloadForOpening } from '../chat/files';
import type { Action, WindowAction } from './api';
import { contextOf, plainOfHtml } from './model';
import { recordsChanged, stash } from './stash';

export type RecordStash = { context: Record<string, unknown>; formView: number | false; wizard: boolean; title?: string };

export type ListStash = { action: WindowAction };

function viewOf(action: WindowAction, type: string): number | false | undefined {
  const found = (action.views ?? []).find(([, kind]) => kind === type || (type === 'list' && kind === 'tree'));
  return found ? found[0] : undefined;
}

export function firstViewType(action: WindowAction): string {
  const first = action.views?.[0]?.[1] ?? (action.view_mode ?? 'list').split(',')[0];
  return first === 'tree' ? 'list' : first;
}

export async function openReport(account: Account, path: string, name: string) {
  const cookie = await sessionCookie(account);
  const file = await downloadForOpening({ accountId: account.id, attachmentId: Date.now(), checksum: null }, `${account.origin}${path}`, name, { Cookie: cookie });
  if (await file.canPreview({ mimeType: 'application/pdf' })) await file.preview({ mimeType: 'application/pdf', title: name });
}

export function useRunAction(programme: number) {
  const router = useRouter();
  const { t } = useTranslation();
  const account = useSession().active;
  return useCallback(
    async (action: Action | false | undefined | null, from: { wizard?: boolean } = {}): Promise<void> => {
      if (!action || action.type === 'ir.actions.act_window_close') {
        recordsChanged();
        if (from.wizard) router.back();
        return;
      }
      const id = String(programme);
      if (action.type === 'ir.actions.act_window') {
        const context = contextOf(action.context, { uid: account?.userId ?? 0, context: {}, active_id: false });
        const formView = viewOf(action, 'form');
        const wizard = action.target === 'new';
        const kind = firstViewType(action);
        if (from.wizard) router.back();
        if (wizard || kind === 'form' || action.res_id) {
          const key = stash({ context, formView: formView ?? false, wizard, title: action.name } satisfies RecordStash);
          router.push({ pathname: '/program/[id]/record', params: { id, model: action.res_model, rid: action.res_id ? String(action.res_id) : '', stash: key } });
        } else {
          router.push({ pathname: '/program/[id]/list', params: { id, stash: stash({ action } satisfies ListStash) } });
        }
        return;
      }
      if (action.type === 'ir.actions.client') {
        const context = contextOf(action.context, {});
        const params = action.params ?? {};
        const target = Number(context.active_id ?? params.active_id ?? 0);
        if (from.wizard) router.back();
        if (action.tag === 'ck_architecture') router.push({ pathname: '/program/[id]/map', params: { id, rid: String(target) } });
        else if (action.tag === 'ck_diagram') router.push({ pathname: '/program/[id]/diagram', params: { id, rid: String(target) } });
        else if (action.tag === 'ck_chat') router.push({ pathname: '/program/[id]/coworker', params: { id } });
        else if (action.tag === 'ck_knowledge') router.push({ pathname: '/program/[id]/knowledge', params: { id: String(target || programme) } });
        else if (action.tag === 'display_notification') {
          recordsChanged();
          const title = typeof params.title === 'string' ? params.title : '';
          const message = typeof params.message === 'string' ? plainOfHtml(params.message) : '';
          Alert.alert(title, message);
        } else if (action.tag === 'reload' || action.tag === 'soft_reload') recordsChanged();
        else {
          recordsChanged();
          Alert.alert('', t('records.webOnly', { name: action.name ?? action.tag }));
        }
        return;
      }
      if (action.type === 'ir.actions.act_url' && account) {
        const url = action.url.startsWith('/') ? `${account.origin}${action.url}` : action.url;
        if (action.url.startsWith('/web/content') || action.url.startsWith('/report/')) await openReport(account, action.url, t('records.file'));
        else await WebBrowser.openBrowserAsync(url);
        return;
      }
      if (action.type === 'ir.actions.report' && account) {
        const context = contextOf(action.context, {});
        const ids = Array.isArray(context.active_ids) ? context.active_ids.join(',') : String(context.active_id ?? '');
        await openReport(account, `/report/pdf/${action.report_name}/${ids}`, `${action.name ?? action.report_name}.pdf`);
        recordsChanged();
      }
    },
    [account, programme, router, t],
  );
}
