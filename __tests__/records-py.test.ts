import { condition, evaluate, literal, today } from '../src/features/records/py';
import { parseXml, textOf } from '../src/features/records/xml';

describe('python expressions from Odoo views', () => {
  const record = { state: 'draft', decided_by_id: false, initiative_state: 'paused', is_default: false, kind: 't1_baseline', locked: false, evidence_ids: [], stands_count: 0 };

  it.each([
    ["state != 'draft'", false],
    ["state != 'draft' or is_default", false],
    ['not decided_by_id', true],
    ["state in ('review', 'approved', 'signed', 'archived')", false],
    ["state not in ('not_started', 'draft')", false],
    ["state == 'closed' or initiative_state != 'paused'", false],
    ["kind != 't1_baseline' or locked or state != 'active'", true],
    ['not evidence_ids', true],
    ['stands_count == 0', true],
    ["context.get('default_engagement_id')", false],
  ])('%s', (source, expected) => {
    expect(condition(source, { ...record, context: {} }, true)).toBe(expected);
  });

  it('hides on an expression it cannot read, so a button never shows by mistake', () => {
    expect(condition('relativedelta(days=1)', record, true)).toBe(true);
    expect(condition('unknown_field', record, true)).toBe(true);
  });

  it('reads domains with tuples, booleans, parent and context_today', () => {
    expect(literal("[('kind', '=', 't2_delivery'), ('version', '>', 1), ('revision_trigger', '=', False)]", {}, [])).toEqual([
      ['kind', '=', 't2_delivery'],
      ['version', '>', 1],
      ['revision_trigger', '=', false],
    ]);
    expect(literal("[('engagement_id', '=', parent.id)]", { parent: { id: 9 } }, [])).toEqual([['engagement_id', '=', 9]]);
    expect(evaluate("context_today().strftime('%Y-%m-%d')")).toBe(today().iso);
    expect(literal("['|', ('a', '=', 1), ('b', '!=', None)]", {}, [])).toEqual(['|', ['a', '=', 1], ['b', '!=', null]]);
  });

  it('reads action contexts with active_id and search defaults', () => {
    expect(literal("{'default_engagement_id': active_id, 'search_default_live': 1}", { active_id: 4 }, {})).toEqual({ default_engagement_id: 4, search_default_live: 1 });
  });

  it('follows python truthiness and precedence', () => {
    expect(evaluate('1 if [] else 2')).toBe(2);
    expect(evaluate('not 0 and 3')).toBe(3);
    expect(evaluate("'a' in 'abc' and 2 * 3 + 1 == 7")).toBe(true);
    expect(evaluate('{} or None')).toBe(null);
  });
});

describe('view xml', () => {
  it('parses attributes, entities, self-closing tags and text', () => {
    const node = parseXml('<form create="false"><header><button name="action_x" string="Send &amp; Close" invisible="state != \'draft\'"/></header><p>Hello <b>you</b></p></form>');
    expect(node.tag).toBe('form');
    expect(node.attrs.create).toBe('false');
    const button = (node.children[0] as typeof node).children[0] as typeof node;
    expect(button.attrs).toEqual({ name: 'action_x', string: 'Send & Close', invisible: "state != 'draft'" });
    expect(textOf(node.children[1] as typeof node)).toBe('Hello you');
  });
});
