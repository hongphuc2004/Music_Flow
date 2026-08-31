import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Toolbar, useTheme } from '@mui/material';
import ClientSidebar from './ClientSidebar';
import ClientHeader from './ClientHeader';
import ClientNowPlayingBar from './ClientNowPlayingBar';
import ClientFooter from './ClientFooter';
import ClientAuthDialog from './ClientAuthDialog';
import ClientSongCommentsDrawer from './ClientSongCommentsDrawer';
import ClientQueueDrawer from './ClientQueueDrawer';
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
  const [queueOpen, setQueueOpen] = useState(false);
  const [targetCommentId, setTargetCommentId] = useState(null);
  const [commentTargetSong, setCommentTargetSong] = useState(null);
  const [commentCount, setCommentCount] = useState(0);
  const location = useLocation();
  const theme = useTheme();

  const playerCtx = useClientPlayer();
  const currentSong = playerCtx?.currentSong;

  const titleByPath = {
    '/': 'Trang chủ',
    '/home': 'Trang chủ',
    '/discover': 'Khám Phá',
    '/library': 'Thư Viện',
    '/favorites': 'Yêu Thích',
    '/genres': 'Chủ Đề & Thể Loại',
    '/rankings': 'Bảng Xếp Hạng',
    '/ai-mood': 'AI Mood DJ',
    '/profile': 'Tài Khoản',
    '/premium': 'Gói Premium',
    '/client/home': 'Trang chủ',
    '/client/discover': 'Khám Phá',
    '/client/library': 'Thư Viện',
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
    let resolvedSongId = songId;
    if (!resolvedSongId && actionUrl && actionUrl.includes('/client/song/')) {
      const match = actionUrl.match(/\/client\/song\/([^?&]+)/);
      if (match && match[1]) {
        resolvedSongId = match[1];
      }
    }

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

    if (resolvedSongId) {
      if (resolvedSongId !== currentSong?._id) {
        try {
          const res = await clientSongsApi.getSongById(resolvedSongId);
          if (res.data?.success && res.data.song) {
            setCommentTargetSong(res.data.song);
          }
        } catch (err) {
          console.warn('Failed to load song from notification:', err);
        }
      } else {
        setCommentTargetSong(null);
      }
    } else {
      setCommentTargetSong(null);
    }

    setCommentsOpen(true);
  };

  const handleCloseComments = () => {
    setCommentsOpen(false);
    setTargetCommentId(null);
    setCommentTargetSong(null);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'background.default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Dynamic Liquid Ambient Aura Background Orbs (Apple Music Style) ── */}
      <Box
        className="animate-liquid-aura-1"
        sx={{
          position: 'fixed',
          top: '-15%',
          left: '10%',
          width: { xs: '380px', md: '550px' },
          height: { xs: '380px', md: '550px' },
          borderRadius: '50%',
          background: (theme) => theme.palette.mode === 'dark'
            ? 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.1) 50%, transparent 75%)'
            : 'radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.05) 50%, transparent 75%)',
          filter: 'blur(90px)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <Box
        className="animate-liquid-aura-2"
        sx={{
          position: 'fixed',
          bottom: '-10%',
          right: '5%',
          width: { xs: '350px', md: '520px' },
          height: { xs: '350px', md: '520px' },
          borderRadius: '50%',
          background: (theme) => theme.palette.mode === 'dark'
            ? 'radial-gradient(circle, rgba(6, 182, 212, 0.16) 0%, rgba(59, 130, 246, 0.08) 50%, transparent 75%)'
            : 'radial-gradient(circle, rgba(6, 182, 212, 0.08) 0%, rgba(59, 130, 246, 0.04) 50%, transparent 75%)',
          filter: 'blur(95px)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
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
          p: { xs: 2, sm: 2.5, md: 3.5 },
          // Dynamic padding-bottom ensures no extra gap when player is hidden
          pb: currentSong ? { xs: '110px', sm: '106px', md: '110px' } : { xs: 2, md: 3 },
          width: {
            xs: '100%',
            md: `calc(100% - ${desktopOpen ? drawerWidth : collapsedDrawerWidth}px)`,
          },
          minHeight: '100vh',
          transition: theme.transitions.create('width', {
            duration: theme.transitions.duration.shorter,
          }),
        }}
      >
        <Toolbar />
        {children}
        <ClientFooter />
      </Box>
      <ClientNowPlayingBar
        desktopSidebarOpen={desktopOpen}
        commentsOpen={commentsOpen}
        onToggleComments={() => setCommentsOpen((prev) => !prev)}
        queueOpen={queueOpen}
        onToggleQueue={() => setQueueOpen((prev) => !prev)}
        commentCount={commentCount}
        setCommentCount={setCommentCount}
      />
      <ClientQueueDrawer
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
      />
      <ClientSongCommentsDrawer
        open={commentsOpen}
        onClose={handleCloseComments}
        commentCount={commentCount}
        onCommentCountChanged={setCommentCount}
        targetCommentId={targetCommentId}
        targetSong={commentTargetSong}
      />
      <ClientAuthDialog />
    </Box>
  );
}

export default ClientLayout;
