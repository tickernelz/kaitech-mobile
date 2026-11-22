import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as api from '../src/features/records/api';
import { RecordScreen } from '../src/features/records/RecordScreen';
import { unstash } from '../src/features/records/stash';
import type { RecordStash } from '../src/features/records/useRunAction';

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
  loadAction: jest.fn(),
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

it('opens a wizard from an action button with the record as its active_id, as the web does', async () => {
  const wizardArch = arch.replace('action_submit" type="object"', '42" type="action"');
  mocked.getViews.mockResolvedValue({ views: { form: { arch: wizardArch, id: 1 } }, models: { 'ck.x': { fields } } });
  mocked.readRecord.mockResolvedValue({ id: 7, name: 'Plan', state: 'draft', note: 'n', display_name: 'Plan' });
  mocked.loadAction.mockResolvedValue({ type: 'ir.actions.act_window', res_model: 'ck.x.wizard', target: 'new', views: [[false, 'form']], context: "{'default_source_id': active_id}" });
  const view = await render(<RecordScreen programme={1} model="ck.x" rid={7} />);
  await fireEvent.press(await view.findByTestId('button-42'));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());
  expect(mocked.loadAction).toHaveBeenCalledWith(account, 42, expect.objectContaining({ active_id: 7 }));
  const pushed = mockRouter.push.mock.calls[0][0] as { params: { model: string; stash: string } };
  expect(pushed.params.model).toBe('ck.x.wizard');
  const held = unstash<RecordStash>(pushed.params.stash);
  expect(held?.wizard).toBe(true);
  expect(held?.context).toMatchObject({ default_source_id: 7, active_id: 7, active_ids: [7], active_model: 'ck.x' });
});

it('shows the server reason when a button is refused and keeps the record as it was', async () => {
  const { ApiError } = jest.requireActual('../src/api/odoo');
  mocked.readRecord.mockResolvedValue({ id: 7, name: 'Plan', state: 'draft', note: 'n', display_name: 'Plan' });
  mocked.callButton.mockRejectedValue(new ApiError('refused', 200, 'Only the programme lead can submit.'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const view = await render(<RecordScreen programme={1} model="ck.x" rid={7} />);
  await fireEvent.press(await view.findByTestId('button-action_submit'));
  await waitFor(() => expect(alert).toHaveBeenCalledWith('', 'Only the programme lead can submit.'));
  expect(view.getByText('Submit For Review')).toBeTruthy();
  alert.mockRestore();
});

const unreadableArch = `<form><header>
  <button name="action_soon" type="object" string="Only Later" invisible="relativedelta(days=1)"/>
  <button name="action_mystery" type="object" string="Unknown Rule" invisible="not_a_field"/>
  <button name="action_submit" type="object" string="Submit For Review" invisible="state != 'draft'"/>
  </header><sheet><group>
  <field name="name"/>
  <field name="note" readonly="relativedelta(days=1)"/>
  </group></sheet></form>`;

it('hides a button and locks a field whose condition the app cannot read, so a new server rule never opens them by mistake', async () => {
  mocked.getViews.mockResolvedValue({ views: { form: { arch: unreadableArch, id: 1 } }, models: { 'ck.x': { fields } } });
  mocked.readRecord.mockResolvedValue({ id: 7, name: 'Plan', state: 'draft', note: 'Locked text', display_name: 'Plan' });
  const view = await render(<RecordScreen programme={1} model="ck.x" rid={7} />);
  await view.findByText('Submit For Review');
  expect(view.queryByText('Only Later')).toBeNull();
  expect(view.queryByText('Unknown Rule')).toBeNull();
  await fireEvent.press(view.getByTestId('record-edit'));
  await view.findByDisplayValue('Plan');
  expect(view.queryByDisplayValue('Locked text')).toBeNull();
  expect(view.getByText('Locked text')).toBeTruthy();
});

it('saves only what the web would send: editable fields and force_save, never a readonly field an onchange filled', async () => {
  const saveFields: api.Fields = { ...fields, code: { type: 'char', string: 'Code' }, ref: { type: 'char', string: 'Ref' } };
  const saveArch = '<form><sheet><group><field name="name" on_change="1"/><field name="code" readonly="1"/><field name="ref" readonly="1" force_save="1"/><field name="note"/></group></sheet></form>';
  mocked.getViews.mockResolvedValue({ views: { form: { arch: saveArch, id: 1 } }, models: { 'ck.x': { fields: saveFields } } });
  mocked.readRecord.mockResolvedValue({ id: 7, name: 'Plan', code: 'C1', ref: 'R1', note: 'n', display_name: 'Plan' });
  mocked.onchange.mockResolvedValue({ value: { code: 'C2', ref: 'R2' } });
  mocked.saveRecord.mockResolvedValue({ id: 7, name: 'Plan B', code: 'C2', ref: 'R2', note: 'n', display_name: 'Plan B' });
  const view = await render(<RecordScreen programme={1} model="ck.x" rid={7} />);
  await fireEvent.press(await view.findByTestId('record-edit'));
  await fireEvent.changeText(await view.findByDisplayValue('Plan'), 'Plan B');
  await waitFor(() => expect(mocked.onchange).toHaveBeenCalled());
  await fireEvent.press(view.getByTestId('record-save'));
  await waitFor(() => expect(mocked.saveRecord).toHaveBeenCalled());
  expect(mocked.saveRecord.mock.calls[0][3]).toEqual({ name: 'Plan B', ref: 'R2' });
});
