import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Toolbar } from '@mui/material';
import ClientSidebar from './ClientSidebar';
import ClientHeader from './ClientHeader';
import NowPlayingBar from './NowPlayingBar';
import ClientAuthDialog from './ClientAuthDialog';
import { useClientPlayerMeta } from './ClientPlayerProvider';

const drawerWidth = 260;

function ClientLayout({ children, title }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { hasSong } = useClientPlayerMeta();

  const titleByPath = {
    '/client/home': 'Trang chủ',
    '/client/discover': 'Khám Phá',
    '/client/library': 'Thư Viện ',
    '/client/genres': 'Chủ Đề & Thể Loại',
    '/client/rankings': 'Bảng Xếp Hạng',
    '/client/profile': 'Tài Khoản',
  };
  const resolvedTitle = titleByPath[location.pathname] || title || 'MusicFlow';

  const handleToggleSidebar = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleCloseSidebar = () => {
    setMobileOpen(false);
  };

  const handleLogoutSuccess = () => {
    setMobileOpen(false);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'background.default',
        backgroundImage: (theme) => theme.palette.mode === 'dark'
          ? 'radial-gradient(circle at top right, rgba(56,189,248,0.05), transparent 30%), radial-gradient(circle at left 30%, rgba(13,148,136,0.06), transparent 25%)'
          : 'radial-gradient(circle at top right, rgba(56,189,248,0.12), transparent 28%), radial-gradient(circle at left 30%, rgba(34,197,94,0.08), transparent 24%)',
      }}
    >
      <ClientSidebar
        mobileOpen={mobileOpen}
        onClose={handleCloseSidebar}
        onLogoutSuccess={handleLogoutSuccess}
      />
      <ClientHeader
        title={resolvedTitle}
        onToggleSidebar={handleToggleSidebar}
        onLogoutSuccess={handleLogoutSuccess}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          // Stable padding-bottom prevents CLS when NowPlayingBar appears/disappears
          pb: hasSong ? { xs: '132px', sm: '120px', md: '124px' } : { xs: 2, md: 3 },
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          // Hint browser to skip off-screen rendering → improves LCP and scroll performance
          contentVisibility: 'auto',
          containIntrinsicSize: '0 800px',
        }}
      >
        <Toolbar />
        {children}
      </Box>
      <NowPlayingBar />
      <ClientAuthDialog />
    </Box>
  );
}

export default ClientLayout;
