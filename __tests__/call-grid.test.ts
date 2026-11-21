import { layoutFor, pagesFor, presenterOf, stageFor } from '../src/features/call/grid';

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
