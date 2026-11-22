import { rpc } from '../src/api/odoo';
import type { Account } from '../src/auth/oauth';
import { getViews, groupsOfMenus, specOf, type Fields, type MenuRow } from '../src/features/records/api';
import { andDomains, defaultFilters, filtersDomain, normalize, orDomains, textDomain } from '../src/features/records/domain';
import { changedValues, scopeOf, textOfValue, visible } from '../src/features/records/model';
import { architectureBlock, processBlock } from '../src/features/records/shapes';
import { compileForm, compileList, compileSearch } from '../src/features/records/views';

jest.mock('../src/api/odoo', () => ({ rpc: jest.fn(async () => ({ views: {}, models: {} })), route: jest.fn(), serverLanguage: () => 'en_US' }));
jest.mock('../src/auth/session', () => {
  const forgotten: ((id: string) => void)[] = [];
  return { onAccountForgotten: (listener: (id: string) => void) => forgotten.push(listener), forget: (id: string) => forgotten.forEach((listener) => listener(id)) };
});

const fields: Fields = {
  name: { type: 'char', string: 'Name' },
  state: { type: 'selection', string: 'Status', selection: [['draft', 'Draft'], ['review', 'In Review']] },
  engagement_id: { type: 'many2one', string: 'Programme', relation: 'ck.engagement' },
  tag_ids: { type: 'many2many', string: 'Tags', relation: 'ck.tag' },
  line_ids: { type: 'one2many', string: 'Lines', relation: 'ck.line', relation_field: 'parent_id' },
  is_default: { type: 'boolean', string: 'Default' },
  note: { type: 'html', string: 'Note' },
  locked: { type: 'boolean', string: 'Locked' },
};

const form = `<form create="false">
  <header>
    <button name="action_submit_for_review" type="object" string="Submit For Review" class="oe_highlight" invisible="state != 'draft'"/>
    <button name="42" type="action" string="Settle" invisible="state != 'draft' or is_default"/>
    <button name="action_archive" type="object" string="Archive" confirm="Sure?"/>
    <button special="cancel" string="Cancel"/>
    <field name="state" widget="statusbar" statusbar_visible="draft,review"/>
  </header>
  <sheet>
    <div class="oe_button_box" name="button_box">
      <button name="action_open_lines" type="object" invisible="not line_ids"><field name="line_ids" string="Lines"/></button>
    </div>
    <widget name="ck_interview_watch"/>
    <div class="alert alert-warning" invisible="not locked">This baseline is locked.</div>
    <div class="oe_title"><h1><field name="name"/></h1></div>
    <group>
      <group><field name="engagement_id" readonly="locked"/><field name="is_default" invisible="1"/></group>
      <group><field name="tag_ids" widget="many2many_tags"/></group>
    </group>
    <notebook>
      <page string="Lines" invisible="state == 'draft'"><field name="line_ids"><list><field name="name"/></list></field></page>
      <page string="Notes"><field name="note"/></page>
    </notebook>
  </sheet>
  <chatter/>
</form>`;

describe('form view compiler', () => {
  const spec = compileForm(form, fields);

  it('keeps header buttons with their conditions and drops the cancel button', () => {
    expect(spec.header.map((button) => [button.name, button.type, button.primary])).toEqual([
      ['action_submit_for_review', 'object', true],
      ['42', 'action', false],
      ['action_archive', 'object', false],
    ]);
    expect(spec.header[2].confirm).toBe('Sure?');
    expect(spec.statusbar).toEqual({ name: 'state', visible: ['draft', 'review'] });
    expect(spec.create).toBe(false);
    expect(spec.edit).toBe(true);
  });

  it('shows the same buttons the web shows for a record', () => {
    const draft = scopeOf({ id: 1, state: 'draft', is_default: false }, fields, {}, 2);
    const review = scopeOf({ id: 1, state: 'review', is_default: false }, fields, {}, 2);
    expect(spec.header.filter((button) => visible(button.invisible, draft)).map((button) => button.name)).toEqual(['action_submit_for_review', '42', 'action_archive']);
    expect(spec.header.filter((button) => visible(button.invisible, review)).map((button) => button.name)).toEqual(['action_archive']);
  });

  it('turns groups and notebook pages into titled blocks, keeps page conditions, and finds smart buttons, chatter and widgets', () => {
    expect(spec.title.map((field) => field.name)).toEqual(['name']);
    expect(spec.smart.map((button) => [button.name, button.string])).toEqual([['action_open_lines', 'Lines']]);
    expect(spec.chatter).toBe(true);
    expect(spec.widgets).toEqual(['ck_interview_watch']);
    const titles = spec.blocks.map((block) => [block.title, block.invisible, block.items.map((item) => (item.kind === 'field' ? item.name : item.kind))]);
    expect(titles).toEqual([
      [undefined, [], ['text', 'engagement_id', 'tag_ids']],
      ['Lines', ["state == 'draft'"], ['line_ids']],
      ['Notes', [], ['note']],
    ]);
    expect(spec.names.sort()).toEqual(['engagement_id', 'is_default', 'line_ids', 'locked', 'name', 'note', 'state', 'tag_ids']);
  });

  it('reads names and relations in one request', () => {
    expect(specOf(['engagement_id', 'tag_ids', 'line_ids', 'missing'], fields)).toEqual({
      engagement_id: { fields: { display_name: {} } },
      tag_ids: { fields: { display_name: {} } },
      line_ids: {},
      display_name: {},
    });
  });
});

