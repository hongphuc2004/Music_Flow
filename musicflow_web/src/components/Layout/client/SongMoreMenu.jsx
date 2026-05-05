import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { MoreHorizRounded as MoreIcon } from '@mui/icons-material';
import { clientFavoritesApi } from '../../../services/api';
import { useClientPlayer } from './ClientPlayerProvider';

function SongMoreMenu({ song, buttonSx }) {
  const navigate = useNavigate();
  const { playSong } = useClientPlayer();
  const [anchorEl, setAnchorEl] = useState(null);
  const [favorite, setFavorite] = useState(false);

  const open = Boolean(anchorEl);

  const songId = useMemo(() => song?._id || '', [song?._id]);
  const primaryArtistId = useMemo(() => {
    const firstArtist = Array.isArray(song?.artists) ? song.artists[0] : null;
    return firstArtist?._id || '';
  }, [song?.artists]);

  const handleOpen = async (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);

    if (!songId) return;

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

    try {
      await clientFavoritesApi.toggle(songId);
      setFavorite((prev) => !prev);
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
        <MenuItem onClick={handlePlay}>Phát ngay</MenuItem>
        <MenuItem onClick={handleToggleFavorite}>{favorite ? 'Bỏ yêu thích' : 'Thêm yêu thích'}</MenuItem>
        <MenuItem onClick={handleViewArtist} disabled={!primaryArtistId}>Xem nghệ sĩ</MenuItem>
      </Menu>
    </>
  );
}

export default SongMoreMenu;
