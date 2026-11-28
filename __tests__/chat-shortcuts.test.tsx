import { createElement } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';

let mockFontScale = 1;
let mockWidth = 393;

jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('../src/layout/windowClass', () => ({
  ...jest.requireActual('../src/layout/windowClass'),
  useWindowClass: () => ({ windowClass: 'compact', width: mockWidth, height: 800, landscape: false, short: false }),
  useLargeText: () => mockFontScale >= 1.5,
}));

const { ChatShortcuts } = require('../src/features/chat/ui/ChatShortcuts') as typeof import('../src/features/chat/ui/ChatShortcuts');

const hidden = { includeHiddenElements: true };
const starred = { key: 'starred', icon: 'star' as const, label: 'Berbintang', count: 30, onPress: jest.fn(), testID: 'chat-starred-open' };
const tickets = { key: 'tickets', icon: 'ticket' as const, label: 'Tiket', count: 0, onPress: jest.fn(), testID: 'chat-tickets-open' };

beforeEach(() => {
  mockFontScale = 1;
  mockWidth = 393;
});

describe('Starred and Tickets shortcuts', () => {
  it('puts both cells in one row, each its own labelled button with its own icon', async () => {
    await render(createElement(ChatShortcuts, { cells: [starred, tickets] }));
    const row = screen.getByTestId('chat-shortcuts');
    const star = within(row).getByTestId('chat-starred-open');
    const ticket = within(row).getByTestId('chat-tickets-open');
    expect(star.props.accessibilityLabel).toBe('Berbintang, 30');
    expect(ticket.props.accessibilityLabel).toBe('Tiket');
    expect(within(star).getByTestId('icon-star', hidden)).toBeTruthy();
    expect(within(ticket).getByTestId('icon-ticket', hidden)).toBeTruthy();
  });

  it('opens the sheet of the cell that was pressed', async () => {
    await render(createElement(ChatShortcuts, { cells: [starred, tickets] }));
    await fireEvent.press(screen.getByTestId('chat-tickets-open'));
    expect(tickets.onPress).toHaveBeenCalled();
    expect(starred.onPress).not.toHaveBeenCalled();
  });

  it('gives a lone cell the whole row and draws nothing without cells', async () => {
    await render(createElement(ChatShortcuts, { cells: [tickets] }));
    expect(screen.getByTestId('chat-shortcuts')).toBeTruthy();
    expect(screen.queryByTestId('chat-starred-open')).toBeNull();
    await render(createElement(ChatShortcuts, { cells: [] }));
    expect(screen.queryByTestId('chat-shortcuts')).toBeNull();
  });

  it.each([
    ['font scale 1.5', 1.5, 393],
    ['a 320 dp window', 1, 320],
  ])('stacks the cells instead of cutting labels at %s', async (_case, scale, width) => {
    mockFontScale = scale;
    mockWidth = width;
    await render(createElement(ChatShortcuts, { cells: [starred, tickets] }));
    expect(screen.getByTestId('chat-shortcuts-stacked')).toBeTruthy();
    expect(screen.queryByTestId('chat-shortcuts')).toBeNull();
  });
});
