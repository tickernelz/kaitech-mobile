import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { haptic } from '../../../ui/haptic';
import { toggleReaction } from '../chat';
import type { Message } from '../types';
import { failureText } from './actions/failure';

export function useReaction(onFailure: (text: string) => void) {
  const { t } = useTranslation('chat');
  return useCallback(
    async (message: Message, content: string) => {
      haptic.tick();
      const failure = await toggleReaction(message, content);
      if (failure) onFailure(failureText(t, { code: failure, detail: null }));
    },
    [onFailure, t],
  );
}
