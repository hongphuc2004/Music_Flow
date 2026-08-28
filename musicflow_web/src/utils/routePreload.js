import { lazy } from 'react';

const routeLoaders = {
  // Admin Routes
  '/admin': () => import('../pages/admin/Dashboard'),
  '/admin/dashboard': () => import('../pages/admin/Dashboard'),
  '/admin/accounts': () => import('../pages/admin/Accounts'),
  '/admin/songs': () => import('../pages/admin/Songs'),
  '/admin/topics': () => import('../pages/admin/Topics'),
  '/admin/playlists': () => import('../pages/admin/Playlists'),
  '/admin/settings': () => import('../pages/admin/Settings'),
  '/admin/premium': () => import('../pages/admin/Premium'),
  '/adminlogin': () => import('../pages/admin/AdminLogin'),

  // Artist Routes
  '/artist/dashboard': () => import('../pages/artist/ArtistDashboard'),
  '/artist/songs': () => import('../pages/artist/ArtistSong'),
  '/artist/analytics': () => import('../pages/artist/ArtistAnalytics'),
  '/artist/profile': () => import('../pages/artist/ArtistProfile'),
  '/artistlogin': () => import('../pages/artist/ArtistLogin'),
  '/artist/register': () => import('../pages/artist/ArtistRegister'),

  // Public / User Routes
  '/': () => import('../pages/client/ClientHome'),
  '/home': () => import('../pages/client/ClientHome'),
  '/discover': () => import('../pages/client/ClientDiscover'),
  '/genres': () => import('../pages/client/ClientGenres'),
  '/rankings': () => import('../pages/client/ClientRankings'),
  '/ai-mood': () => import('../pages/client/ClientAiMood'),
  '/library': () => import('../pages/client/ClientLibrary'),
  '/favorites': () => import('../pages/client/ClientFavorites'),
  '/profile': () => import('../pages/client/ClientProfile'),
  '/premium': () => import('../pages/client/ClientPremium'),
  '/premium/vnpay-return': () => import('../pages/client/ClientPaymentReturn'),
  '/artists/:artistId': () => import('../pages/client/ClientArtist'),
  '/collections/:collectionId': () => import('../pages/client/ClientCollection'),
  '/playlists/:playlistId': () => import('../pages/client/ClientPlaylist'),
  '/songs/:songId': () => import('../pages/client/ClientSongDetail'),
  '/:artistSlug/:songSlug': () => import('../pages/client/ClientSongDetail'),

  // Legacy / Backward-compatible paths
  '/client/home': () => import('../pages/client/ClientHome'),
  '/client/discover': () => import('../pages/client/ClientDiscover'),
  '/client/genres': () => import('../pages/client/ClientGenres'),
  '/client/rankings': () => import('../pages/client/ClientRankings'),
  '/client/ai-mood': () => import('../pages/client/ClientAiMood'),
  '/client/library': () => import('../pages/client/ClientLibrary'),
  '/client/favorites': () => import('../pages/client/ClientFavorites'),
  '/client/profile': () => import('../pages/client/ClientProfile'),
  '/client/premium': () => import('../pages/client/ClientPremium'),
  '/client/premium/vnpay-return': () => import('../pages/client/ClientPaymentReturn'),
  '/client/artists/:artistId': () => import('../pages/client/ClientArtist'),
  '/client/collections/:collectionId': () => import('../pages/client/ClientCollection'),
  '/client/playlists/:playlistId': () => import('../pages/client/ClientPlaylist'),
  '/client/songs/:songId': () => import('../pages/client/ClientSongDetail'),
};

const preloadPromises = new Map();

const normalizeRoutePath = (path) => {
  const pathname = String(path || '').split('?')[0];
  if (/^\/(?:client\/)?artists\/[^/]+$/.test(pathname)) return '/artists/:artistId';
  if (/^\/(?:client\/)?collections\/[^/]+$/.test(pathname)) return '/collections/:collectionId';
  if (/^\/(?:client\/)?playlists\/[^/]+$/.test(pathname)) return '/playlists/:playlistId';
  if (/^\/(?:client\/)?songs\/[^/]+$/.test(pathname)) return '/songs/:songId';
  return pathname;
};

export const createLazyRoute = (path) => lazy(routeLoaders[path] || (() => import('../pages/client/ClientHome')));

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
