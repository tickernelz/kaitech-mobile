import { draftOf, isLive, suggestionValues, type SolusiItem } from '../src/features/mom/assist';

jest.mock('../src/api/odoo', () => ({ rpc: jest.fn() }));

const item = {
  id: 3,
  sequence: 1,
  need: 'Payroll per branch',
  title: 'Use Payroll',
  approach: 'ODOO_CUSTOM',
  odooModules: ['hr_payroll', 'account'],
  steps: ['Install', 'Map salary rules'],
  effort: 'MEDIUM',
  notes: '',
  selectionReason: '',
  contextBasis: [],
  customWithoutReason: true,
  touchpointTag: '',
  requirement: { id: 8, ref: 'R-8', text: 'Payroll' },
  approved: false,
  draftedBy: 'Coworker',
  reusedFrom: false,
  scope: false,
  job: false,
} as SolusiItem;

describe('solution item edits write what the web writes', () => {
  it('maps the approach and turns lists back into the stored text, empty fields into false', () => {
    const draft = { ...draftOf(item), modules: ' hr_payroll , , account ', steps: 'Install\n\n Map salary rules ', reason: '  ' };
    expect(suggestionValues(draft)).toEqual({
      name: 'Use Payroll',
      finding: 'Payroll per branch',
      approach: 'custom',
      mom_modules: 'hr_payroll,account',
      mom_steps: 'Install\nMap salary rules',
      mom_effort: 'MEDIUM',
      mom_notes: false,
      mom_selection_reason: false,
      mom_touchpoint: false,
      requirement_id: 8,
    });
    expect(suggestionValues({ ...draft, approach: 'NON_ODOO', requirement: false }).approach).toBe('non_odoo');
  });

  it('treats queued, running and retrying as a job still working', () => {
    expect(['queued', 'running', 'retrying', 'done', 'failed'].map((state) => isLive({ state, label: '', message: '' }))).toEqual([true, true, true, false, false]);
    expect(isLive(false)).toBe(false);
  });
});
