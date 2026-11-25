import type { ModalProps } from 'react-native';
import { Modal } from 'react-native';
import { useReduceMotion } from '../theme/reduceMotion';
import { DialogLayer } from './Dialog';

export function Overlay({ children, animationType = 'none', ...props }: ModalProps) {
  const reduceMotion = useReduceMotion();
  return (
    <Modal {...props} animationType={reduceMotion ? 'none' : animationType}>
      {children}
      <DialogLayer />
    </Modal>
  );
}
