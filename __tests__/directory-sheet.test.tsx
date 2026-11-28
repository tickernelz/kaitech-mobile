import { render, screen, waitFor } from '@testing-library/react-native';
import type { DirectoryPerson } from '../src/features/chat/directory';

require('../src/i18n');

const mockLoad = jest.fn<Promise<{ ok: true; value: DirectoryPerson[] }>, []>();

jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined } }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return { __esModule: true, default: { View }, Easing: chain(), useReducedMotion: () => true, useSharedValue: (value: unknown) => ({ get: () => value, set: () => undefined }), useAnimatedStyle: (style: () => object) => style(), withTiming: (value: unknown) => value };
});
jest.mock('../src/ui/Sheet', () => {
  const { View } = jest.requireActual('react-native');
  return { Sheet: ({ children, testID }: { children: unknown; testID?: string }) => <View testID={testID}>{children as never}</View> };
});
jest.mock('../src/features/chat/ui/Avatar', () => ({ Avatar: () => null }));
jest.mock('../src/features/chat/newConversation', () => ({ loadDirectory: () => mockLoad(), openChatWith: jest.fn() }));

const { DirectorySheet } = require('../src/features/chat/ui/list/DirectorySheet') as typeof import('../src/features/chat/ui/list/DirectorySheet');

describe('DirectorySheet', () => {
  it('says what the Coworker does and names the role and programme of a person', async () => {
    mockLoad.mockResolvedValue({
      ok: true,
      value: [
        { partnerId: 7, name: 'Coworker', role: 'Coworker', programme: '' },
        { partnerId: 8, name: 'Khusnul', role: 'Lead', programme: 'Duta Cemerlang' },
      ],
    });
    await render(<DirectorySheet onClose={() => undefined} onOpen={() => undefined} />);
    await waitFor(() => expect(screen.getByTestId('directory-7')).toHaveTextContent('CoworkerAnswers about your programmes'));
    expect(screen.getByTestId('directory-8')).toHaveTextContent('KhusnulProgramme lead · Duta Cemerlang');
  });
});
