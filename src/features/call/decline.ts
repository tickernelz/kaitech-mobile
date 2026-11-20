import { AppRegistry } from 'react-native';
import { getSession } from '../../auth/session';
import { CallClient } from './api';
import { accountForPush } from './account';

const task = 'KaitechCallDecline';

export function registerHeadlessTask(register: (name: string, handler: (data: { channelId?: number; db?: string; uid?: number }) => Promise<void>) => void = (name, handler) => AppRegistry.registerHeadlessTask(name, () => handler)) {
  register(task, async (data) => {
    const channelId = Number(data.channelId);
    if (!Number.isInteger(channelId) || channelId <= 0) return;
    const account = accountForPush({ db: data.db, uid: data.uid }, getSession().accounts);
    if (!account) return;
    await new CallClient(account).decline(channelId).catch(() => undefined);
  });
}
