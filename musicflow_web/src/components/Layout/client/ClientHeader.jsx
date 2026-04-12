import { useMemo, useState } from 'react';
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
} from '@mui/icons-material';

const drawerWidth = 260;

function ClientHeader({ title, onToggleSidebar }) {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const userName = localStorage.getItem('userName') || localStorage.getItem('name') || 'Listener';
  const userInitial = useMemo(() => userName.charAt(0).toUpperCase(), [userName]);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    localStorage.removeItem('email');
    localStorage.removeItem('userId');
    window.location.replace('/accountlogin');
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
        ml: { xs: 0, md: `${drawerWidth}px` },
        color: '#14213d',
        background: 'rgba(248, 250, 252, 0.88)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(20, 33, 61, 0.08)',
      }}
    >
      <Toolbar>
        <IconButton onClick={onToggleSidebar} color="inherit" sx={{ mr: 1.25, display: { xs: 'inline-flex', md: 'none' } }}>
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
              backgroundColor: 'rgba(255,255,255,0.76)',
              border: '1px solid rgba(20,33,61,0.08)',
            }}
          >
            <SearchIcon sx={{ color: 'text.secondary', mr: 0.75, fontSize: 18 }} />
            <InputBase placeholder="Search..." sx={{ width: '100%', fontSize: 14 }} />
          </Box>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mr: 1.5 }}>
          <IconButton color="inherit">
            <NotificationsIcon />
          </IconButton>
          <Box sx={{ textAlign: 'right', display: { xs: 'none', md: 'block' } }}>
            <Typography variant="body2" fontWeight={700}>
              {userName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Music listener
            </Typography>
          </Box>
          <IconButton onClick={handleMenu} color="inherit" sx={{ p: 0.5 }}>
            <Avatar sx={{ bgcolor: '#14b8a6', color: '#fff' }}>{userInitial}</Avatar>
          </IconButton>
        </Stack>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
          <MenuItem onClick={() => { handleClose(); navigate('/client/profile'); }}>Profile</MenuItem>
          <MenuItem onClick={handleLogout}>Dang xuat</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

export default ClientHeader;
