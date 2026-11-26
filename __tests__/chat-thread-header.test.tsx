jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined } }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: () => null, Path: () => null }));
jest.mock('../src/features/chat/ui/Avatar', () => {
  const { createElement } = require('react');
  const { View } = require('react-native');
  return { Avatar: ({ size }: { size: number }) => createElement(View, { style: { width: size, height: size } }) };
});
jest.mock('../src/features/call/ui/CallButton', () => {
  const { createElement } = require('react');
  const { View } = require('react-native');
  return { CallButton: () => createElement(View, { style: { width: 44, height: 44, marginLeft: 4 }, testID: 'call-start' }) };
});
require('../src/i18n');
import { measure, type Scene } from './fixtures/measure';
import { ThreadHeader, type ThreadHeaderProps } from '../src/features/chat/ui/thread/ThreadHeader';

const phone = 411;
const name = 'Uji Chat Web (ZHA-7238)';

function header(width: number, extra: Partial<ThreadHeaderProps> = {}, testID = 'thread-title'): Scene {
  return {
    width,
    testID,
    element: (
      <ThreadHeader
        channelId={7}
        name={name}
        subtitle="12 members"
        typing={false}
        status={null}
        avatar={{ seed: 7, icon: 'people' }}
        call
        onBack={() => undefined}
        onMore={() => undefined}
        {...extra}
      />
    ),
  };
}

describe('thread header title room', () => {
  it('leaves the title at least 200 dp on a 411 dp phone with back, avatar, call and more', () => {
    const box = measure({ title: header(phone) }).title;
    expect(box.width).toBeGreaterThanOrEqual(200);
  });

  it('fits the 23-character audit title in one line on a 411 dp phone', () => {
    const box = measure({ title: header(phone) }).title;
    expect(box.width).toBeGreaterThanOrEqual(name.length * 8);
  });

  it('keeps the more button inside the screen edge', () => {
    const box = measure({ more: header(phone, {}, 'thread-more') }).more;
    expect(box.right).toBeGreaterThanOrEqual(4);
    expect(box.width).toBe(44);
  });

  it('lets the title wrap to two lines under large text and keeps one line otherwise', async () => {
    const { render, screen } = require('@testing-library/react-native') as typeof import('@testing-library/react-native');
    await render(header(phone, { largeText: true }).element);
    expect(screen.getByTestId('thread-title').props.numberOfLines).toBe(2);
    await render(header(phone).element);
    expect(screen.getByTestId('thread-title').props.numberOfLines).toBe(1);
  });

  it('indents the avatar from the edge when there is no back button, as in two-pane', () => {
    const box = measure({ person: header(1194, { onBack: undefined }, 'thread-person') }).person;
    expect(box.left).toBeGreaterThanOrEqual(12);
  });
});
