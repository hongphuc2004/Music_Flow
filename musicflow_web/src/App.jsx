import { lazy, Suspense, createContext, useState, useMemo, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress } from '@mui/material';
import AppToastProvider from './components/common/AppToastProvider';
import { refreshAccessToken } from './services/api';
import { notifyClientSessionChanged } from './hooks/useClientSession';
import { createLazyRoute, preloadRoute, preloadRoutesWhenIdle } from './utils/routePreload';

export const ColorModeContext = createContext({ toggleColorMode: () => {}, mode: 'light' });

const Dashboard = createLazyRoute('/');
const Accounts = createLazyRoute('/accounts');
const Songs = createLazyRoute('/songs');
const Topics = createLazyRoute('/topics');
const Playlists = createLazyRoute('/playlists');
const Settings = createLazyRoute('/settings');
const AdminLogin = createLazyRoute('/adminlogin');

const ArtistAnalytics = createLazyRoute('/artist/analytics');
const ArtistDashboard = createLazyRoute('/artist/dashboard');
const ArtistLogin = createLazyRoute('/artistlogin');
const ArtistProfile = createLazyRoute('/artist/profile');
const ArtistSong = createLazyRoute('/artist/songs');
const ArtistRegister = createLazyRoute('/artist/register');

const ClientHome = createLazyRoute('/client/home');
const ClientDiscover = createLazyRoute('/client/discover');
const ClientLibrary = createLazyRoute('/client/library');
const ClientFavorites = createLazyRoute('/client/favorites');
const ClientProfile = createLazyRoute('/client/profile');
const ClientArtist = createLazyRoute('/client/artists/:artistId');
const ClientCollection = createLazyRoute('/client/collections/:collectionId');
const ClientPlaylist = createLazyRoute('/client/playlists/:playlistId');
const ClientGenres = createLazyRoute('/client/genres');
const ClientRankings = createLazyRoute('/client/rankings');
const ClientAiMood = createLazyRoute('/client/ai-mood');
const ClientPlayerBoundary = lazy(() => import('./components/Layout/client/ClientPlayerBoundary'));




const ProtectedRoute = ({ children, role }) => {
  const userRole = localStorage.getItem('role');
  const location = useLocation();
  const authMode = new URLSearchParams(location.search).get('auth');
  const roleDefaultRoute = {
    admin: '/',
    artist: '/artist/dashboard',
    user: '/client/home',
  };

  if (!userRole) {
    if (role === 'artist') {
      if (location.pathname === '/artist/dashboard' && authMode === 'login') return children;
      return <Navigate to="/artist/dashboard?auth=login" replace />;
    }
    return <Navigate to="/accountlogin" replace />;
  }

  if (role && userRole !== role) {
    return <Navigate to={roleDefaultRoute[userRole] || '/accountlogin'} replace />;
  }

  return children;
};

const ClientRoute = ({ children, requireAuth = false }) => {
  const userRole = localStorage.getItem('role');

  if (requireAuth && userRole !== 'user') {
    return <Navigate to="/client/home?auth=login" replace />;
  }

  if (userRole && userRole !== 'user') {
    return <Navigate to={userRole === 'artist' ? '/artist/dashboard' : '/'} replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const userRole = localStorage.getItem('role');
  if (userRole === 'admin') return <Navigate to="/" replace />;
  if (userRole === 'artist') return <Navigate to="/artist/dashboard" replace />;
  if (userRole === 'user') return <Navigate to="/client/home" replace />;
  return children;
};

const HomeRedirect = () => {
  const userRole = localStorage.getItem('role');

  if (!userRole) return <Navigate to="/client/home" replace />;
  if (userRole === 'artist') return <Navigate to="/artist/dashboard" replace />;
  if (userRole === 'user') return <Navigate to="/client/home" replace />;
  return <Navigate to="/" replace />;
};

const RootRoute = () => {
  const userRole = localStorage.getItem('role');

  if (!userRole) return <Navigate to="/client/home" replace />;
  if (userRole === 'artist') return <Navigate to="/artist/dashboard" replace />;
  if (userRole === 'user') return <Navigate to="/client/home" replace />;

  return <Dashboard />;
};

const RouteFallback = () => (
  <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#f8fafc' }}>
    <CircularProgress size={34} sx={{ color: '#0f766e' }} />
  </Box>
);

function RouteProviders({ children }) {
  const location = useLocation();

  useEffect(() => {
    preloadRoute(location.pathname);
  }, [location.pathname]);

  if (location.pathname.startsWith('/client')) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <ClientPlayerBoundary>{children}</ClientPlayerBoundary>
      </Suspense>
    );
  }

  return children;
}

