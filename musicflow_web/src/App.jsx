import { Suspense, useState, useMemo, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress } from '@mui/material';
import AppToastProvider from './components/common/AppToastProvider';
import { refreshAccessToken, setAccessToken } from './services/api';
import { notifyClientSessionChanged } from './hooks/useClientSession';
import { createLazyRoute, preloadRoute, preloadRoutesWhenIdle } from './utils/routePreload';
import { ColorModeContext } from './context/ColorModeContext';
import { AssistantProvider } from './features/assistant/AssistantProvider';
import AssistantHost from './features/assistant/AssistantHost';
import ClientPlayerBoundary from './components/Layout/client/ClientPlayerBoundary';

// Admin Pages
const Dashboard = createLazyRoute('/admin/dashboard');
const Accounts = createLazyRoute('/admin/accounts');
const Songs = createLazyRoute('/admin/songs');
const Topics = createLazyRoute('/admin/topics');
const Playlists = createLazyRoute('/admin/playlists');
const Settings = createLazyRoute('/admin/settings');
const AdminPremium = createLazyRoute('/admin/premium');
const AdminLogin = createLazyRoute('/adminlogin');

// Artist Pages
const ArtistAnalytics = createLazyRoute('/artist/analytics');
const ArtistDashboard = createLazyRoute('/artist/dashboard');
const ArtistLogin = createLazyRoute('/artistlogin');
const ArtistProfile = createLazyRoute('/artist/profile');
const ArtistSong = createLazyRoute('/artist/songs');
const ArtistRegister = createLazyRoute('/artist/register');

// Public / User Pages
const ClientHome = createLazyRoute('/');
const ClientDiscover = createLazyRoute('/discover');
const ClientLibrary = createLazyRoute('/library');
const ClientFavorites = createLazyRoute('/favorites');
const ClientProfile = createLazyRoute('/profile');
const ClientArtist = createLazyRoute('/artists/:artistId');
const ClientCollection = createLazyRoute('/collections/:collectionId');
const ClientPlaylist = createLazyRoute('/playlists/:playlistId');
const ClientSongDetail = createLazyRoute('/songs/:songId');
const ClientGenres = createLazyRoute('/genres');
const ClientRankings = createLazyRoute('/rankings');
const ClientAiMood = createLazyRoute('/ai-mood');
const ClientPremium = createLazyRoute('/premium');
const ClientPaymentReturn = createLazyRoute('/premium/vnpay-return');

const ProtectedRoute = ({ children, role }) => {
  const userRole = localStorage.getItem('role');
  const location = useLocation();
  const authMode = new URLSearchParams(location.search).get('auth');
  const roleDefaultRoute = {
    admin: '/admin/dashboard',
    artist: '/artist/dashboard',
    user: '/',
  };

  if (!userRole) {
    if (role === 'admin') {
      return <Navigate to="/adminlogin" replace />;
    }
    if (role === 'artist') {
      if (location.pathname === '/artist/dashboard' && (authMode === 'login' || authMode === 'register')) return children;
      return <Navigate to="/artist/dashboard?auth=login" replace />;
    }
    return <Navigate to="/?auth=login" replace />;
  }

  if (role && userRole !== role) {
    return <Navigate to={roleDefaultRoute[userRole] || '/?auth=login'} replace />;
  }

  return children;
};

