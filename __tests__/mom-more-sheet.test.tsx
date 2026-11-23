import { fireEvent, render, screen } from '@testing-library/react-native';
import { createElement } from 'react';
import '../src/i18n';
import { MoreSheet } from '../src/features/mom/MoreSheet';

jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: jest.fn(), removeItemSync: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const people = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ key: `person-${index}`, icon: 'people' as const, label: index === 3 ? 'Budi (Payroll)' : `Person ${index}`, onPress: jest.fn() }));

describe('MoreSheet', () => {
  it('offers a search once a list is long and keeps only what matches', async () => {
    await render(createElement(MoreSheet, { title: 'Owner', groups: [{ key: 'people', actions: people(14) }], onClose: jest.fn(), testID: 'pick' }));
    expect(screen.getByTestId('mom-more-person-13')).toBeTruthy();
    await fireEvent(screen.getByTestId('pick-search'), 'focus');
    expect(screen.getByTestId('pick')).toHaveStyle({ borderRadius: 28 });
    await fireEvent.changeText(screen.getByTestId('pick-search'), 'payroll');
    expect(screen.getByTestId('mom-more-person-3')).toBeTruthy();
    expect(screen.queryByTestId('mom-more-person-13')).toBeNull();
  });

  it('shows no search for a short menu, and a chosen action closes the sheet before it runs', async () => {
    const onClose = jest.fn();
    const actions = people(12);
    await render(createElement(MoreSheet, { title: 'More', groups: [{ key: 'menu', actions }], onClose, testID: 'menu' }));
    expect(screen.queryByTestId('menu-search')).toBeNull();
    await fireEvent.press(screen.getByTestId('mom-more-person-1'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(actions[1].onPress).toHaveBeenCalledTimes(1);
  });
});
