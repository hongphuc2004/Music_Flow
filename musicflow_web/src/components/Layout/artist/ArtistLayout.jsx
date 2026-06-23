import { useState } from 'react';
import { Box, Toolbar } from '@mui/material';
import ArtistSidebar from './ArtistSidebar';
import ArtistHeader from './ArtistHeader';

const drawerWidth = 260;
const collapsedDrawerWidth = 76;

function ArtistLayout({ children, title }) {
  const [desktopOpen, setDesktopOpen] = useState(
    () => localStorage.getItem('musicflow-artist-sidebar-open') !== 'false'
  );

  const handleToggleDesktopSidebar = () => {
    setDesktopOpen((prev) => {
      const next = !prev;
      localStorage.setItem('musicflow-artist-sidebar-open', String(next));
      return next;
    });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'background.default',
        backgroundImage: (theme) => theme.palette.mode === 'dark'
          ? 'radial-gradient(circle at top right, rgba(108, 99, 255, 0.08), transparent 26%), radial-gradient(circle at left 20%, rgba(108, 99, 255, 0.05), transparent 30%)'
          : 'radial-gradient(circle at top right, rgba(108, 99, 255, 0.12), transparent 22%), radial-gradient(circle at left 20%, rgba(108, 99, 255, 0.08), transparent 28%)',
      }}
    >
      <ArtistSidebar desktopOpen={desktopOpen} onToggleDesktop={handleToggleDesktopSidebar} />
      <ArtistHeader title={title} desktopSidebarOpen={desktopOpen} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          width: `calc(100% - ${desktopOpen ? drawerWidth : collapsedDrawerWidth}px)`,
          minHeight: '100vh',
          transition: (theme) => theme.transitions.create('width', {
            duration: theme.transitions.duration.shorter,
          }),
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}

export default ArtistLayout;
