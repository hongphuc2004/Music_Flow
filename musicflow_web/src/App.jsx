import ArtistLogin from './pages/artist/ArtistLogin';
          <Route path="/artistlogin" element={<ArtistLogin />} />
import UserRegister from './pages/client/UserRegister';
          <Route path="/user/register" element={<UserRegister />} />
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import {
  Dashboard,
  Users,
  Songs,
  Topics,
  Playlists,
  Settings,
} from './pages';
import AccountLogin from './pages/AccountLogin';
import ArtistDashboard from './pages/artist/ArtistDashboard';
import ArtistSong from './pages/artist/ArtistSong';
import ArtistRegister from './pages/artist/ArtistRegister';
import AdminLogin from './pages/admin/AdminLogin';

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


// Protected Route wrapper
const ProtectedRoute = ({ children, role }) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');
  if (!token) return <Navigate to="/accountlogin" replace />;
  if (role && userRole !== role) {
    // Nếu role không đúng, xóa token và về trang login
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    return <Navigate to="/accountlogin" replace />;
  }
  return children;
};

// Public Route wrapper: Nếu đã đăng nhập thì redirect về dashboard phù hợp
const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');
  if (token && userRole === 'admin') return <Navigate to="/" replace />;
  if (token && userRole === 'artist') return <Navigate to="/artist/dashboard" replace />;
  if (token && userRole === 'user') return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          {/* Đăng nhập user/artist */}
          {/* Đăng nhập user/artist riêng biệt */}
          <Route path="/accountlogin" element={<PublicRoute><AccountLogin /></PublicRoute>} />
          {/* Đăng nhập admin riêng biệt */}
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
            path="/"
            element={
              <ProtectedRoute role="admin">
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route
            path="/songs"
            element={
              <ProtectedRoute>
                <Songs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/topics"
            element={
              <ProtectedRoute>
                <Topics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/playlists"
            element={
              <ProtectedRoute>
                <Playlists />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
