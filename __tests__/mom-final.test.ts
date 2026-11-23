import type { FinalView } from '../src/features/mom/api';
import { isMoment, localMoment, nextStep, stepBlocker } from '../src/features/mom/final';

jest.mock('../src/api/odoo', () => ({ rpc: jest.fn() }));

const view = (change: Partial<FinalView> = {}): FinalView =>
  ({
    state: 'draft',
    canChange: true,
    drift: false,
    readiness: { generated: true, stale: false, generating: false, problems: [] },
    email: { subject: 'MoM', body: 'Attached', note: '', draftedAt: false, problems: [] },
    distribution: [{ profileId: 1, name: 'Ani', role: '', organization: '', address: 'ani@example.com', sentAt: false, mailState: '', mailFailure: '' }],
    ...change,
  }) as FinalView;

describe('Final MoM next step follows the web', () => {
  it('walks draft, reviewed, final and distributed', () => {
    expect(['draft', 'reviewed', 'final', 'distributed'].map((state) => nextStep(view({ state })))).toEqual(['sign', 'finalize', 'distribute', 'distributeRest']);
    const sent = view({ state: 'distributed', distribution: [{ ...view().distribution[0], sentAt: '2026-11-22T01:00:00Z' }] });
    expect(nextStep(sent)).toBeNull();
    expect(nextStep(view({ state: 'reviewed', canChange: false }))).toBeNull();
  });

  it('holds finalize on problems or a changed text, and sending without a saved email or an address', () => {
    expect(stepBlocker(view({ state: 'reviewed', drift: true }), 'finalize')).toBe('drift');
    expect(stepBlocker(view({ state: 'reviewed', readiness: { generated: true, stale: false, generating: false, problems: ['x'] } }), 'finalize')).toBe('problems');
    expect(stepBlocker(view({ state: 'final', email: { subject: ' ', body: 'b', note: '', draftedAt: false, problems: [] } }), 'distribute')).toBe('noEmail');
    expect(stepBlocker(view({ state: 'final', distribution: [{ ...view().distribution[0], address: '' }] }), 'distribute')).toBe('noRecipient');
    expect(stepBlocker(view({ state: 'final' }), 'distribute')).toBeNull();
  });
});

describe('meeting moment', () => {
  it('shows a UTC stamp in the programme zone the way the server reads it back', () => {
    expect(localMoment('2026-11-22T03:30:00Z', 'Asia/Jakarta')).toBe('2026-11-22 10:30');
    expect(localMoment(false, 'Asia/Jakarta')).toBe('');
    expect(['2026-11-22 10:30', '2026-11-22', '22-11-2026', '2026-11-22T10:30'].map(isMoment)).toEqual([true, true, false, false]);
  });
});
