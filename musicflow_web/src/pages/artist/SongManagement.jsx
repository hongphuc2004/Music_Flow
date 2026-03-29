
import React, { useState, useEffect } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, CircularProgress, Alert, Chip, Tooltip, Typography, Stack
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArtistLayout from '../../components/Layout/artist/ArtistLayout';
import axios from 'axios';

const SongManagement = () => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        setLoading(true);
        setError(null);
        const artistName = localStorage.getItem('artistName');
        if (!artistName) {
          setError('Không tìm thấy tên nghệ sĩ.');
          setSongs([]);
          setLoading(false);
          return;
        }
        const res = await axios.get(`/api/songs/by-artist?name=${encodeURIComponent(artistName)}`);
        setSongs(res.data.songs || []);
      } catch (err) {
        setError('Không thể tải danh sách bài hát.');
      } finally {
        setLoading(false);
      }
    };
    fetchSongs();
  }, []);

  const handleEdit = (song) => {
    // TODO: Hiện modal chỉnh sửa bài hát
    alert(`Chức năng chỉnh sửa cho: ${song.title}`);
  };

  const handleDelete = (songId) => {
    // TODO: Gọi API xóa bài hát
    setSongs(songs.filter(s => s._id !== songId));
  };

  if (loading) return <Stack alignItems="center" py={2}><CircularProgress /></Stack>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <ArtistLayout title="My Songs">
      {songs.length === 0 ? (
        <Typography color="text.secondary">Bạn chưa upload bài hát nào.</Typography>
      ) : (
        <TableContainer component={Paper} sx={{ maxWidth: 900, mx: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tiêu đề</TableCell>
                <TableCell>Nghệ sĩ</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="center">Hành động</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {songs.map((song) => (
                <TableRow key={song._id}>
                  <TableCell>{song.title}</TableCell>
                  <TableCell>{song.artist}</TableCell>
                  <TableCell>
                    <Chip
                      label={song.isPublic ? 'Công khai' : 'Riêng tư'}
                      color={song.isPublic ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Chỉnh sửa">
                      <IconButton color="primary" onClick={() => handleEdit(song)} size="small">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Xóa">
                      <IconButton color="error" onClick={() => handleDelete(song._id)} size="small">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </ArtistLayout>
  );
};

export default SongManagement;
