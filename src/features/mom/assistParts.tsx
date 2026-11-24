import { useEffect, useState, type ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { invalidate } from '../../api/resource';
import type { Account } from '../../auth/oauth';
import { useSession } from '../../auth/session';
import { readableWidth } from '../../layout/windowClass';
import { space } from '../../theme';
import { useErrorText } from '../discovery/ui';
import type { AssistPart } from './assist';
import { Refresh } from '../../ui/Refresh';

const pollMs = 3_000;

export function assistKey(part: AssistPart, meeting: number) {
  return `mom.assist.${part}.${meeting}`;
}

export function useAssistRun(part: AssistPart, meeting: number) {
  const { active } = useSession();
  const errorText = useErrorText();
  const [busy, setBusy] = useState('');
  const run = async (name: string, work: (account: Account) => Promise<unknown>): Promise<boolean> => {
    if (!active || busy) return false;
    setBusy(name);
    try {
      await work(active);
      invalidate(`${active.id}:${assistKey(part, meeting)}`);
      return true;
    } catch (error) {
      Alert.alert('', errorText(error));
      return false;
    } finally {
      setBusy('');
    }
  };
  return { busy, run };
}

export function usePoll(live: boolean, refresh: () => Promise<void>) {
  useEffect(() => {
    if (!live) return undefined;
    const timer = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(timer);
  }, [live, refresh]);
}

export function Scroll({ refreshing, onRefresh, children }: { refreshing: boolean; onRefresh: () => void; children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<Refresh refreshing={refreshing} onRefresh={onRefresh} />}>
      {children}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
});