function App() {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('theme-mode') || 'light';
  });

  const [loadingSession, setLoadingSession] = useState(
    () => Boolean(localStorage.getItem('role'))
  );

  useEffect(() => {
    const initSession = async () => {
      const role = localStorage.getItem('role');
      if (role) {
        try {
          await refreshAccessToken();
        } catch (err) {
          console.warn('Silent refresh failed:', err);
          // Clear all authentication data from localStorage if refresh token is expired or invalid
          localStorage.removeItem('role');
          localStorage.removeItem('userName');
          localStorage.removeItem('email');
          localStorage.removeItem('userId');
          localStorage.removeItem('artistId');
          localStorage.removeItem('artistName');
          localStorage.removeItem('artistAvatar');
          localStorage.removeItem('artistEmail');
          localStorage.removeItem('userAvatar');
          notifyClientSessionChanged();
        }
      }
      setLoadingSession(false);
    };
    initSession();
  }, []);

  useEffect(() => {
    const role = localStorage.getItem('role');
    const routes = role === 'admin'
      ? ['/', '/accounts', '/songs', '/topics', '/playlists']
      : role === 'artist'
        ? ['/artist/dashboard', '/artist/songs', '/artist/analytics', '/artist/profile']
        : ['/client/home', '/client/discover', '/client/genres', '/client/rankings'];

    preloadRoutesWhenIdle(routes);
  }, []);

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => {
          const nextMode = prevMode === 'light' ? 'dark' : 'light';
          localStorage.setItem('theme-mode', nextMode);
          return nextMode;
        });
      },
      mode,
    }),
    [mode]
  );

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: '#6c63ff',
          },
          secondary: {
            main: '#00bcd4',
          },
          background: {
            default: mode === 'dark' ? '#0b0f19' : '#f8fafc',
            paper: mode === 'dark' ? '#111827' : '#ffffff',
          },
          text: {
            primary: mode === 'dark' ? '#f3f4f6' : '#0f172a',
            secondary: mode === 'dark' ? '#9ca3af' : '#475569',
          },
        },
        typography: {
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                fontWeight: 600,
              },
            },
          },
          MuiAvatar: {
            defaultProps: {
              slotProps: {
                img: {
                  decoding: 'async',
                },
              },
            },
          },
        },
      }),
    [mode]
  );

  if (loadingSession) {
    return <RouteFallback />;
  }

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppToastProvider>
          <Router>
            <RouteProviders>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
          <Route path="/accountlogin" element={<Navigate to="/client/home?auth=login" replace />} />
          <Route path="/adminlogin" element={<PublicRoute><AdminLogin /></PublicRoute>} />
          <Route path="/artist/register" element={<PublicRoute><ArtistRegister /></PublicRoute>} />
          <Route path="/user/register" element={<Navigate to="/client/home?auth=register" replace />} />
          <Route path="/artistlogin" element={<PublicRoute><ArtistLogin /></PublicRoute>} />
          <Route
            path="/artist/dashboard"
            element={
              <ProtectedRoute role="artist">
                <ArtistDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/artist/songs"
            element={
              <ProtectedRoute role="artist">
                <ArtistSong />
              </ProtectedRoute>
            }
          />
          <Route
            path="/artist/analytics"
            element={
              <ProtectedRoute role="artist">
                <ArtistAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/artist/profile"
            element={
              <ProtectedRoute role="artist">
                <ArtistProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={<RootRoute />}
          />
          <Route
            path="/client/home"
            element={
              <ClientRoute>
                <ClientHome />
              </ClientRoute>
            }
          />
          <Route
            path="/client/discover"
            element={
              <ClientRoute>
                <ClientDiscover />
              </ClientRoute>
            }
          />
          <Route
            path="/client/library"
            element={
              <ClientRoute requireAuth>
                <ClientLibrary />
              </ClientRoute>
            }
          />
          <Route
            path="/client/favorites"
            element={
              <ClientRoute requireAuth>
                <ClientFavorites />
              </ClientRoute>
            }
          />
          <Route
            path="/client/profile"
            element={
              <ClientRoute requireAuth>
                <ClientProfile />
              </ClientRoute>
            }
          />
          <Route
            path="/client/genres"
            element={
              <ClientRoute>
                <ClientGenres />
              </ClientRoute>
            }
          />
          <Route
            path="/client/rankings"
            element={
              <ClientRoute>
                <ClientRankings />
              </ClientRoute>
            }
          />
          <Route
            path="/client/ai-mood"
            element={
              <ClientRoute requireAuth>
                <ClientAiMood />
              </ClientRoute>
            }
          />
          <Route
            path="/client/artists/:artistId"
            element={
              <ClientRoute>
                <ClientArtist />
              </ClientRoute>
            }
          />
          <Route
            path="/client/collections/:collectionId"
            element={
              <ClientRoute>
                <ClientCollection />
              </ClientRoute>
            }
          />
          <Route
            path="/client/playlists/:playlistId"
            element={
              <ClientRoute>
                <ClientPlaylist />
              </ClientRoute>
            }
          />
          <Route path="/client" element={<Navigate to="/client/home" replace />} />
          <Route path="/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
          <Route path="/songs" element={<ProtectedRoute><Songs /></ProtectedRoute>} />
          <Route path="/topics" element={<ProtectedRoute><Topics /></ProtectedRoute>} />
          <Route path="/playlists" element={<ProtectedRoute><Playlists /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*" element={<HomeRedirect />} />
              </Routes>
              </Suspense>
            </RouteProviders>
          </Router>
        </AppToastProvider>
    </ThemeProvider>
  </ColorModeContext.Provider>
  );
}

export default App;
