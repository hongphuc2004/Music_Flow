import { useState } from 'react';
import { Box, Toolbar } from '@mui/material';
import ClientSidebar from './ClientSidebar';
import ClientHeader from './ClientHeader';
import NowPlayingBar from './NowPlayingBar';

const drawerWidth = 260;

function ClientLayout({ children, title }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleToggleSidebar = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleCloseSidebar = () => {
    setMobileOpen(false);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: '#f8fafc',
        backgroundImage:
          'radial-gradient(circle at top right, rgba(56,189,248,0.12), transparent 28%), radial-gradient(circle at left 30%, rgba(34,197,94,0.08), transparent 24%)',
      }}
    >
      <ClientSidebar mobileOpen={mobileOpen} onClose={handleCloseSidebar} />
      <ClientHeader title={title} onToggleSidebar={handleToggleSidebar} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          pb: 13,
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        {children}
      </Box>
      <NowPlayingBar />
    </Box>
  );
}

export default ClientLayout;
