import { useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';
import { radius, space, useTheme } from '../../../../theme';
import { Button } from '../../../../ui/Button';
import { Icon } from '../../../../ui/icons';
import { ToggleRow } from '../../../../ui/List';
import { Pressable } from '../../../../ui/Pressable';
import { Sheet } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import { TextField } from '../../../../ui/TextField';
import { draftPoll, growOptions, pollLimits, pollProblem } from '../../rich';
import type { Poll } from '../../types';

export function PollSheet({ onClose, onSend }: { onClose: () => void; onSend: (poll: Poll) => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [multiple, setMultiple] = useState(false);
  const fields = useRef<(ComponentRef<typeof TextInput> | null)[]>([]);
  const problem = pollProblem(question, options);
  const shown = problem === 'tooLong' ? t('poll.problem.tooLong') : problem === 'duplicate' ? t('poll.problem.duplicate') : problem === 'tooMany' ? t('poll.problem.tooMany') : null;
  const edit = (index: number, value: string) => setOptions((current) => growOptions(current.map((option, at) => (at === index ? value : option))));
  const remove = (index: number) => setOptions((current) => growOptions(current.filter((_, at) => at !== index)));
  return (
    <Sheet
      title={t('poll.newTitle')}
      onClose={onClose}
      testID="poll-sheet"
      footer={
        <View style={styles.foot}>
          {shown ? (
            <Text variant="footnote" tone="dangerInk" testID="poll-problem">
              {shown}
            </Text>
          ) : null}
          <Button label={t('poll.send')} disabled={problem !== null} onPress={() => onSend(draftPoll(question, options, multiple))} testID="poll-send" />
        </View>
      }>
      <TextField
        label={t('poll.question')}
        placeholder={t('poll.questionPlaceholder')}
        value={question}
        onChangeText={setQuestion}
        maxLength={pollLimits.question}
        multiline
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => fields.current[0]?.focus()}
        autoFocus
        testID="poll-question"
      />
      <Text variant="label" tone="inkSoft" style={styles.heading}>
        {t('poll.options')}
      </Text>
      {options.map((option, index) => {
        const removable = options.length > pollLimits.minOptions && !(index === options.length - 1 && !option.trim());
        return (
          <View key={index} style={[styles.row, { borderColor: colors.edge, backgroundColor: colors.surface }]}>
            <TextInput
              ref={(node) => {
                fields.current[index] = node;
              }}
              value={option}
              onChangeText={(value) => edit(index, value)}
              placeholder={t('poll.optionPlaceholder', { number: index + 1 })}
              placeholderTextColor={colors.inkFaint}
              accessibilityLabel={t('poll.optionLabel', { number: index + 1 })}
              maxLength={pollLimits.option + 20}
              returnKeyType={index < options.length - 1 ? 'next' : 'done'}
              submitBehavior={index < options.length - 1 ? 'submit' : 'blurAndSubmit'}
              onSubmitEditing={() => fields.current[index + 1]?.focus()}
              style={[styles.input, { color: colors.ink }]}
              testID={`poll-option-${index}`}
            />
            {removable ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('poll.removeOption', { number: index + 1 })} onPress={() => remove(index)} hitSlop={8} style={styles.remove} testID={`poll-option-${index}-remove`}>
                <Icon name="close" size={18} color={colors.inkSoft} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
      <Text variant="label" tone="inkFaint">
        {t('poll.optionsLeft', { count: pollLimits.maxOptions - options.filter((option) => option.trim()).length })}
      </Text>
      <ToggleRow title={t('poll.multiple')} value={multiple} onChange={setMultiple} testID="poll-multiple" />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: { marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.field, paddingHorizontal: space.md, minHeight: 48 },
  input: { flex: 1, fontSize: 16, paddingVertical: space.sm },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  foot: { gap: space.sm },
});
