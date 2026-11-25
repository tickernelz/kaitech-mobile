import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { DialogLayer } from '../src/ui/Dialog';
import { askPermission, type PermissionState } from '../src/ui/permission';

jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined } }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const state = (granted: boolean, canAskAgain = true): PermissionState => ({ granted, canAskAgain });

async function start(read: PermissionState, request = jest.fn(async () => state(true)), settings?: boolean) {
  await render(<DialogLayer root />);
  let result!: Promise<boolean>;
  await act(async () => {
    result = askPermission('camera', async () => read, request, settings === undefined ? undefined : { settings });
  });
  return { result: { value: result }, request };
}

async function settle(answer: { value: Promise<boolean> }) {
  let value = false;
  await act(async () => {
    value = await answer.value;
  });
  return value;
}

it('asks nothing when the permission is already granted', async () => {
  const { result, request } = await start(state(true));
  expect(await settle(result)).toBe(true);
  expect(screen.queryByTestId('permission-camera-dialog')).toBeNull();
  expect(request).not.toHaveBeenCalled();
});

it('explains the permission in our card before the system prompt, and Not now never opens the system prompt', async () => {
  const { result, request } = await start(state(false));
  expect(screen.getByTestId('permission-camera-dialog-title')).toHaveTextContent('Use the camera');
  expect(request).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('permission-camera-dialog-cancel'));
  expect(await settle(result)).toBe(false);
  expect(request).not.toHaveBeenCalled();
});

it('opens the system prompt after Continue and returns what the user chose there', async () => {
  const { result, request } = await start(state(false), jest.fn(async () => state(false)));
  await fireEvent.press(screen.getByTestId('permission-camera-dialog-confirm'));
  expect(await settle(result)).toBe(false);
  expect(request).toHaveBeenCalledTimes(1);
});

it('offers Settings when the system will not ask again, and opens them on confirm', async () => {
  const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
  const { result, request } = await start(state(false, false));
  expect(screen.getByTestId('permission-camera-blocked-dialog-title')).toHaveTextContent('Camera access is off');
  await fireEvent.press(screen.getByTestId('permission-camera-blocked-dialog-confirm'));
  expect(await settle(result)).toBe(false);
  expect(open).toHaveBeenCalledTimes(1);
  expect(request).not.toHaveBeenCalled();
  open.mockRestore();
});

it('stays quiet about Settings when the caller shows its own blocked notice', async () => {
  const { result } = await start(state(false, false), undefined, false);
  expect(await settle(result)).toBe(false);
  expect(screen.queryByTestId('permission-camera-blocked-dialog')).toBeNull();
});
