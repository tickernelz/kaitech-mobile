import { PdfViewer } from '../features/chat/ui/media/PdfViewer';
import { DialogLayer } from '../ui/Dialog';

export default function PdfScreen() {
  return (
    <>
      <PdfViewer />
      <DialogLayer />
    </>
  );
}
