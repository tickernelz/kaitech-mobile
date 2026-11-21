import { odooDate, recordingFrom, recordingIdOf } from '../src/features/call/recording';

jest.mock('../src/api/odoo', () => ({ bearer: () => Promise.reject(new Error('offline')) }));

describe('recordingIdOf', () => {
  it('reads the recording id from the attachment url the server writes', () => {
    expect(recordingIdOf('/kaitech_mobile/call/recordings/7/play')).toBe(7);
  });

  it('ignores the recording path on another host', () => {
    expect(recordingIdOf('https://erp.example.com/kaitech_mobile/call/recordings/12/play')).toBeNull();
    expect(recordingIdOf('//erp.example.com/kaitech_mobile/call/recordings/12/play')).toBeNull();
  });

  it('ignores other links', () => {
    expect(recordingIdOf('/web/content/7')).toBeNull();
    expect(recordingIdOf('/kaitech_mobile/call/recordings/x/play')).toBeNull();
    expect(recordingIdOf(null)).toBeNull();
  });
});

describe('recordingFrom', () => {
  it('reads a deleted recording without a url or expiry', () => {
    const recording = recordingFrom({
      id: 7,
      channel_id: 12,
      state: 'deleted',
      audio_only: true,
      started_by: { partner_id: 3, name: 'Budi' },
      duration: 61.5,
      expires_at: null,
      deleted_at: '2026-12-05 02:00:00',
    });
    expect(recording).toMatchObject({ id: 7, state: 'deleted', audioOnly: true, startedBy: 'Budi', duration: 61.5, expiresAt: null });
    expect(recording?.deletedAt?.toISOString()).toBe('2026-12-05T02:00:00.000Z');
  });

  it('rejects an unknown state', () => {
    expect(recordingFrom({ id: 7, state: 'starting' })).toBeNull();
  });
});

describe('odooDate', () => {
  it('reads Odoo UTC dates', () => {
    expect(odooDate('2026-11-21 02:00:05')?.toISOString()).toBe('2026-11-21T02:00:05.000Z');
    expect(odooDate('soon')).toBeNull();
  });
});
