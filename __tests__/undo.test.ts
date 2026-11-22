const undo = require('../src/ui/undo') as typeof import('../src/ui/undo');

async function settle() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('undo window', () => {
  it('sends a waiting action at once when the app goes to the background', async () => {
    const item = { apply: jest.fn(), revert: jest.fn(), commit: jest.fn(async () => true) };
    undo.deferUndoable({ label: 'one', ...item });
    undo.flushUndo();
    await settle();
    expect(item.commit).toHaveBeenCalledTimes(1);
    undo.undoLast();
    expect(item.revert).not.toHaveBeenCalled();
  });

  it('sends the earlier action at once when a second destructive action starts', async () => {
    const first = { apply: jest.fn(), revert: jest.fn(), commit: jest.fn(async () => true) };
    const second = { apply: jest.fn(), revert: jest.fn(), commit: jest.fn(async () => true) };
    undo.deferUndoable({ label: 'one', ...first });
    undo.deferUndoable({ label: 'two', ...second });
    await settle();
    expect(first.commit).toHaveBeenCalledTimes(1);
    expect(second.commit).not.toHaveBeenCalled();
    undo.undoLast();
    expect(second.revert).toHaveBeenCalledTimes(1);
    expect(first.revert).not.toHaveBeenCalled();
    jest.advanceTimersByTime(undo.undoWindowMs * 2);
    await settle();
    expect(second.commit).not.toHaveBeenCalled();
  });
});
