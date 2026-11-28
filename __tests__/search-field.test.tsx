import { fireEvent, render, screen } from '@testing-library/react-native';
import { createElement } from 'react';
import { StyleSheet } from 'react-native';
import { SearchField } from '../src/ui/SearchField';

jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: jest.fn(), removeItemSync: jest.fn() }));

const outline = () => {
  const { borderColor, borderWidth } = StyleSheet.flatten(screen.getByTestId('find').parent?.props.style);
  return { borderColor, borderWidth };
};

describe('SearchField', () => {
  it('draws the focus outline while focused and still runs the caller focus handlers', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await render(createElement(SearchField, { label: 'Search', onFocus, onBlur, testID: 'find' }));
    const resting = outline();
    await fireEvent(screen.getByTestId('find'), 'focus');
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(outline()).toEqual({ borderColor: expect.not.stringMatching(resting.borderColor), borderWidth: 2 });
    await fireEvent(screen.getByTestId('find'), 'blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(outline()).toEqual(resting);
  });
});