describe('list and search compilers', () => {
  it('skips hidden and handle columns and keeps create rights', () => {
    const list = compileList(
      '<list delete="0" default_order="id desc"><field name="sequence" widget="handle"/><field name="name"/><field name="state" widget="badge"/><field name="locked" column_invisible="1"/></list>',
      { ...fields, sequence: { type: 'integer', string: 'Seq' } },
    );
    expect(list.columns.map((column) => column.name)).toEqual(['name', 'state']);
    expect(list.create).toBe(true);
    expect(list.remove).toBe(false);
    expect(list.order).toBe('id desc');
  });

  it('ORs filters inside a group, ANDs across groups, and honours search defaults', () => {
    const search = compileSearch(`<search><field name="name" filter_domain="['|', ('name', 'ilike', self), ('code', 'ilike', self)]"/>
      <filter name="draft" string="Draft" domain="[('state', '=', 'draft')]"/>
      <filter name="review" string="Review" domain="[('state', '=', 'review')]"/>
      <separator/>
      <filter name="mine" string="Mine" domain="[('user_id', '=', uid)]"/>
      <filter name="by_state" string="Status" context="{'group_by': 'state'}"/></search>`);
    expect(search.filters.map((filter) => filter.name)).toEqual(['draft', 'review', 'mine']);
    expect(search.groupBys.map((group) => [group.name, group.field])).toEqual([['by_state', 'state']]);
    const active = defaultFilters(search.filters, { search_default_draft: 1, search_default_review: 1, search_default_mine: 1 });
    expect(filtersDomain(search.filters, active, { uid: 7 })).toEqual(['&', '|', ['state', '=', 'draft'], ['state', '=', 'review'], ['user_id', '=', 7]]);
    expect(textDomain(search, 'abc', {})).toEqual(['|', ['name', 'ilike', 'abc'], ['code', 'ilike', 'abc']]);
  });

  it('normalizes implicit ANDs before combining domains', () => {
    expect(normalize([['a', '=', 1], ['b', '=', 2]])).toEqual(['&', ['a', '=', 1], ['b', '=', 2]]);
    expect(orDomains([[['a', '=', 1], ['b', '=', 2]], [['c', '=', 3]]])).toEqual(['|', '&', ['a', '=', 1], ['b', '=', 2], ['c', '=', 3]]);
    expect(andDomains([[], [['c', '=', 3]]])).toEqual([['c', '=', 3]]);
  });
});

describe('record values', () => {
  it('writes only what changed, with many2many as a set command', () => {
    const before = { id: 1, name: 'A', tag_ids: [{ id: 3, display_name: 'x' }], engagement_id: { id: 9, display_name: 'P' } };
    const after = { ...before, tag_ids: [{ id: 3, display_name: 'x' }, { id: 4, display_name: 'y' }], engagement_id: { id: 9, display_name: 'P' } };
    expect(changedValues(before, after, fields)).toEqual({ tag_ids: [[6, 0, [3, 4]]] });
  });

  it('formats selections, html and booleans for reading', () => {
    const format = { number: String, date: () => 'd', day: () => 'day', yes: 'Yes', no: 'No' };
    expect(textOfValue(fields.state, 'review', format)).toBe('In Review');
    expect(textOfValue(fields.note, '<p>One&amp;two</p><p>three</p>', format)).toBe('One&two\nthree');
    expect(textOfValue(fields.locked, false, format)).toBe('No');
  });
});

