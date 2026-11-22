import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as api from '../src/features/records/api';
import { RecordListScreen } from '../src/features/records/RecordListScreen';
import { stash } from '../src/features/records/stash';
import { ApiError } from '../src/api/odoo';

jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined } }));

const account = { id: 'u2_x', origin: 'https://odoo.test', db: 'lab0', userId: 2, partnerId: 3, deviceId: 4, name: 'T', login: 't', signedInAt: 0 };
const mockRouter = { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() };

jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useFocusEffect: () => undefined }));
jest.mock('@shopify/flash-list', () => {
  const { FlatList } = require('react-native');
  return { FlashList: FlatList };
});
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return {
    __esModule: true,
    default: { View },
    FadeIn: chain(),
    FadeInDown: chain(),
    Easing: chain(),
    useReducedMotion: () => true,
    useSharedValue: (value: unknown) => ({ get: () => value, set: () => undefined }),
    useAnimatedStyle: (style: () => object) => style(),
    withTiming: (value: unknown) => value,
  };
});
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('../src/features/chat/files', () => ({ downloadForOpening: jest.fn() }));
jest.mock('../src/auth/session', () => ({ useSession: () => ({ active: account }), onAccountForgotten: () => () => undefined }));
jest.mock('../src/features/records/api', () => ({
  ...jest.requireActual('../src/features/records/api'),
  getViews: jest.fn(),
  loadAction: jest.fn(),
  searchRecords: jest.fn(),
  readGroups: jest.fn(),
}));

const mocked = api as jest.Mocked<typeof api>;

const fields: api.Fields = {
  name: { type: 'char', string: 'Name' },
  state: { type: 'selection', string: 'Status', selection: [['draft', 'Draft'], ['accepted', 'Accepted']] },
  engagement_id: { type: 'many2one', string: 'Programme', relation: 'ck.engagement' },
};

const action: api.WindowAction = {
  type: 'ir.actions.act_window',
  name: 'Glossary',
  res_model: 'ck.glossary.term',
  views: [
    [false, 'list'],
    [false, 'form'],
  ],
  context: "{'search_default_draft': 1, 'search_default_by_programme': 1}",
};

beforeEach(() => {
  jest.clearAllMocks();
  mocked.getViews.mockResolvedValue({
    views: {
      list: { arch: '<list><field name="name"/><field name="state" widget="badge"/><field name="engagement_id"/></list>', id: 1 },
      form: { arch: '<form><sheet><field name="name"/></sheet></form>', id: 2 },
      search: { arch: `<search><field name="name"/><filter name="draft" string="Draft" domain="[('state', '=', 'draft')]"/><filter name="by_programme" string="Programme" context="{'group_by': 'engagement_id'}"/><filter name="by_state" string="Status" context="{'group_by': 'state'}"/></search>`, id: 3 },
    },
    models: { 'ck.glossary.term': { fields } },
  });
});

it('lists this programme and shared rows with the default filters, skips grouping by the programme, and opens a record', async () => {
  mocked.searchRecords.mockResolvedValue({ length: 1, records: [{ id: 5, name: 'SPK', state: 'draft', engagement_id: { id: 48, display_name: 'Uji' }, display_name: 'SPK' }] });
  const view = await render(<RecordListScreen programme={48} stashKey={stash({ action })} />);
  await view.findByText('SPK');
  const query = mocked.searchRecords.mock.calls[0][2];
  expect(query.domain).toEqual(['&', '|', ['engagement_id', '=', 48], ['engagement_id', '=', false], ['state', '=', 'draft']]);
  expect(mocked.readGroups).not.toHaveBeenCalled();
  await fireEvent.press(view.getByTestId('list-row-5'));
  expect(mockRouter.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/program/[id]/record', params: expect.objectContaining({ model: 'ck.glossary.term', rid: '5' }) }));
});

it('says the list is empty instead of showing a blank screen', async () => {
  mocked.searchRecords.mockResolvedValue({ length: 0, records: [] });
  const view = await render(<RecordListScreen programme={48} stashKey={stash({ action })} />);
  await view.findByTestId('list-rows-empty');
});

it('shows the error with a retry when the server refuses, and loads again on retry', async () => {
  mocked.searchRecords.mockRejectedValueOnce(new ApiError('forbidden', 200, 'No access')).mockResolvedValue({ length: 1, records: [{ id: 6, name: 'BAST', state: 'draft', engagement_id: false, display_name: 'BAST' }] });
  const view = await render(<RecordListScreen programme={48} stashKey={stash({ action })} />);
  await view.findByTestId('list-error');
  await fireEvent.press(view.getByText(/Try again|Coba lagi/));
  await view.findByText('BAST');
});

it('groups by another field on request and opens one group as a filtered list', async () => {
  mocked.searchRecords.mockResolvedValue({ length: 0, records: [] });
  mocked.readGroups.mockResolvedValue([{ state: 'accepted', __count: 3, __extra_domain: [['state', '=', 'accepted']] }]);
  const view = await render(<RecordListScreen programme={48} stashKey={stash({ action })} />);
  await view.findByTestId('list-rows-empty');
  await fireEvent.press(view.getByTestId('list-filters'));
  await fireEvent.press(view.getByTestId('list-filter-sheet-by_state'));
  await view.findByText('Accepted');
  expect(mocked.readGroups).toHaveBeenCalledWith(account, 'ck.glossary.term', ['&', '|', ['engagement_id', '=', 48], ['engagement_id', '=', false], ['state', '=', 'draft']], 'state', expect.any(Object));
  await fireEvent.press(view.getByTestId('list-group'));
  await waitFor(() => expect(mocked.searchRecords.mock.calls.at(-1)?.[2].domain).toEqual(['&', '&', '|', ['engagement_id', '=', 48], ['engagement_id', '=', false], ['state', '=', 'draft'], ['state', '=', 'accepted']]));
});
