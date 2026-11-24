import { shownKey, thresholdProblem } from '../src/features/mom/admin';
import { employeeValues } from '../src/features/mom/clientOrg';

jest.mock('../src/api/odoo', () => ({ rpc: jest.fn() }));

describe('MoM administration', () => {
  it('reads the key shown once from the action the identity check returns, nothing from another action', () => {
    const action = {
      res_model: 'ck.mom.mcp.key.show',
      context: { default_key: 'k1', default_url: 'https://x/mcp', default_header: 'Authorization: Bearer k1', default_claude_desktop: '{}', default_hermes_env: 'T=k1', default_hermes_config: 'mcp' },
    };
    expect(shownKey(action)).toEqual({ key: 'k1', url: 'https://x/mcp', header: 'Authorization: Bearer k1', claude_desktop: '{}', hermes_env: 'T=k1', hermes_config: 'mcp' });
    expect(shownKey({ res_model: 'res.users.identitycheck', res_id: 4 })).toBeNull();
  });

  it('holds thresholds outside 0..1 and a different score above the same score, like the server', () => {
    expect(thresholdProblem(0.8, 0.5)).toBeNull();
    expect(thresholdProblem(0.5, 0.5)).toBeNull();
    expect(thresholdProblem(1.2, 0.5)).toBe('range');
    expect(thresholdProblem(Number.NaN, 0.5)).toBe('range');
    expect(thresholdProblem(0.4, 0.6)).toBe('order');
  });

  it('writes an employee with empty fields cleared and other names one per line', () => {
    expect(employeeValues({ name: ' Ani ', nickname: '', title: ' HR ', email: '', phone: '', department: 3, active: true, aliases: ' Bu Ani \n\nAni HR ' })).toEqual({
      name: 'Ani',
      nickname: false,
      formal_title: 'HR',
      email: false,
      phone: false,
      department_id: 3,
      active: true,
      aliases: 'Bu Ani\nAni HR',
    });
  });
});
