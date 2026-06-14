import { lazy, Suspense, createContext, useState, useMemo, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress } from '@mui/material';
import { ClientPlayerProvider } from './components/Layout/client/ClientPlayerProvider';
import AppToastProvider from './components/common/AppToastProvider';
import { refreshAccessToken } from './services/api';

export const ColorModeContext = createContext({ toggleColorMode: () => {}, mode: 'light' });

const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Accounts = lazy(() => import('./pages/admin/Accounts'));
const Songs = lazy(() => import('./pages/admin/Songs'));
const Topics = lazy(() => import('./pages/admin/Topics'));
const Playlists = lazy(() => import('./pages/admin/Playlists'));
const Settings = lazy(() => import('./pages/admin/Settings'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));

const ArtistAnalytics = lazy(() => import('./pages/artist/ArtistAnalytics'));
const ArtistDashboard = lazy(() => import('./pages/artist/ArtistDashboard'));
const ArtistLogin = lazy(() => import('./pages/artist/ArtistLogin'));
const ArtistProfile = lazy(() => import('./pages/artist/ArtistProfile'));
const ArtistSong = lazy(() => import('./pages/artist/ArtistSong'));
const ArtistRegister = lazy(() => import('./pages/artist/ArtistRegister'));

const ClientHome = lazy(() => import('./pages/client/ClientHome'));
const ClientDiscover = lazy(() => import('./pages/client/ClientDiscover'));
const ClientLibrary = lazy(() => import('./pages/client/ClientLibrary'));
const ClientFavorites = lazy(() => import('./pages/client/ClientFavorites'));
const ClientProfile = lazy(() => import('./pages/client/ClientProfile'));
const ClientArtist = lazy(() => import('./pages/client/ClientArtist'));
const ClientCollection = lazy(() => import('./pages/client/ClientCollection'));
const ClientPlaylist = lazy(() => import('./pages/client/ClientPlaylist'));
const ClientGenres = lazy(() => import('./pages/client/ClientGenres'));
const ClientRankings = lazy(() => import('./pages/client/ClientRankings'));
const ClientAiMood = lazy(() => import('./pages/client/ClientAiMood'));




const ProtectedRoute = ({ children, role }) => {
  const userRole = localStorage.getItem('role');
  const roleDefaultRoute = {
    admin: '/',
    artist: '/artist/dashboard',
    user: '/client/home',
  };

  if (!userRole) {
    return <Navigate to={role === 'artist' ? '/artistlogin' : '/accountlogin'} replace />;
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

function App() {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('theme-mode') || 'light';
  });

  const [loadingSession, setLoadingSession] = useState(true);

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
        }
      }
      setLoadingSession(false);
    };
    initSession();
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
          <ClientPlayerProvider>
            <Router>
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
          </Router>
        </ClientPlayerProvider>
      </AppToastProvider>
    </ThemeProvider>
  </ColorModeContext.Provider>
  );
}

export default App;
