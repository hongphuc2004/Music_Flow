import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Toolbar, useTheme } from '@mui/material';
import ClientSidebar from './ClientSidebar';
import ClientHeader from './ClientHeader';
import ClientNowPlayingBar from './ClientNowPlayingBar';
import ClientAuthDialog from './ClientAuthDialog';
import ClientSongCommentsDrawer from './ClientSongCommentsDrawer';
import { useClientPlayer } from './ClientPlayerProvider';
import { clientSongsApi } from '../../../services/client/client.service';

const drawerWidth = 260;
const collapsedDrawerWidth = 76;

function ClientLayout({ children, title }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(
    () => localStorage.getItem('musicflow-client-sidebar-open') !== 'false'
  );
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [targetCommentId, setTargetCommentId] = useState(null);
  const [commentCount, setCommentCount] = useState(0);
  const location = useLocation();
  const theme = useTheme();

  const playerCtx = useClientPlayer();
  const currentSong = playerCtx?.currentSong;
  const playSong = playerCtx?.playSong;

  const titleByPath = {
    '/client/home': 'Trang chủ',
    '/client/discover': 'Khám Phá',
    '/client/library': 'Thư Viện ',
    '/client/genres': 'Chủ Đề & Thể Loại',
    '/client/rankings': 'Bảng Xếp Hạng',
    '/client/profile': 'Tài Khoản',
  };
  const resolvedTitle = titleByPath[location.pathname] || title || 'MusicFlow';

  const handleToggleMobileSidebar = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleToggleDesktopSidebar = () => {
    setDesktopOpen((prev) => {
      const next = !prev;
      localStorage.setItem('musicflow-client-sidebar-open', String(next));
      return next;
    });
  };

  const handleCloseSidebar = () => {
    setMobileOpen(false);
  };

  const handleLogoutSuccess = () => {
    setMobileOpen(false);
  };

  const handleOpenCommentsTarget = async ({ songId, commentId, actionUrl }) => {
    let resolvedCommentId = commentId;
    if (!resolvedCommentId && actionUrl && actionUrl.includes('comment=')) {
      const match = actionUrl.match(/comment=([^&]+)/);
      if (match && match[1]) {
        resolvedCommentId = match[1];
      }
    }

    if (resolvedCommentId) {
      setTargetCommentId(resolvedCommentId);
    }

    if (songId && songId !== currentSong?._id) {
      try {
        const res = await clientSongsApi.getSongById(songId);
        if (res.data?.success && res.data.song && playSong) {
          playSong(res.data.song);
        }
      } catch (err) {
        console.warn('Failed to load song from notification:', err);
      }
    }

    setCommentsOpen(true);
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
        desktopOpen={desktopOpen}
        onToggleDesktop={handleToggleDesktopSidebar}
        onClose={handleCloseSidebar}
        onLogoutSuccess={handleLogoutSuccess}
      />
      <ClientHeader
        title={resolvedTitle}
        desktopSidebarOpen={desktopOpen}
        onToggleSidebar={handleToggleMobileSidebar}
        onLogoutSuccess={handleLogoutSuccess}
        onOpenCommentsTarget={handleOpenCommentsTarget}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          // Stable padding-bottom prevents CLS when NowPlayingBar appears/disappears
          pb: { xs: '132px', sm: '120px', md: '124px' },
          width: {
            xs: '100%',
            md: `calc(100% - ${desktopOpen ? drawerWidth : collapsedDrawerWidth}px)`,
          },
          minHeight: '100vh',
          transition: theme.transitions.create('width', {
            duration: theme.transitions.duration.shorter,
          }),
          // Hint browser to skip off-screen rendering → improves LCP and scroll performance
        }}
      >
        <Toolbar />
        {children}
      </Box>
      <ClientNowPlayingBar
        desktopSidebarOpen={desktopOpen}
        commentsOpen={commentsOpen}
        onToggleComments={() => setCommentsOpen((prev) => !prev)}
        commentCount={commentCount}
        setCommentCount={setCommentCount}
      />
      <ClientSongCommentsDrawer
        open={commentsOpen}
        onClose={() => {
          setCommentsOpen(false);
          setTargetCommentId(null);
        }}
        commentCount={commentCount}
        onCommentCountChanged={setCommentCount}
        targetCommentId={targetCommentId}
      />
      <ClientAuthDialog />
    </Box>
  );
}

export default ClientLayout;
