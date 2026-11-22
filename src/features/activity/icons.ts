import type { IconName } from '../../ui/icons';

const byCategory: Record<string, IconName> = { phonecall: 'phone', meeting: 'meeting', upload_file: 'cloudUpload', grant_approval: 'sign' };

export function iconOfCategory(category: string): IconName {
  return byCategory[category] ?? 'check';
}
