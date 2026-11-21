import { AppRegistry } from 'react-native';
import { callState, subscribeCall, type CallPhase } from './call';

export const keepAliveTask = 'KaitechCallKeepAlive';

const live: CallPhase[] = ['outgoing', 'connecting', 'active', 'reconnecting'];

export function untilCallEnds(): Promise<void> {
  return new Promise((resolve) => {
    if (!live.includes(callState().phase)) {
      resolve();
      return;
    }
    const stop = subscribeCall(() => {
      if (live.includes(callState().phase)) return;
      stop();
      resolve();
    });
  });
}

export function registerCallKeepAlive() {
  AppRegistry.registerHeadlessTask(keepAliveTask, () => untilCallEnds);
}
