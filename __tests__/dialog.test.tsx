import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { DialogLayer } from '../src/ui/Dialog';
import { choose, confirm, holdDialogs, inform, notify, prompt } from '../src/ui/dialog';
import { Overlay } from '../src/ui/Overlay';
import { colorsFor } from '../src/theme/tokens';

jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined } }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

type Node = { props: { testID?: string }; parent: Node | null };
const insideSheet = (node: Node | null): boolean => (node ? node.props.testID === 'sheet' || insideSheet(node.parent) : false);
const flatten = (style: unknown): Record<string, unknown> => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

async function ask<T>(open: () => Promise<T>): Promise<{ answer: Promise<T> }> {
  let answer!: Promise<T>;
  await act(async () => {
    answer = open();
  });
  return { answer };
}

async function settle<T>(answer: Promise<T>): Promise<T> {
  let value: T | undefined;
  await act(async () => {
    value = await answer;
  });
  return value as T;
}

afterEach(() => {
  holdDialogs(false);
});

describe('confirm', () => {
  it('runs the action only after the confirm button, and the destructive variant is red', async () => {
    await render(<DialogLayer root />);
    const { answer } = await ask(() => confirm({ title: 'Delete this thread?', body: 'Its messages are deleted for everyone.', confirm: 'Delete', danger: true, icon: 'trash', testID: 'thread-delete' }));
    expect(screen.getByTestId('thread-delete-title')).toHaveTextContent('Delete this thread?');
    expect(screen.getByTestId('thread-delete-body')).toHaveTextContent('Its messages are deleted for everyone.');
    expect(flatten(screen.getByTestId('thread-delete-confirm').props.style).backgroundColor).toBe(colorsFor('light').dangerBand);
    await fireEvent.press(screen.getByTestId('thread-delete-confirm'));
    expect(await settle(answer)).toBe(true);
    expect(screen.queryByTestId('thread-delete')).toBeNull();
  });

  it('answers no on cancel, on the Android back button and on a tap outside the card', async () => {
    await render(<DialogLayer root />);
    const ways = [
      () => fireEvent.press(screen.getByTestId('dialog-cancel')),
      async () => {
        await act(async () => screen.getByTestId('dialog-modal').props.onRequestClose());
      },
      () => fireEvent.press(screen.getByTestId('dialog-backdrop', { includeHiddenElements: true })),
    ];
    for (const dismiss of ways) {
      const { answer } = await ask(() => confirm({ body: 'Remove your photo?', confirm: 'Remove' }));
      expect(screen.getByTestId('dialog-cancel')).toHaveTextContent('Cancel');
      await dismiss();
      expect(await settle(answer)).toBe(false);
      expect(screen.queryByTestId('dialog')).toBeNull();
    }
  });

  it('shows dialogs one at a time, in the order they were asked', async () => {
    await render(<DialogLayer root />);
    const { answer: first } = await ask(() => confirm({ body: 'First', confirm: 'Yes', testID: 'one' }));
    const { answer: second } = await ask(() => confirm({ body: 'Second', confirm: 'Yes', testID: 'two' }));
    expect(screen.queryByTestId('two')).toBeNull();
    await fireEvent.press(screen.getByTestId('one-cancel'));
    expect(await settle(first)).toBe(false);
    await fireEvent.press(screen.getByTestId('two-confirm'));
    expect(await settle(second)).toBe(true);
  });
});

