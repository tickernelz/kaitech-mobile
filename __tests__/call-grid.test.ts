import { layoutFor, pagesFor, presenterOf, stageFor, stageView } from '../src/features/call/grid';

describe('call video grid', () => {
  it('stacks two people in portrait and puts them side by side in landscape', () => {
    expect(stageFor(2, 390, 700)).toMatchObject({ columns: 1, rows: 2 });
    expect(stageFor(2, 800, 390)).toMatchObject({ columns: 2, rows: 1 });
  });

  it('uses 2x2 up to four people', () => {
    expect(stageFor(3, 390, 700)).toMatchObject({ columns: 2, rows: 2, perPage: 4 });
    expect(stageFor(4, 1280, 800)).toMatchObject({ columns: 2, rows: 2 });
  });

  it('follows the window shape for five or six people', () => {
    expect(stageFor(6, 390, 700)).toMatchObject({ columns: 2, rows: 3 });
    expect(stageFor(6, 1280, 800)).toMatchObject({ columns: 3, rows: 2 });
  });

  it('keeps tiles readable on a narrow phone by paging six at a time', () => {
    expect(stageFor(9, 360, 700)).toMatchObject({ perPage: 6 });
    expect(stageFor(9, 800, 1200)).toMatchObject({ columns: 3, rows: 3, perPage: 9 });
  });

  it('sizes tiles to fill the area with gaps between them', () => {
    const stage = stageFor(4, 808, 608);
    expect(stage.tileWidth * 2 + 8).toBe(808);
    expect(stage.tileHeight * 2 + 8).toBe(608);
  });
});

describe('call pages', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

  it('pins the active speaker from a later page onto the first page', () => {
    const pages = pagesFor(ids, ['f'], 4);
    expect(pages[0]).toContain('f');
    expect(pages.flat().sort()).toEqual([...ids].sort());
  });

  it('leaves the order alone when the speaker is already visible', () => {
    expect(pagesFor(ids, ['b'], 4)).toEqual([['a', 'b', 'c', 'd'], ['e', 'f', 'g']]);
  });
});

describe('call screen layout', () => {
  it('treats a picture-in-picture window as video only', () => {
    expect(layoutFor(240, 135).pip).toBe(true);
    expect(layoutFor(135, 240).pip).toBe(true);
    expect(layoutFor(360, 640).pip).toBe(false);
  });

  it('keeps the full call screen while the window reports no size during a transition', () => {
    expect(layoutFor(0, 0).pip).toBe(false);
    expect(layoutFor(0, 640).pip).toBe(false);
  });

  it('moves the controls to a side rail on a landscape phone only', () => {
    expect(layoutFor(780, 360).controls).toBe('rail');
    expect(layoutFor(1280, 800).controls).toBe('bar');
    expect(layoutFor(390, 780).controls).toBe('bar');
  });

  it('shows the people list beside the call on expanded windows', () => {
    expect(layoutFor(1280, 800).people).toBe('side');
    expect(layoutFor(800, 1280).people).toBe('sheet');
  });
});

describe('presenterOf', () => {
  const person = (sid: string, local: boolean, screenOn: boolean) => ({ sid, local, screenOn });

  it('prefers a screen shared by someone else over your own', () => {
    expect(presenterOf([person('me', true, true), person('b', false, true)])?.sid).toBe('b');
  });

  it('shows your own screen when nobody else shares', () => {
    expect(presenterOf([person('me', true, true), person('b', false, false)])?.sid).toBe('me');
  });

  it('is empty when nobody shares', () => {
    expect(presenterOf([person('me', true, false), person('b', false, false)])).toBeNull();
  });
});

describe('what the call stage shows, per participant', () => {
  const seat = (sid: string, extra: { local?: boolean; cameraOn?: boolean; screenOn?: boolean } = {}) => ({ sid, local: false, cameraOn: false, screenOn: false, ...extra });
  const me = seat('me', { local: true });
  const view = (people: ReturnType<typeof seat>[], options: { spotted?: ReturnType<typeof seat> | null; swapped?: boolean } = {}) =>
    stageView({ people, presenter: presenterOf(people), spotted: options.spotted ?? null, swapped: options.swapped ?? false });

  it('shows the other person avatar while nobody shows video', () => {
    const sari = seat('sari');
    expect(view([me, sari])).toMatchObject({ kind: 'avatar', onStage: false, face: sari, small: null });
  });

  it('switches to the other person video when they turn the camera on, and back when they turn it off', () => {
    const sari = seat('sari', { cameraOn: true });
    expect(view([me, sari])).toMatchObject({ kind: 'focus', onStage: true, big: sari, small: me });
    expect(view([me, { ...sari, cameraOn: false }])).toMatchObject({ kind: 'avatar', onStage: false });
  });

  it('puts my own camera in the corner of a two-person call when only I show video', () => {
    const sari = seat('sari');
    const mine = { ...me, cameraOn: true };
    expect(view([mine, sari])).toMatchObject({ kind: 'focus', onStage: true, big: sari, small: mine });
    expect(view([mine, sari], { swapped: true })).toMatchObject({ big: mine, small: sari });
  });

  it('keeps a grid of avatars and videos for a group, and the spotlight button focuses one person', () => {
    const people = [me, seat('a', { cameraOn: true }), seat('b')];
    expect(view(people)).toMatchObject({ kind: 'grid', onStage: true, big: null });
    expect(view(people, { spotted: people[2] })).toMatchObject({ kind: 'focus', big: people[2] });
    expect(view([me, seat('a'), seat('b')])).toMatchObject({ kind: 'grid', onStage: false });
  });

  it('focuses a shared screen over every camera', () => {
    const people = [me, seat('a', { cameraOn: true }), seat('b', { screenOn: true })];
    expect(view(people)).toMatchObject({ kind: 'screen', onStage: true });
  });

  it('shows nothing to focus in an empty call', () => {
    expect(view([])).toMatchObject({ kind: 'avatar', onStage: false, big: null, small: null, face: null });
  });
});

