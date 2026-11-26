import { describe, expect, it } from 'vitest';
import { routes } from '../src/app/router';

describe('game routes', () => {
  it('owns only the game, its map and guide, QR entry and not-found page', () => {
    const paths = routes[0].children?.[0].children?.map((route) =>
      route.index ? '/' : route.path,
    );
    expect(paths).toEqual([
      '/',
      'play',
      'game',
      'map',
      'staff',
      'stats',
      'privacy',
      'stamp/:spot',
      '*',
    ]);
  });
  it('forwards a QR claim straight to the stamp book', async () => {
    const route = routes[0].children?.[0].children?.find((route) => route.path === 'stamp/:spot');
    if (typeof route?.loader !== 'function') throw new Error('Missing QR loader');
    const response = await route.loader({
      params: { spot: 'zhongda-lake' },
      context: {},
      request: new Request('https://game.example/stamp/zhongda-lake?k=LAKE-26'),
    });
    expect((response as Response).headers.get('Location')).toBe('/?spot=zhongda-lake&k=LAKE-26');
  });
});
