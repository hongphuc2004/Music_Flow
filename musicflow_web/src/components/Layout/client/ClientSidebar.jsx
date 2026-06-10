import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Box,
  Divider,
} from '@mui/material';
import {
  Home as HomeIcon,
  Explore as ExploreIcon,
  LibraryMusic as LibraryMusicIcon,
  CategoryOutlined as CategoryIcon,
  EqualizerRounded as EqualizerIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  LoginRounded as LoginIcon,
  Headphones as HeadphonesIcon,
  MicExternalOnOutlined,
} from '@mui/icons-material';
import useClientToast from './useClientToast';

const drawerWidth = 260;

const menuItems = [
  { text: 'Trang Chủ', icon: <HomeIcon />, path: '/client/home' },
  { text: 'Khám Phá', icon: <ExploreIcon />, path: '/client/discover' },
  { text: 'Thư Viện ', icon: <LibraryMusicIcon />, path: '/client/library' },
  { text: 'Chủ Đề & Thể Loại', icon: <CategoryIcon />, path: '/client/genres' },
  { text: 'Bảng Xếp Hạng', icon: <EqualizerIcon />, path: '/client/rankings' },
  { text: 'Tài Khoản', icon: <PersonIcon />, path: '/client/profile' },
];

function ClientSidebar({ mobileOpen = false, onClose = () => {}, onLogoutSuccess = () => {} }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useClientToast();
  const isLoggedIn = localStorage.getItem('role') === 'user';

  const handleNavigate = (path) => {
    const privatePaths = ['/client/library', '/client/profile'];
    if (!isLoggedIn && privatePaths.includes(path)) {
      showToast({
        severity: 'info',
        title: 'Cần đăng nhập',
        message: 'Vui lòng đăng nhập để sử dụng chức năng này.',
      });
      onClose();
      return;
    }

    navigate(path);
    onClose();
  };

  const handleLogout = () => {
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    localStorage.removeItem('email');
    localStorage.removeItem('userId');
    onClose();
    onLogoutSuccess();
    showToast({
      severity: 'success',
      title: 'Thành công!',
      message: 'Bạn đã đăng xuất khỏi tài khoản.',
    });
    navigate('/client/home');
  };

  const handleLogin = () => {
    onClose();
    navigate('/client/home?auth=login');
  };

  const handleArtistLogin = () => {
    onClose();
    navigate('/artistlogin');
  };

  const sidebarContent = (
    <>
      <Toolbar sx={{ alignItems: 'flex-start', pt: 2.5 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2.5 }}>
            <HeadphonesIcon sx={{ color: '#22d3ee', fontSize: 30 }} />
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>
              MusicFlow
            </Typography>
          </Box>
        </Box>
      </Toolbar>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      <List sx={{ px: 1.5, py: 2 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
            <ListItemButton
              onClick={() => handleNavigate(item.path)}
              selected={location.pathname === item.path}
              sx={{
                borderRadius: 3,
                minHeight: 48,
                '&.Mui-selected': {
                  background: 'linear-gradient(90deg, rgba(56,189,248,0.24), rgba(20,184,166,0.26))',
                  border: '1px solid rgba(153,246,228,0.22)',
                  '&:hover': {
                    background: 'linear-gradient(90deg, rgba(56,189,248,0.3), rgba(20,184,166,0.3))',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ color: '#fff', minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: 600 }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <List sx={{ px: 1.5, pb: 2 }}>
        <ListItem disablePadding>
          <ListItemButton onClick={isLoggedIn ? handleLogout : handleLogin} sx={{ borderRadius: 3 }}>
            <ListItemIcon sx={{ color: '#fff', minWidth: 40 }}>
              {isLoggedIn ? <LogoutIcon /> : <LoginIcon />}
            </ListItemIcon>
            <ListItemText primary={isLoggedIn ? 'Đăng Xuất' : 'Đăng Nhập'} primaryTypographyProps={{ fontWeight: 600 }} />
          </ListItemButton>
        </ListItem>
        {!isLoggedIn && (
          <ListItem disablePadding sx={{ mt: 1 }}>
            <ListItemButton onClick={handleArtistLogin} sx={{ borderRadius: 3 }}>
              <ListItemIcon sx={{ color: '#fff', minWidth: 40 }}>
                <MicExternalOnOutlined />
              </ListItemIcon>
              <ListItemText primary="Artist Studio" primaryTypographyProps={{ fontWeight: 600 }} />
            </ListItemButton>
          </ListItem>
        )}
      </List>
    </>
  );

  return (
    <>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            color: '#fff',
            background:
              'radial-gradient(circle at top, rgba(56,189,248,0.24), transparent 30%), linear-gradient(180deg, #0b132b 0%, #111827 58%, #0f766e 100%)',
            borderRight: '1px solid rgba(255,255,255,0.08)',
          },
        }}
      >
        {sidebarContent}
      </Drawer>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            color: '#fff',
            background:
              'radial-gradient(circle at top, rgba(56,189,248,0.24), transparent 30%), linear-gradient(180deg, #0b132b 0%, #111827 58%, #0f766e 100%)',
            borderRight: '1px solid rgba(255,255,255,0.08)',
          },
        }}
      >
        {sidebarContent}
      </Drawer>
    </>
  );
}

export default ClientSidebar;
