import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import GamePage from '../src/game/GamePage';
import { showerPetals } from '../src/game/StampReveal';
import PlayPage from '../src/pages/PlayPage';

function render(url: string) {
  return renderToString(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/play" element={<PlayPage />} />
        <Route path="/" element={<GamePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('game app', () => {
  for (const path of ['/play', '/']) {
    it(`${path} has an accessible page landmark and heading`, () => {
      const html = render(path);
      expect(html.match(/<main /g)).toHaveLength(1);
      expect(html.match(/<h1/g)).toHaveLength(1);
    });
  }
  it('preserves the scanned claim on the guide', () => {
    const html = render('/play?spot=zhongda-lake&k=lake-26').replaceAll('<!-- -->', '');
    expect(html).toContain('待驗證集章點「中大湖」');
    expect(html).toContain('LAKE-26');
    expect(html).toContain('href="/map?spot=zhongda-lake"');
  });
  it('does not treat a QR handoff as server validation', () => {
    expect(render('/play?spot=zhongda-lake&k=GATE-26')).toContain('待驗證');
  });
  it('plays in the browser: no install instructions anywhere', () => {
    for (const path of ['/', '/play', '/play?spot=zhongda-lake&k=lake-26'])
      expect(render(path)).not.toMatch(/安裝|主畫面/);
  });
  it('sends a claim that lands on the guide on to the stamp book', () => {
    expect(render('/play?spot=zhongda-lake&k=lake-26')).toContain(
      'href="/?spot=zhongda-lake&amp;k=lake-26"',
    );
  });
  it('gives every sakura-shower petal a valid fall time', () => {
    // An invalid duration falls back to 0s: the petals land at once and nothing shows.
    for (const petal of showerPetals) expect(petal.animationDuration).toMatch(/^\d+\.\d{2}s$/);
  });
});
