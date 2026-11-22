import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { radius, space, useTheme } from '../../../../theme';
import { Sheet, SheetItem } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import { bodyPreview } from '../../markdown';
import type { Result } from '../../messageActions';
import { channelFiles, pinnedMessages, searchMessages } from '../../threadActions';
import type { Attachment, Message } from '../../types';
import { useChatFormat } from '../format';
import { useOpenAttachment } from '../useOpenAttachment';
import { failureText } from '../actions/failure';

function useLoad<T>(load: (channelId: number) => Promise<Result<T>>, channelId: number) {
  const [result, setResult] = useState<Result<T> | null>(null);
  useEffect(() => {
    let live = true;
    void load(channelId).then((next) => live && setResult(next));
    return () => {
      live = false;
    };
  }, [load, channelId]);
  return result;
}

const loadFiles = (channelId: number) => channelFiles(channelId, null);

function MessageRows({ messages, onOpen, empty }: { messages: Message[]; onOpen: (message: Message) => void; empty: string }) {
  const { t } = useTranslation('chat');
  const { dayLabel, clock } = useChatFormat();
  if (!messages.length) {
    return (
      <Text variant="callout" tone="inkSoft" style={styles.pad}>
        {empty}
      </Text>
    );
  }
  return messages.map((message) => (
    <SheetItem
      key={message.id}
      label={bodyPreview(message.body) || t('list.files', { count: message.attachments.length })}
      detail={`${message.author} · ${dayLabel(message.date)} ${clock(message.date)}`}
      onPress={() => onOpen(message)}
      testID={`found-${message.id}`}
    />
  ));
}

function Loading<T>({ result, children }: { result: Result<T> | null; children: (value: T) => React.ReactNode }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  if (!result) return <ActivityIndicator color={colors.primary} style={styles.pad} />;
  if (!result.ok) {
    return (
      <Text variant="callout" tone="danger">
        {failureText(t, result)}
      </Text>
    );
  }
  return <>{children(result.value)}</>;
}

export function PinnedSheet({ channelId, onClose, onOpen }: { channelId: number; onClose: () => void; onOpen: (message: Message) => void }) {
  const { t } = useTranslation('chat');
  const result = useLoad(pinnedMessages, channelId);
  return (
    <Sheet title={t('threadActions.pinned')} onClose={onClose} testID="pinned-sheet">
      <Loading result={result}>{(messages) => <MessageRows messages={messages} onOpen={onOpen} empty={t('threadActions.noPinned')} />}</Loading>
    </Sheet>
  );
}

export function SearchSheet({ channelId, onClose, onOpen }: { channelId: number; onClose: () => void; onOpen: (message: Message) => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Result<Message[]> | null>(null);
  const term = query.trim();
  useEffect(() => {
    if (term.length < 2) return;
    let live = true;
    const timer = setTimeout(() => void searchMessages(channelId, term).then((next) => live && setResult(next)), 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [channelId, term]);
  return (
    <Sheet title={t('threadActions.search')} onClose={onClose} testID="search-sheet">
      <TextInput
        value={query}
        onChangeText={setQuery}
        autoFocus
        placeholder={t('threadActions.searchHint')}
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel={t('threadActions.searchHint')}
        style={[styles.input, { backgroundColor: colors.surface2, color: colors.ink }]}
        testID="search-input"
      />
      {term.length >= 2 ? <Loading result={result}>{(messages) => <MessageRows messages={messages} onOpen={onOpen} empty={t('threadActions.noResults')} />}</Loading> : null}
    </Sheet>
  );
}

export function FilesSheet({ channelId, onClose }: { channelId: number; onClose: () => void }) {
  const { t } = useTranslation('chat');
  const { size } = useChatFormat();
  const { open } = useOpenAttachment();
  const result = useLoad(loadFiles, channelId);
  return (
    <Sheet title={t('threadActions.files')} onClose={onClose} testID="files-sheet">
      <Loading result={result}>
        {(files: Attachment[]) =>
          files.length ? (
            files.map((file) => (
              <SheetItem
                key={file.id}
                icon={file.mimetype.startsWith('image/') ? 'image' : file.voice ? 'mic' : 'file'}
                label={file.name}
                detail={size(file.size)}
                onPress={() => void open(file)}
                testID={`file-${file.id}`}
              />
            ))
          ) : (
            <Text variant="callout" tone="inkSoft" style={styles.pad}>
              {t('threadActions.noFiles')}
            </Text>
          )
        }
      </Loading>
    </Sheet>
  );
}

export function ThreadsSheet({ threads, onClose, onOpen }: { threads: { id: number; name: string }[]; onClose: () => void; onOpen: (id: number) => void }) {
  const { t } = useTranslation('chat');
  return (
    <Sheet title={t('threadActions.threads')} onClose={onClose} testID="threads-sheet">
      {threads.length ? (
        threads.map((item) => <SheetItem key={item.id} icon="thread" label={item.name} onPress={() => onOpen(item.id)} testID={`sub-${item.id}`} />)
      ) : (
        <View style={styles.pad}>
          <Text variant="callout" tone="inkSoft">
            {t('threadActions.noThreads')}
          </Text>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.lg },
  input: { minHeight: 44, borderRadius: radius.field, paddingHorizontal: space.md, fontSize: 16 },
});
