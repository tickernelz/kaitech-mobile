import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as api from '../src/features/records/api';
import { RecordScreen } from '../src/features/records/RecordScreen';

jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined } }));

const account = { id: 'u2_x', origin: 'https://odoo.test', db: 'lab0', userId: 2, partnerId: 3, deviceId: 4, name: 'T', login: 't', signedInAt: 0 };
const mockRouter = { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() };

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
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
  readRecord: jest.fn(),
  callButton: jest.fn(),
  onchange: jest.fn(),
  saveRecord: jest.fn(),
  messages: jest.fn(async () => []),
}));

const mocked = api as jest.Mocked<typeof api>;

const fields: api.Fields = {
  name: { type: 'char', string: 'Name' },
  state: { type: 'selection', string: 'Status', selection: [['draft', 'Draft'], ['review', 'In Review']] },
  note: { type: 'text', string: 'Note', required: true },
};

const arch = `<form><header>
  <button name="action_submit" type="object" string="Submit For Review" class="oe_highlight" invisible="state != 'draft'"/>
  <button name="action_back" type="object" string="Back To Draft" invisible="state == 'draft'"/>
  <field name="state" widget="statusbar"/></header>
  <sheet><div class="oe_title"><h1><field name="name"/></h1></div><group><field name="note"/></group></sheet></form>`;

beforeEach(() => {
  jest.clearAllMocks();
  mocked.getViews.mockResolvedValue({ views: { form: { arch, id: 1 } }, models: { 'ck.x': { fields } } });
});

it('shows the buttons the web shows for the state and calls the method on the record', async () => {
  mocked.readRecord.mockResolvedValueOnce({ id: 7, name: 'Plan', state: 'draft', note: 'n', display_name: 'Plan' }).mockResolvedValue({ id: 7, name: 'Plan', state: 'review', note: 'n', display_name: 'Plan' });
  mocked.callButton.mockResolvedValue(false);
  const view = await render(<RecordScreen programme={1} model="ck.x" rid={7} />);
  await view.findByText('Submit For Review');
  expect(view.queryByText('Back To Draft')).toBeNull();
  await fireEvent.press(view.getByTestId('button-action_submit'));
  await view.findByText('Back To Draft');
  expect(mocked.callButton).toHaveBeenCalledWith(account, 'ck.x', 'action_submit', [7], expect.objectContaining({ active_id: 7, active_model: 'ck.x' }));
  expect(view.queryByText('Submit For Review')).toBeNull();
});

it('refuses to save a new record until the required fields the web requires are filled', async () => {
  mocked.onchange.mockResolvedValue({ value: { state: 'draft' } });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const view = await render(<RecordScreen programme={1} model="ck.x" rid={null} />);
  await fireEvent.press(await view.findByTestId('record-save'));
  await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.any(String), 'Note'));
  expect(mocked.saveRecord).not.toHaveBeenCalled();
  alert.mockRestore();
});
