import { useEffect, useMemo, useState } from 'react';
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
  Stack,
} from '@mui/material';
import { clearArtistSession } from '../../../utils/artistSession';

const drawerWidth = 260;

function ArtistHeader({ title }) {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [artistName, setArtistName] = useState(localStorage.getItem('artistName') || 'Artist');
  const [artistAvatar, setArtistAvatar] = useState(localStorage.getItem('artistAvatar') || '');
  const artistInitial = useMemo(() => artistName.charAt(0).toUpperCase(), [artistName]);

  useEffect(() => {
    const syncArtist = () => {
      setArtistName(localStorage.getItem('artistName') || 'Artist');
      setArtistAvatar(localStorage.getItem('artistAvatar') || '');
    };

    window.addEventListener('artist-profile-updated', syncArtist);
    window.addEventListener('storage', syncArtist);

    return () => {
      window.removeEventListener('artist-profile-updated', syncArtist);
      window.removeEventListener('storage', syncArtist);
    };
  }, []);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('role');
    clearArtistSession();
    window.location.replace('/artistlogin');
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: `calc(100% - ${drawerWidth}px)`,
        ml: `${drawerWidth}px`,
        color: '#14213d',
        background: 'rgba(250, 252, 255, 0.86)',
        backdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(20, 33, 61, 0.08)',
      }}
    >
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mr: 1.5 }}>
          <Box sx={{ textAlign: 'right', display: { xs: 'none', md: 'block' } }}>
            <Typography variant="body2" fontWeight={700}>
              {artistName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Artist workspace
            </Typography>
          </Box>
          <IconButton onClick={handleMenu} color="inherit" sx={{ p: 0.5 }}>
            <Avatar src={artistAvatar} sx={{ bgcolor: '#0ea5e9', color: '#fff' }}>
              {artistAvatar ? null : artistInitial}
            </Avatar>
          </IconButton>
        </Stack>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
          <MenuItem onClick={() => { handleClose(); navigate('/artist/profile'); }}>Profile</MenuItem>
          <MenuItem onClick={handleLogout}>Logout</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

export default ArtistHeader;
