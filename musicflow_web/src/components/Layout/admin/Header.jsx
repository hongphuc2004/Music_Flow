import { useState, useContext } from 'react';

import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Box,
  Badge,
  Stack,
  Tooltip,
  InputBase,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Search as SearchIcon,
  DarkModeRounded as DarkModeIcon,
  LightModeRounded as LightModeIcon,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import useAppToast from '../../common/useAppToast';
import { logout } from '../../../services/api';
import { ColorModeContext } from '../../../context/ColorModeContext';

const drawerWidth = 260;
const collapsedDrawerWidth = 76;

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: 8,
  backgroundColor: theme.palette.mode === 'dark'
    ? alpha(theme.palette.common.white, 0.05)
    : alpha(theme.palette.common.black, 0.05),
  '&:hover': {
    backgroundColor: theme.palette.mode === 'dark'
      ? alpha(theme.palette.common.white, 0.08)
      : alpha(theme.palette.common.black, 0.08),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  maxWidth: 300,
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.text.secondary,
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  width: '100%',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    width: '100%',
    fontSize: '14px',
  },
}));

function Header({ title, desktopSidebarOpen = true }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const { showToast } = useAppToast();

  const colorMode = useContext(ColorModeContext);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
    showToast({
      severity: 'success',
      title: 'Success!',
      message: 'Admin signed out successfully.',
    });
    window.setTimeout(() => {
      window.location.replace('/adminlogin');
    }, 650);
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
        background: (theme) => theme.palette.mode === 'dark' 
          ? 'rgba(11, 15, 25, 0.85)' 
          : 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(18px)',
        borderBottom: (theme) => theme.palette.mode === 'dark'
          ? '1px solid rgba(255, 255, 255, 0.08)'
          : '1px solid rgba(20, 33, 61, 0.08)',
        transition: (theme) => theme.transitions.create(['width', 'margin-left'], {
          duration: theme.transitions.duration.shorter,
        }),
      }}
    >
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 800, fontSize: 16 }}>
          {title}
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        <Search>
          <SearchIconWrapper>
            <SearchIcon fontSize="small" />
          </SearchIconWrapper>
          <StyledInputBase
            placeholder="Tìm kiếm..."
            inputProps={{ 'aria-label': 'search' }}
          />
        </Search>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Tooltip title={colorMode?.mode === 'dark' ? 'Bật chế độ sáng' : 'Bật chế độ tối'}>
            <IconButton onClick={colorMode?.toggleColorMode} color="inherit" sx={{ p: 1 }}>
              {colorMode?.mode === 'dark' ? <LightModeIcon sx={{ color: '#fbbf24' }} /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>

          <IconButton color="inherit">
            <Badge badgeContent={4} color="error">
              <NotificationsIcon fontSize="small" />
            </Badge>
          </IconButton>

          <IconButton onClick={handleMenu} color="inherit" sx={{ p: 0.5 }}>
            <Avatar sx={{ width: 35, height: 35, bgcolor: '#6c63ff', color: '#fff', fontWeight: 700, fontSize: 14 }}>
              A
            </Avatar>
          </IconButton>
        </Stack>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem onClick={handleClose}>Hồ sơ</MenuItem>
          <MenuItem onClick={handleClose}>Cài đặt</MenuItem>
          <MenuItem onClick={handleLogout}>Đăng xuất</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

export default Header;
