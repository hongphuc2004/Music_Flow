
import { Box, Toolbar } from '@mui/material';
import ArtistSidebar from './ArtistSidebar';
import ArtistHeader from './ArtistHeader';

const drawerWidth = 260;

function ArtistLayout({ children, title }) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <ArtistSidebar />
      <ArtistHeader title={title} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: `calc(100% - ${drawerWidth}px)`,
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}

export default ArtistLayout;
