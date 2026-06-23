import { useMemo, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Box,
  InputBase,
  Stack,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  MenuRounded as MenuIcon,
  SearchRounded as SearchIcon,
  PersonRounded as PersonIcon,
  MicExternalOnOutlined,
  DarkModeRounded as DarkModeIcon,
  LightModeRounded as LightModeIcon,
} from '@mui/icons-material';
import useClientToast from './useClientToast';
import { ColorModeContext } from '../../../context/ColorModeContext';
import useClientSession from '../../../hooks/useClientSession';
import { logout } from '../../../services/api';

const drawerWidth = 260;
const collapsedDrawerWidth = 76;

function ClientHeader({ title, desktopSidebarOpen = true, onToggleSidebar, onLogoutSuccess = () => {} }) {
  const navigate = useNavigate();
  const { showToast } = useClientToast();
  const { toggleColorMode, mode } = useContext(ColorModeContext);
  const [anchorEl, setAnchorEl] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const { isLoggedIn, userName, userAvatar } = useClientSession();
  const userInitial = useMemo(() => (userName || 'U').charAt(0).toUpperCase(), [userName]);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleClose();
    await logout();
    onLogoutSuccess();
    showToast({
      severity: 'success',
      title: 'Thành công!',
      message: 'Bạn đã đăng xuất khỏi tài khoản.',
    });
    navigate('/client/home');
  };

  const goToLogin = () => {
    handleClose();
    navigate('/client/home?auth=login');
  };

  const goToRegister = () => {
    handleClose();
    navigate('/client/home?auth=register');
  };

  const goToArtistLogin = () => {
    handleClose();
    navigate('/artistlogin');
  };

  const submitSearch = () => {
    const query = searchValue.trim();
    if (!query) return;
    navigate(`/client/genres?query=${encodeURIComponent(query)}`);
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: {
          xs: '100%',
          md: `calc(100% - ${desktopSidebarOpen ? drawerWidth : collapsedDrawerWidth}px)`,
        },
        ml: {
          xs: 0,
          md: `${desktopSidebarOpen ? drawerWidth : collapsedDrawerWidth}px`,
        },
        color: 'text.primary',
        background: (theme) => theme.palette.mode === 'dark' ? 'rgba(11, 15, 25, 0.88)' : 'rgba(248, 250, 252, 0.88)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        transition: (theme) => theme.transitions.create(['width', 'margin-left'], {
          duration: theme.transitions.duration.shorter,
        }),
      }}
    >
      <Toolbar>
        <IconButton
          onClick={onToggleSidebar}
          color="inherit"
          sx={{ mr: 1.25, display: { xs: 'inline-flex', md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Box sx={{ flexGrow: 1, px: { xs: 1, md: 2 }, display: 'flex', justifyContent: 'center' }}>
          <Box
            sx={{
              width: '100%',
              maxWidth: 420,
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              borderRadius: 3,
              px: 1.25,
              py: 0.5,
              backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(31, 41, 55, 0.5)' : 'rgba(255,255,255,0.76)',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <SearchIcon sx={{ color: 'text.secondary', mr: 0.75, fontSize: 18 }} />
            <InputBase
              placeholder="Search..."
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitSearch();
                }
              }}
              sx={{ width: '100%', fontSize: 14 }}
            />
          </Box>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mr: 1.5 }}>
          <IconButton onClick={toggleColorMode} color="inherit">
            {mode === 'dark' ? <LightModeIcon sx={{ color: '#fbbf24' }} /> : <DarkModeIcon />}
          </IconButton>
          <IconButton color="inherit">
            <NotificationsIcon />
          </IconButton>
          {isLoggedIn && (
            <Box sx={{ textAlign: 'right', display: { xs: 'none', md: 'block' } }}>
              <Typography variant="body2" fontWeight={700}>
                {userName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Music listener
              </Typography>
            </Box>
          )}
          <IconButton onClick={handleMenu} color="inherit" sx={{ p: 0.5 }}>
            <Avatar src={isLoggedIn && userAvatar ? userAvatar : undefined} sx={{ bgcolor: '#14b8a6', color: '#fff' }}>
              {isLoggedIn ? userInitial : <PersonIcon />}
            </Avatar>
          </IconButton>
        </Stack>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
          {isLoggedIn ? (
            [
              <MenuItem key="profile" onClick={() => { handleClose(); navigate('/client/profile'); }}>Profile</MenuItem>,
              <MenuItem key="logout" onClick={handleLogout}>Đăng Xuất</MenuItem>,
            ]
          ) : (
            [
              <MenuItem key="login" onClick={goToLogin}>Đăng Nhập</MenuItem>,
              <MenuItem key="register" onClick={goToRegister}>Đăng Ký Tài Khoản</MenuItem>,
              <MenuItem key="artist" onClick={goToArtistLogin}>
                <MicExternalOnOutlined fontSize="small" sx={{ mr: 1.25 }} />
                Artist Studio
              </MenuItem>,
            ]
          )}
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

export default ClientHeader;
