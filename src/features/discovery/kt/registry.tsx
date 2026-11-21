import type { ComponentType } from 'react';
import { KtArtifact } from './Artifact';
import { KtAccordion, KtCallout, KtChecklist, KtCode, KtOptions, KtProgress } from './Catalog';
import { KtChart } from './Chart';
import { KtDiagram } from './Diagram';
import { KtGallery, KtRecord } from './Linked';
import { KtCompare, KtKpi } from './Numbers';
import type { Place } from './place';
import {
  readAccordion,
  readArtifact,
  readCallout,
  readChart,
  readChecklist,
  readCode,
  readCompare,
  readDiagram,
  readForm,
  readGallery,
  readKpi,
  readOptions,
  readProgress,
  readRecord,
  readReplies,
  readTable,
  type Frame,
  type Obj,
} from './read';
import { KtForm, KtReplies } from './Saying';
import { KtTable } from './Table';

export type KindProps<T> = { block: T; frame: Frame; place: Place | null };
export type Kind = { read: (data: Obj) => unknown; View: ComponentType<KindProps<unknown>> };

function kind<T>(read: (data: Obj) => T | null, View: ComponentType<KindProps<T>>): Kind {
  return { read, View: View as ComponentType<KindProps<unknown>> };
}

function DiagramKind({ block, frame }: KindProps<Parameters<typeof KtDiagram>[0]['block']>) {
  return <KtDiagram block={block} summary={frame.summary} />;
}

export const blockKinds: Record<string, Kind> = {
  accordion: kind(readAccordion, KtAccordion),
  artifact: kind(readArtifact, KtArtifact),
  callout: kind(readCallout, KtCallout),
  chart: kind(readChart, KtChart),
  checklist: kind(readChecklist, KtChecklist),
  code: kind(readCode, KtCode),
  compare: kind(readCompare, KtCompare),
  diagram: kind(readDiagram, DiagramKind),
  form: kind(readForm, KtForm),
  gallery: kind(readGallery, KtGallery),
  kpi: kind(readKpi, KtKpi),
  options: kind(readOptions, KtOptions),
  progress: kind(readProgress, KtProgress),
  record: kind(readRecord, KtRecord),
  replies: kind(readReplies, KtReplies),
  table: kind(readTable, KtTable),
};

export const knownKinds = Object.keys(blockKinds).sort();

export function kindOf(type: string): Kind | null {
  return Object.hasOwn(blockKinds, type) ? blockKinds[type] : null;
}
