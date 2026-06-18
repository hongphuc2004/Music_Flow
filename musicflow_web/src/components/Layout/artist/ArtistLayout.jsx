
import { Box, Toolbar } from '@mui/material';
import ArtistSidebar from './ArtistSidebar';
import ArtistHeader from './ArtistHeader';

const drawerWidth = 260;

function ArtistLayout({ children, title }) {
  return (
    <Box
        sx={{
          display: 'flex',
          minHeight: '100vh',
          bgcolor: '#f8fafc',
          backgroundImage:
            'radial-gradient(circle at top right, rgba(14,165,233,0.12), transparent 22%), radial-gradient(circle at left 20%, rgba(99,102,241,0.08), transparent 28%)',
        }}
      >
        <ArtistSidebar />
        <ArtistHeader title={title} />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            width: `calc(100% - ${drawerWidth}px)`,
            minHeight: '100vh',
          }}
        >
          <Toolbar />
          {children}
        </Box>
    </Box>
  );
}

export default ArtistLayout;
