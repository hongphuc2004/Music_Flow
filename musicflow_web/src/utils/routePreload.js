import { lazy } from 'react';

const routeLoaders = {
  '/': () => import('../pages/admin/Dashboard'),
  '/accounts': () => import('../pages/admin/Accounts'),
  '/songs': () => import('../pages/admin/Songs'),
  '/topics': () => import('../pages/admin/Topics'),
  '/playlists': () => import('../pages/admin/Playlists'),
  '/settings': () => import('../pages/admin/Settings'),
  '/adminlogin': () => import('../pages/admin/AdminLogin'),
  '/artist/dashboard': () => import('../pages/artist/ArtistDashboard'),
  '/artist/songs': () => import('../pages/artist/ArtistSong'),
  '/artist/analytics': () => import('../pages/artist/ArtistAnalytics'),
  '/artist/profile': () => import('../pages/artist/ArtistProfile'),
  '/artistlogin': () => import('../pages/artist/ArtistLogin'),
  '/artist/register': () => import('../pages/artist/ArtistRegister'),
  '/client/home': () => import('../pages/client/ClientHome'),
  '/client/discover': () => import('../pages/client/ClientDiscover'),
  '/client/library': () => import('../pages/client/ClientLibrary'),
  '/client/favorites': () => import('../pages/client/ClientFavorites'),
  '/client/profile': () => import('../pages/client/ClientProfile'),
  '/client/genres': () => import('../pages/client/ClientGenres'),
  '/client/rankings': () => import('../pages/client/ClientRankings'),
  '/client/ai-mood': () => import('../pages/client/ClientAiMood'),
  '/client/artists/:artistId': () => import('../pages/client/ClientArtist'),
  '/client/collections/:collectionId': () => import('../pages/client/ClientCollection'),
  '/client/playlists/:playlistId': () => import('../pages/client/ClientPlaylist'),
};

const preloadPromises = new Map();

const normalizeRoutePath = (path) => {
  const pathname = String(path || '').split('?')[0];
  if (/^\/client\/artists\/[^/]+$/.test(pathname)) return '/client/artists/:artistId';
  if (/^\/client\/collections\/[^/]+$/.test(pathname)) return '/client/collections/:collectionId';
  if (/^\/client\/playlists\/[^/]+$/.test(pathname)) return '/client/playlists/:playlistId';
  return pathname;
};

export const createLazyRoute = (path) => lazy(routeLoaders[path]);

export const preloadRoute = (path) => {
  const routePath = normalizeRoutePath(path);
  const loader = routeLoaders[routePath];
  if (!loader) return Promise.resolve();

  if (!preloadPromises.has(routePath)) {
    preloadPromises.set(routePath, loader());
  }

  return preloadPromises.get(routePath);
};

export const preloadRoutesWhenIdle = (paths) => {
  const run = () => {
    paths.forEach((path, index) => {
      window.setTimeout(() => preloadRoute(path), index * 80);
    });
  };

  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(run, { timeout: 1500 });
  }

  return window.setTimeout(run, 300);
};
