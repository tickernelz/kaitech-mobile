import { plainText } from '../html';
import type { Attachment, Message } from '../types';

export function voiceIdOf(attachment: Attachment): string {
  return `a${attachment.id}`;
}

function voiceOf(message: Message): Attachment | undefined {
  return message.attachments.find((attachment) => attachment.voice || attachment.mimetype.startsWith('audio/'));
}

export function nextVoiceAfter(messages: Message[], id: string, played: (id: string) => boolean): { message: Message; attachment: Attachment } | null {
  const index = messages.findIndex((message) => message.attachments.some((attachment) => voiceIdOf(attachment) === id));
  const next = index >= 0 ? messages[index + 1] : undefined;
  if (!next || plainText(next.body).trim()) return null;
  const attachment = voiceOf(next);
  if (!attachment || played(voiceIdOf(attachment))) return null;
  return { message: next, attachment };
}
