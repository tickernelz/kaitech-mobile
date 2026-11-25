import type { ModalProps } from 'react-native';
import { Modal } from 'react-native';
import { DialogLayer } from './Dialog';

export function Overlay({ children, ...props }: ModalProps) {
  return (
    <Modal {...props}>
      {children}
      <DialogLayer />
    </Modal>
  );
}
