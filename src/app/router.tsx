import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject, redirect } from 'react-router-dom';
import App from './App';
import RouteError from './RouteError';

/** Each page is its own chunk, loaded before the navigation commits. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

/** First paint while the initial route chunk loads: a page skeleton. */
function InitialFallback() {
  return (
    <main className="wrap route-loading" aria-busy="true">
      <span className="sr-only">頁面載入中</span>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line short" />
    </main>
  );
}

export const routes: RouteObject[] = [
  {
    Component: App,
    HydrateFallback: InitialFallback,
    children: [
      {
        errorElement: <RouteError />,
        children: [
          { index: true, lazy: page(() => import('../game/GamePage')) },
          { path: 'play', lazy: page(() => import('../pages/PlayPage')) },
          // Old installs and links used /game; the stamp book now lives at the app root.
          { path: 'game', loader: ({ request }) => redirect(`/${new URL(request.url).search}`) },
          { path: 'staff', lazy: page(() => import('../game/StaffPage')) },
          // QR codes on site point here: /stamp/<spot>?k=<key>; the stamp book takes the claim.
          {
            path: 'stamp/:spot',
            loader: ({ params, request }) => {
              const k = new URL(request.url).searchParams.get('k') ?? '';
              const query = new URLSearchParams({ spot: params.spot ?? '', k });
              return redirect(`/?${query}`);
            },
          },
          { path: '*', lazy: page(() => import('../pages/NotFoundPage')) },
        ],
      },
    ],
  },
];

export const createRouter = () => createBrowserRouter(routes);
