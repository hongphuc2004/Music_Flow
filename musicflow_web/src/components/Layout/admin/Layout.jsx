import { Box, Toolbar } from '@mui/material';
import Sidebar from './Sidebar';
import Header from './Header';
import AppToastProvider from '../../common/AppToastProvider';

const drawerWidth = 260;

function Layout({ children, title }) {
  return (
    <AppToastProvider>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
        <Sidebar />
        <Header title={title} />
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
    </AppToastProvider>
  );
}

export default Layout;
