import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import {
  Dashboard,
  Accounts,
  Songs,
  Topics,
  Playlists,
  Settings,
} from './pages';
import AccountLogin from './pages/AccountLogin';
import ArtistAnalytics from './pages/artist/ArtistAnalytics';
import ArtistDashboard from './pages/artist/ArtistDashboard';
import ArtistLogin from './pages/artist/ArtistLogin';
import ArtistProfile from './pages/artist/ArtistProfile';
import ArtistSong from './pages/artist/ArtistSong';
import ArtistRegister from './pages/artist/ArtistRegister';
import AdminLogin from './pages/admin/AdminLogin';
import UserRegister from './pages/client/UserRegister';
import ClientHome from './pages/client/ClientHome';
import ClientDiscover from './pages/client/ClientDiscover';
import ClientLibrary from './pages/client/ClientLibrary';
import ClientFavorites from './pages/client/ClientFavorites';
import ClientProfile from './pages/client/ClientProfile';
import ClientArtist from './pages/client/ClientArtist';
import { ClientPlayerProvider } from './components/Layout/client/ClientPlayerProvider';

const theme = createTheme({
  palette: {
    primary: {
      main: '#6c63ff',
    },
    secondary: {
      main: '#00bcd4',
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
});

const ProtectedRoute = ({ children, role }) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');
  const roleDefaultRoute = {
    admin: '/',
    artist: '/artist/dashboard',
    user: '/client/home',
  };

  if (!token) {
    return <Navigate to={role === 'artist' ? '/artistlogin' : '/accountlogin'} replace />;
  }

  if (role && userRole !== role) {
    return <Navigate to={roleDefaultRoute[userRole] || '/accountlogin'} replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');
  if (token && userRole === 'admin') return <Navigate to="/" replace />;
  if (token && userRole === 'artist') return <Navigate to="/artist/dashboard" replace />;
  if (token && userRole === 'user') return <Navigate to="/client/home" replace />;
  return children;
};

const HomeRedirect = () => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');

  if (!token) return <Navigate to="/accountlogin" replace />;
  if (userRole === 'artist') return <Navigate to="/artist/dashboard" replace />;
  if (userRole === 'user') return <Navigate to="/client/home" replace />;
  return <Navigate to="/" replace />;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ClientPlayerProvider>
        <Router>
          <Routes>
          <Route path="/accountlogin" element={<PublicRoute><AccountLogin /></PublicRoute>} />
          <Route path="/adminlogin" element={<PublicRoute><AdminLogin /></PublicRoute>} />
          <Route path="/artist/register" element={<PublicRoute><ArtistRegister /></PublicRoute>} />
          <Route path="/user/register" element={<PublicRoute><UserRegister /></PublicRoute>} />
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
            element={
              <ProtectedRoute role="admin">
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/home"
            element={
              <ProtectedRoute role="user">
                <ClientHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/discover"
            element={
              <ProtectedRoute role="user">
                <ClientDiscover />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/library"
            element={
              <ProtectedRoute role="user">
                <ClientLibrary />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/favorites"
            element={
              <ProtectedRoute role="user">
                <ClientFavorites />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/profile"
            element={
              <ProtectedRoute role="user">
                <ClientProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/artists/:artistId"
            element={
              <ProtectedRoute role="user">
                <ClientArtist />
              </ProtectedRoute>
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
        </Router>
      </ClientPlayerProvider>
    </ThemeProvider>
  );
}

export default App;
