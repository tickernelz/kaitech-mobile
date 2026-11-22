import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/odoo';
import type { Account } from '../../auth/oauth';
import { ActionSheet } from '../../ui/ActionSheet';
import { FormSheet } from '../../ui/FormSheet';
import { showFailure } from '../../ui/undo';
import { minutesDetail, removalPreview, removeRecording, type DetailRecording } from './api';

type Step = { kind: 'pick'; recordings: DetailRecording[] } | { kind: 'confirm'; recording: DetailRecording; lines: string[] };

export function RemoveRecording({ account, meeting, title, onRemoved, onClose }: { account: Account; meeting: number; title: string; onRemoved: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step | null>(null);
  const picked = useRef(false);

  const confirm = async (recording: DetailRecording) => {
    picked.current = true;
    try {
      const preview = await removalPreview(account, recording.id);
      if (preview.held) {
        showFailure(preview.held);
        onClose();
        return;
      }
      setStep({ kind: 'confirm', recording, lines: [t('mom.remove.warning'), ...preview.withdrawn] });
    } catch (error) {
      showFailure(error instanceof ApiError && error.code === 'refused' ? t('mom.remove.notYours') : t('row.failed'));
      onClose();
    }
  };

  const loaded = useEffectEvent((recordings: DetailRecording[] | null) => {
    if (!recordings) {
      showFailure(t('row.failed'));
      onClose();
    } else if (recordings.length === 1) void confirm(recordings[0]);
    else setStep({ kind: 'pick', recordings });
  });

  useEffect(() => {
    let live = true;
    minutesDetail(account, meeting).then(
      (detail) => live && loaded(detail.recordings),
      () => live && loaded(null),
    );
    return () => {
      live = false;
    };
  }, [account, meeting]);

  if (!step) return null;
  if (step.kind === 'pick') {
    return (
      <ActionSheet
        title={t('mom.remove.pick')}
        subtitle={title}
        actions={step.recordings.map((recording) => ({ key: `recording-${recording.id}`, icon: 'wave', label: recording.title, onPress: () => void confirm(recording) }))}
        onClose={() => {
          if (!picked.current) onClose();
        }}
      />
    );
  }
  return (
    <FormSheet
      title={t('mom.remove.title', { title: step.recording.title })}
      lines={step.lines}
      fields={[
        { key: 'title', label: t('mom.remove.typeTitle', { title: step.recording.title }) },
        { key: 'password', label: t('mom.remove.password'), secret: true },
      ]}
      submit={t('mom.remove.submit')}
      danger
      testID="recording-remove"
      onClose={onClose}
      onSubmit={async ({ title: typed, password }) => {
        try {
          const answer = await removeRecording(account, step.recording.id, typed, password);
          if (!answer.ok) return answer.message || t('row.failed');
        } catch {
          return t('row.failed');
        }
        onRemoved();
        return null;
      }}
    />
  );
}
