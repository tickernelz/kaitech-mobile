import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../../features/discovery/params';
import type { FinalTool } from '../../../features/mom/final';
import { FinalToolScreen } from '../../../features/mom/FinalTools';
import { DialogLayer } from '../../../ui/Dialog';

const tools: FinalTool[] = ['content', 'rewrite', 'header', 'recipients', 'email', 'narrative', 'context', 'revoke'];

export default function FinalToolRoute() {
  const params = useLocalSearchParams<{ tool: string; programme: string; meeting: string; section?: string; index?: string }>();
  const tool = tools.find((one) => one === params.tool);
  const programme = idParam(params.programme);
  const meeting = idParam(params.meeting);
  if (!tool || !programme || !meeting) return null;
  const index = params.index === undefined ? undefined : Number(params.index);
  return (
    <>
      <FinalToolScreen tool={tool} programme={programme} meeting={meeting} section={params.section} index={Number.isInteger(index) ? index : undefined} />
      <DialogLayer />
    </>
  );
}
