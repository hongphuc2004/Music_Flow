
import React, { useState } from 'react';
import {
  Box, Button, TextField, Checkbox, FormControlLabel, Typography, Stack, Alert, CircularProgress
} from '@mui/material';
import ArtistLayout from '../../components/Layout/artist/ArtistLayout';

const UploadSong = () => {
  const [songData, setSongData] = useState({
    title: '',
    artist: '',
    lyrics: '',
    isPublic: true,
  });
  const [audioFile, setAudioFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSongData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    if (name === 'audio') setAudioFile(files[0]);
    if (name === 'image') setImageFile(files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!songData.title || !songData.artist || !audioFile) {
      setError('Vui lòng nhập đầy đủ thông tin và chọn file nhạc.');
      return;
    }
    setLoading(true);
    // TODO: Gọi API upload thực tế ở đây
    setTimeout(() => {
      setLoading(false);
      setSuccess('Tải lên thành công!');
      setSongData({ title: '', artist: '', lyrics: '', isPublic: true });
      setAudioFile(null);
      setImageFile(null);
    }, 1200);
  };

  return (
    <ArtistLayout title="Upload Song">
      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, maxWidth: 500, mx: 'auto' }}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          <TextField
            label="Title"
            name="title"
            value={songData.title}
            onChange={handleInputChange}
            required
            fullWidth
          />
          <TextField
            label="Artist"
            name="artist"
            value={songData.artist}
            onChange={handleInputChange}
            required
            fullWidth
          />
          <TextField
            label="Lyrics"
            name="lyrics"
            value={songData.lyrics}
            onChange={handleInputChange}
            multiline
            minRows={3}
            fullWidth
          />
          <Button
            variant="outlined"
            component="label"
            color={audioFile ? 'success' : 'primary'}
          >
            {audioFile ? `Đã chọn: ${audioFile.name}` : 'Chọn file nhạc (MP3, WAV...)'}
            <input
              type="file"
              name="audio"
              accept="audio/*"
              hidden
              onChange={handleFileChange}
            />
          </Button>
          <Button
            variant="outlined"
            component="label"
            color={imageFile ? 'success' : 'primary'}
          >
            {imageFile ? `Đã chọn: ${imageFile.name}` : 'Chọn ảnh bìa (tùy chọn)'}
            <input
              type="file"
              name="image"
              accept="image/*"
              hidden
              onChange={handleFileChange}
            />
          </Button>
          <FormControlLabel
            control={
              <Checkbox
                name="isPublic"
                checked={songData.isPublic}
                onChange={handleInputChange}
                color="primary"
              />
            }
            label="Công khai bài hát này"
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Tải lên'}
          </Button>
        </Stack>
      </Box>
    </ArtistLayout>
  );
};

export default UploadSong;
