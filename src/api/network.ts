import { useNetworkState, type NetworkState } from 'expo-network';
import { useEffect, useRef } from 'react';

export type Notice = 'offline' | 'failed' | null;

export function isOnline(network: Pick<NetworkState, 'isConnected' | 'isInternetReachable'>): boolean {
  return network.isConnected !== false && network.isInternetReachable !== false;
}

export function noticeFor({ online, shown, failed }: { online: boolean; shown: boolean; failed: boolean }): Notice {
  if (!shown) return null;
  if (!online) return 'offline';
  return failed ? 'failed' : null;
}

export function useOnline(): boolean {
  return isOnline(useNetworkState());
}

export function useConnection({ shown, failed, refresh }: { shown: boolean; failed: boolean; refresh: () => void }): { online: boolean; notice: Notice } {
  const online = useOnline();
  const wasOnline = useRef(online);
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });
  useEffect(() => {
    if (online && !wasOnline.current) latest.current();
    wasOnline.current = online;
  }, [online]);
  return { online, notice: noticeFor({ online, shown, failed }) };
}