const ClientRoute = ({ children, requireAuth = false }) => {
  const userRole = localStorage.getItem('role');

  if (requireAuth && !userRole) {
    return <Navigate to="/?auth=login" replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const userRole = localStorage.getItem('role');
  if (userRole === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (userRole === 'artist') return <Navigate to="/artist/dashboard" replace />;
  if (userRole === 'user') return <Navigate to="/" replace />;
  return children;
};

const HomeRedirect = () => {
  return <Navigate to="/" replace />;
};

const AdminRedirect = () => {
  const userRole = localStorage.getItem('role');
  if (userRole === 'admin') return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/adminlogin" replace />;
};

const ArtistRedirect = () => {
  const userRole = localStorage.getItem('role');
  if (userRole === 'artist') return <Navigate to="/artist/dashboard" replace />;
  return <Navigate to="/artist/dashboard?auth=login" replace />;
};

/**
 * Backward compatibility redirect that preserves query strings
 */
const ClientRedirect = ({ to }) => {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
};

/**
 * Backward compatibility param redirect: /client/artists/123 -> /artists/123
 */
const ClientParamRedirect = () => {
  const location = useLocation();
  const newPath = location.pathname.replace(/^\/client/, '');
  return <Navigate to={`${newPath}${location.search}`} replace />;
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

  const isAdminOrArtist =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/artist') ||
    location.pathname === '/adminlogin' ||
    location.pathname === '/artistlogin';

  if (!isAdminOrArtist) {
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
          setAccessToken(null);
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
      ? ['/admin/dashboard', '/admin/accounts', '/admin/songs', '/admin/topics', '/admin/playlists', '/admin/premium']
      : role === 'artist'
        ? ['/artist/dashboard', '/artist/songs', '/artist/analytics', '/artist/profile']
        : ['/', '/discover', '/genres', '/rankings'];

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
            light: '#8c85ff',
            dark: '#5246e2',
            contrastText: '#ffffff',
          },
          secondary: {
            main: '#00e5ff',
            light: '#33ecff',
            dark: '#00b4cc',
            contrastText: '#05070e',
          },
          background: {
            default: mode === 'dark' ? '#05070e' : '#f8fafc',
            paper: mode === 'dark' ? '#0a0e1a' : '#ffffff',
          },
          text: {
            primary: mode === 'dark' ? '#ffffff' : '#0f172a',
            secondary: mode === 'dark' ? 'rgba(255, 255, 255, 0.65)' : '#64748b',
          },
          divider: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
        },
        shape: {
          borderRadius: 16,
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          h1: { fontWeight: 900, letterSpacing: '-0.035em' },
          h2: { fontWeight: 850, letterSpacing: '-0.03em' },
          h3: { fontWeight: 800, letterSpacing: '-0.025em' },
          h4: { fontWeight: 800, letterSpacing: '-0.02em' },
          h5: { fontWeight: 750, letterSpacing: '-0.015em' },
          h6: { fontWeight: 750, letterSpacing: '-0.01em' },
          button: { textTransform: 'none', fontWeight: 700, letterSpacing: '-0.01em' },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '9999px',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                '&:active': {
                  transform: 'scale(0.97)',
                },
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                fontWeight: 650,
                borderRadius: '9999px',
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
            <AssistantProvider>
              <RouteProviders>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    {/* Auth & Redirects */}
                    <Route path="/accountlogin" element={<ClientRedirect to="/?auth=login" />} />
                    <Route path="/adminlogin" element={<PublicRoute><AdminLogin /></PublicRoute>} />
                    <Route path="/artist/register" element={<ClientRedirect to="/artist/dashboard?auth=register" />} />
                    <Route path="/user/register" element={<ClientRedirect to="/?auth=register" />} />
                    <Route path="/artistlogin" element={<ClientRedirect to="/artist/dashboard?auth=login" />} />

                    {/* Admin Portal Routes */}
                    <Route path="/admin" element={<AdminRedirect />} />
                    <Route
                      path="/admin/dashboard"
                      element={
                        <ProtectedRoute role="admin">
                          <Dashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/accounts"
                      element={
                        <ProtectedRoute role="admin">
                          <Accounts />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/songs"
                      element={
                        <ProtectedRoute role="admin">
                          <Songs />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/topics"
                      element={
                        <ProtectedRoute role="admin">
                          <Topics />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/playlists"
                      element={
                        <ProtectedRoute role="admin">
                          <Playlists />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/premium"
                      element={
                        <ProtectedRoute role="admin">
                          <AdminPremium />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/settings"
                      element={
                        <ProtectedRoute role="admin">
                          <Settings />
                        </ProtectedRoute>
                      }
                    />

                    {/* Legacy Admin compatibility redirects */}
                    <Route path="/accounts" element={<ClientRedirect to="/admin/accounts" />} />
                    <Route path="/songs" element={<ClientRedirect to="/admin/songs" />} />
                    <Route path="/topics" element={<ClientRedirect to="/admin/topics" />} />
                    <Route path="/playlists" element={<ClientRedirect to="/admin/playlists" />} />
                    <Route path="/settings" element={<ClientRedirect to="/admin/settings" />} />

                    {/* Artist Portal Routes */}
                    <Route path="/artist" element={<ArtistRedirect />} />
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

                    {/* Public & Client User Routes */}
                    <Route
                      path="/"
                      element={
                        <ClientRoute>
                          <ClientHome />
                        </ClientRoute>
                      }
                    />
                    <Route
                      path="/home"
                      element={<ClientRedirect to="/" />}
                    />
                    <Route
                      path="/discover"
                      element={
                        <ClientRoute>
                          <ClientDiscover />
                        </ClientRoute>
                      }
                    />
                    <Route
                      path="/genres"
                      element={
                        <ClientRoute>
                          <ClientGenres />
                        </ClientRoute>
                      }
                    />
                    <Route
                      path="/rankings"
                      element={
                        <ClientRoute>
                          <ClientRankings />
                        </ClientRoute>
                      }
                    />
                    <Route
                      path="/ai-mood"
                      element={
                        <ClientRoute requireAuth>
                          <ClientAiMood />
                        </ClientRoute>
                      }
                    />
                    <Route
                      path="/library"
                      element={
                        <ClientRoute requireAuth>
                          <ClientLibrary />
                        </ClientRoute>
                      }
                    />
                    <Route
                      path="/favorites"
                      element={
                        <ClientRoute requireAuth>
                          <ClientFavorites />
                        </ClientRoute>
                      }
                    />
                    <Route
                      path="/profile"
                      element={
                        <ClientRoute requireAuth>
                          <ClientProfile />
                        </ClientRoute>
                      }
                    />
                    <Route
                      path="/premium"
                      element={
                        <ClientRoute requireAuth>
                          <ClientPremium />
                        </ClientRoute>
                      }
                    />
                    <Route
                      path="/premium/vnpay-return"
                      element={
                        <ClientRoute requireAuth>
                          <ClientPaymentReturn />
                        </ClientRoute>
                      }
                    />
                    <Route
                      path="/artists/:artistId"
                      element={
                        <ClientRoute>
                          <ClientArtist />
                        </ClientRoute>
                      }
                    />
                    <Route
                      path="/collections/:collectionId"
                      element={
                        <ClientRoute>
                          <ClientCollection />
                        </ClientRoute>
                      }
                    />
                    <Route
                      path="/playlists/:playlistId"
                      element={
                        <ClientRoute>
                          <ClientPlaylist />
                        </ClientRoute>
                      }
                    />
                    <Route
                      path="/songs/:songId"
                      element={
                        <ClientRoute>
                          <ClientSongDetail />
                        </ClientRoute>
                      }
                    />

                    {/* Backward-compatible /client/* redirects */}
                    <Route path="/client" element={<ClientRedirect to="/" />} />
                    <Route path="/client/home" element={<ClientRedirect to="/" />} />
                    <Route path="/client/discover" element={<ClientRedirect to="/discover" />} />
                    <Route path="/client/genres" element={<ClientRedirect to="/genres" />} />
                    <Route path="/client/rankings" element={<ClientRedirect to="/rankings" />} />
                    <Route path="/client/ai-mood" element={<ClientRedirect to="/ai-mood" />} />
                    <Route path="/client/library" element={<ClientRedirect to="/library" />} />
                    <Route path="/client/favorites" element={<ClientRedirect to="/favorites" />} />
                    <Route path="/client/profile" element={<ClientRedirect to="/profile" />} />
                    <Route path="/client/premium" element={<ClientRedirect to="/premium" />} />
                    <Route path="/client/premium/vnpay-return" element={<ClientRedirect to="/premium/vnpay-return" />} />
                    <Route path="/client/artists/:artistId" element={<ClientParamRedirect />} />
                    <Route path="/client/collections/:collectionId" element={<ClientParamRedirect />} />
                    <Route path="/client/playlists/:playlistId" element={<ClientParamRedirect />} />
                    <Route
                      path="/client/songs/:songId"
                      element={
                        <ClientRoute>
                          <ClientSongDetail />
                        </ClientRoute>
                      }
                    />

                    {/* SoundCloud-Style Song Sharing Canonical Route */}
                    <Route
                      path="/:artistSlug/:songSlug"
                      element={
                        <ClientRoute>
                          <ClientSongDetail />
                        </ClientRoute>
                      }
                    />

                    {/* 404 Fallback */}
                    <Route path="*" element={<HomeRedirect />} />
                  </Routes>
                </Suspense>
              </RouteProviders>
              <AssistantHost />
            </AssistantProvider>
          </Router>
        </AppToastProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;
