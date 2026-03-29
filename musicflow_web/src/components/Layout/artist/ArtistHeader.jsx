import { useState } from 'react';
import {
  AppBar, Toolbar, Typography, IconButton, Menu, MenuItem, Avatar, Box
} from '@mui/material';
import {
  AccountCircle
} from '@mui/icons-material';

const drawerWidth = 260;

function ArtistHeader({ title }) {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };


  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.replace('/artistlogin');
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        width: `calc(100% - ${drawerWidth}px)`,
        ml: `${drawerWidth}px`,
        backgroundColor: '#fff',
        color: '#333',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton onClick={handleMenu} color="inherit">
          <Avatar sx={{ bgcolor: '#6c63ff' }}>
            <AccountCircle />
          </Avatar>
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleClose}
        >
          <MenuItem onClick={handleClose}>Profile</MenuItem>
          <MenuItem onClick={handleLogout}>Logout</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

export default ArtistHeader;
