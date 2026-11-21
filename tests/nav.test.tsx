import { renderToString } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from '../src/app/App';

describe('navigation', () => {
  it('does not offer the staff page to a visitor who is not signed in as staff', () => {
    const router = createMemoryRouter([{ path: '/', Component: App }]);
    const html = renderToString(<RouterProvider router={router} />);
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/map"');
    expect(html).not.toContain('href="/staff"');
  });
});
