import { Modal as NativeModal, type ModalProps } from 'react-native';
import { useReduceMotion } from '../theme/reduceMotion';

export function Modal({ animationType = 'none', ...props }: ModalProps) {
  const reduceMotion = useReduceMotion();
  return <NativeModal {...props} animationType={reduceMotion ? 'none' : animationType} />;
}
