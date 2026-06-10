import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { MoreHorizRounded as MoreIcon } from '@mui/icons-material';
import { clientFavoritesApi, clientSongsApi } from '../../../services/api';
import { useClientPlayerActions } from './ClientPlayerProvider';
import useClientToast from './useClientToast';

function SongMoreMenu({ song, buttonSx }) {
  const navigate = useNavigate();
  const { playSong } = useClientPlayerActions();
  const { showToast } = useClientToast();
  const [anchorEl, setAnchorEl] = useState(null);
  const [favorite, setFavorite] = useState(false);

  const open = Boolean(anchorEl);
  const isLoggedIn = localStorage.getItem('role') === 'user';

  const songId = useMemo(() => song?._id || '', [song?._id]);
  const primaryArtistId = useMemo(() => {
    const firstArtist = Array.isArray(song?.artists) ? song.artists[0] : null;
    return firstArtist?._id || '';
  }, [song?.artists]);

  const handleOpen = async (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);

    if (!songId || !isLoggedIn) return;

    try {
      const response = await clientFavoritesApi.check(songId);
      setFavorite(Boolean(response.data?.isFavorite));
    } catch {
      setFavorite(false);
    }
  };

  const handleClose = (event) => {
    event?.stopPropagation?.();
    setAnchorEl(null);
  };

  const handleToggleFavorite = async (event) => {
    event.stopPropagation();
    if (!songId) return;

    if (!isLoggedIn) {
      handleClose(event);
      showToast({
        severity: 'info',
        title: 'Can dang nhap',
        message: 'Vui long dang nhap de them bai hat yeu thich.',
      });
      return;
    }

    try {
      await clientFavoritesApi.toggle(songId);
      setFavorite((prev) => {
        const next = !prev;
        showToast({
          severity: 'success',
          title: 'Thanh cong!',
          message: next
            ? 'Da them bai hat vao danh sach yeu thich.'
            : 'Da bo bai hat khoi danh sach yeu thich.',
        });
        return next;
      });
    } catch (error) {
      showToast({
        severity: 'error',
        title: 'Co loi xay ra',
        message: error.response?.data?.message || 'Khong the cap nhat yeu thich.',
      });
    } finally {
      handleClose(event);
    }
  };

  const handleViewArtist = (event) => {
    event.stopPropagation();

    if (primaryArtistId) {
      navigate(`/client/artists/${primaryArtistId}`);
    }

    handleClose(event);
  };

  const handlePlay = (event) => {
    event.stopPropagation();
    playSong(song);
    handleClose(event);
  };

  const handleDownload = async (event) => {
    event.stopPropagation();
    if (!songId) return;

    if (!isLoggedIn) {
      handleClose(event);
      showToast({
        severity: 'info',
        title: 'Can dang nhap',
        message: 'Vui long dang nhap de tai bai hat.',
      });
      return;
    }

    try {
      await clientSongsApi.requestDownload(songId);
      showToast({
        severity: 'success',
        title: 'Da tai xuong',
        message: 'Bai hat da duoc them vao danh sach bai hat da tai.',
      });
    } catch (error) {
      showToast({
        severity: 'error',
        title: 'Khong the tai bai hat',
        message: error.response?.data?.message || 'Vui long thu lai sau.',
      });
    } finally {
      handleClose(event);
    }
  };

  return (
    <>
      <IconButton
        size="small"
        onClick={handleOpen}
        onKeyDown={(event) => event.stopPropagation()}
        sx={{
          color: '#0f766e',
          p: 0.45,
          '&:hover': { backgroundColor: 'rgba(20, 184, 166, 0.14)' },
          ...buttonSx,
        }}
        aria-label="More"
      >
        <MoreIcon sx={{ fontSize: 22 }} />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={(event) => event.stopPropagation()}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handlePlay}>Phat ngay</MenuItem>
        <MenuItem onClick={handleToggleFavorite}>{favorite ? 'Bo yeu thich' : 'Them yeu thich'}</MenuItem>
        <MenuItem onClick={handleDownload}>Tai bai hat</MenuItem>
        <MenuItem onClick={handleViewArtist} disabled={!primaryArtistId}>Xem nghe si</MenuItem>
      </Menu>
    </>
  );
}

export default SongMoreMenu;