describe('other dialogs', () => {
  it('inform resolves once its only button is pressed', async () => {
    await render(<DialogLayer root />);
    const { answer: done } = await ask(() => inform({ title: 'Password changed.', body: 'Sign in again.', ok: 'Sign in again', testID: 'password-changed' }));
    expect(screen.queryByTestId('password-changed-cancel')).toBeNull();
    await fireEvent.press(screen.getByTestId('password-changed-ok'));
    await settle(done);
    expect(screen.queryByTestId('password-changed')).toBeNull();
  });

  it('choose returns the picked choice and null when cancelled', async () => {
    await render(<DialogLayer root />);
    const { answer: picked } = await ask(() => choose({ title: 'Ayu', choices: [{ key: 'admin', label: 'Admin' }, { key: 'member', label: 'Member', tone: 'plain' }], testID: 'member-role' }));
    expect(screen.getAllByRole('button').map((button) => button.props.testID)).toEqual(['member-role-admin', 'member-role-member', 'member-role-cancel']);
    await fireEvent.press(screen.getByTestId('member-role-member'));
    expect(await settle(picked)).toBe('member');
    const { answer: cancelled } = await ask(() => choose({ title: 'Ayu', choices: [{ key: 'admin', label: 'Admin' }], testID: 'member-role' }));
    await fireEvent.press(screen.getByTestId('member-role-cancel'));
    expect(await settle(cancelled)).toBeNull();
  });

  it('prompt returns the typed text, keeps confirm off while a required field is empty, and returns null on cancel', async () => {
    await render(<DialogLayer root />);
    const { answer: typed } = await ask(() => prompt({ title: 'Rename', input: { label: 'Name', required: true }, confirm: 'Save', testID: 'rename' }));
    expect(screen.getByTestId('rename-confirm').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByTestId('rename-confirm'));
    expect(screen.getByTestId('rename')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('rename-input'), 'Weekly sync');
    await fireEvent(screen.getByTestId('rename-input'), 'submitEditing');
    expect(await settle(typed)).toBe('Weekly sync');
    const { answer: cancelled } = await ask(() => prompt({ title: 'Rename', input: { label: 'Name', value: 'Old' }, confirm: 'Save', testID: 'rename' }));
    await fireEvent.press(screen.getByTestId('rename-cancel'));
    expect(await settle(cancelled)).toBeNull();
  });
});

describe('layers', () => {
  it('draws the dialog in the topmost overlay and moves it back to the root when that overlay closes', async () => {
    const view = await render(
      <>
        <DialogLayer root />
        <Overlay visible transparent testID="sheet">
          <Text>sheet</Text>
        </Overlay>
      </>,
    );
    const { answer } = await ask(() => confirm({ body: 'Leave Ops?', confirm: 'Leave', testID: 'thread-leave' }));
    expect(screen.getAllByTestId('thread-leave')).toHaveLength(1);
    expect(insideSheet(screen.getByTestId('thread-leave'))).toBe(true);
    await view.rerender(<DialogLayer root />);
    expect(screen.getAllByTestId('thread-leave')).toHaveLength(1);
    expect(insideSheet(screen.getByTestId('thread-leave'))).toBe(false);
    await fireEvent.press(screen.getByTestId('thread-leave-confirm'));
    expect(await settle(answer)).toBe(true);
  });

  it('holds dialogs while the app is locked and shows them after unlock', async () => {
    await render(<DialogLayer root />);
    await act(async () => holdDialogs(true));
    const { answer } = await ask(() => confirm({ body: 'Delete?', confirm: 'Delete', testID: 'held' }));
    expect(screen.queryByTestId('held')).toBeNull();
    await act(async () => holdDialogs(false));
    await fireEvent.press(screen.getByTestId('held-confirm'));
    expect(await settle(answer)).toBe(true);
  });
});

describe('notify', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the text in the snackbar and hides it after the window; empty text shows nothing', async () => {
    await render(<DialogLayer root />);
    await act(async () => notify('   '));
    expect(screen.queryByTestId('snackbar')).toBeNull();
    await act(async () => notify('Table copied as Markdown.'));
    expect(screen.getByTestId('snackbar')).toHaveTextContent('Table copied as Markdown.');
    expect(screen.queryByTestId('undo-action')).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(6000);
    });
    expect(screen.queryByTestId('snackbar')).toBeNull();
  });
});