describe('discovery menus', () => {
  it('groups the web menu tree under the Discovery root, keeping loose screens first', () => {
    const root: MenuRow = { id: 1, name: 'Discovery', parent_id: false, action: false };
    const rows: MenuRow[] = [
      root,
      { id: 2, name: 'Programs', parent_id: [1, 'Discovery'], action: 'ir.actions.act_window,50' },
      { id: 3, name: 'People', parent_id: [1, 'Discovery'], action: false },
      { id: 4, name: 'Departments', parent_id: [3, 'People'], action: 'ir.actions.act_window,61' },
      { id: 5, name: 'Empty', parent_id: [3, 'People'], action: false },
      { id: 6, name: 'Hidden folder child', parent_id: [9, 'Not visible'], action: 'ir.actions.act_window,70' },
    ];
    expect(groupsOfMenus(root, rows)).toEqual([
      { id: 1, name: 'Discovery', sections: [{ menuId: 2, name: 'Programs', actionId: 50, actionModel: 'ir.actions.act_window' }] },
      { id: 3, name: 'People', sections: [{ menuId: 4, name: 'Departments', actionId: 61, actionModel: 'ir.actions.act_window' }] },
    ]);
  });
});

describe('web screens drawn natively', () => {
  it('lays an architecture map out by its columns, with side parts last', () => {
    const block = architectureBlock(
      {
        title: 'Sales',
        notes: [],
        statuses: [],
        columns: [
          { key: 'c1', label: 'Inputs' },
          { key: 'c2', label: 'Core' },
        ],
        nodes: [
          { key: 'n1', id: 1, title: 'Order', sub: '', column: 'c2', home: '', status: 'gap', body: [], points: [], facts: [], gap: '', note: '' },
          { key: 'n2', id: 2, title: 'Bank', sub: '', column: '_side', home: '', status: 'fit', body: [], points: [], facts: [], gap: '', note: '' },
        ],
        links: [
          { from: 'n1', to: 'n2', label: '' },
          { from: 'n1', to: 'gone', label: '' },
        ],
      },
      'Side',
    );
    expect(block.lanes).toEqual(['Core', 'Side']);
    expect(block.nodes.map((node) => [node.lane, node.tone])).toEqual([
      ['Core', 'bad'],
      ['Side', 'good'],
    ]);
    expect(block.edges).toEqual([{ from: 'n1', to: 'n2', label: '' }]);
  });

  it('chains process steps in order and marks steps without an actor', () => {
    const block = processBlock(
      {
        level: 'swimlane',
        title: 'P',
        nodes: [
          { key: 'a', label: 'Ask', lane: 'Sales', done_by: 'Ana', step_labels: ['Ask'], actor_missing: false, unconfirmed: false },
          { key: 'b', label: 'Pay', lane: '', done_by: '', step_labels: ['Pay'], actor_missing: true, unconfirmed: false },
        ],
        lanes: [{ label: 'Sales' }, { label: '' }],
        findings: [],
      },
      { doneBy: 'By', noActor: 'Nobody', process: 'Process' },
    );
    expect(block.lanes).toEqual(['Sales', 'Nobody']);
    expect(block.edges).toEqual([{ from: 'a', to: 'b', label: '' }]);
    expect(block.nodes[1]).toMatchObject({ lane: 'Nobody', tone: 'bad', detail: 'Nobody' });
  });
});

describe('view cache', () => {
  it('asks the server again after the account signs out, so a changed group never shows stale buttons', async () => {
    const account = { id: 'u2_x' } as Account;
    const mockedRpc = rpc as jest.Mock;
    mockedRpc.mockClear();
    await getViews(account, 'ck.raid', [[false, 'form']]);
    await getViews(account, 'ck.raid', [[false, 'form']]);
    expect(mockedRpc).toHaveBeenCalledTimes(1);
    jest.requireMock<{ forget: (id: string) => void }>('../src/auth/session').forget('u2_x');
    await getViews(account, 'ck.raid', [[false, 'form']]);
    expect(mockedRpc).toHaveBeenCalledTimes(2);
  });
});
