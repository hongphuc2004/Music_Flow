import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import {
  AlternateEmailRounded as EmailIcon,
  EditRounded as EditIcon,
  MusicNoteRounded as MusicIcon,
  RadioRounded as RadioIcon,
} from '@mui/icons-material';
import ArtistLayout from '../../components/Layout/artist/ArtistLayout';
import ArtistProfileDialog from './ArtistProfileDialog';
import { artistApi } from '../../services/api';
import { syncArtistSession } from '../../utils/artistSession';
import { buildArtistProfilePayload, createArtistProfileForm } from '../../utils/artistProfile';

function ArtistProfile() {
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [profileForm, setProfileForm] = useState(createArtistProfileForm());
  const [avatarFile, setAvatarFile] = useState(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await artistApi.getMe();
      const currentArtist = response.data.artist;
      setArtist(currentArtist);
      syncArtistSession(currentArtist);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load artist profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const profileFacts = useMemo(() => ([
    { label: 'Display name', value: artist?.name || 'Artist', icon: <RadioIcon /> },
    { label: 'Email', value: artist?.email || 'No email yet', icon: <EmailIcon /> },
    { label: 'Bio', value: artist?.bio || 'Add a short bio so listeners know your style and story.', icon: <MusicIcon /> },
  ]), [artist]);

  const handleOpenEdit = () => {
    setProfileForm(createArtistProfileForm(artist));
    setAvatarFile(null);
    setEditOpen(true);
    setError('');
    setSuccess('');
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setEditLoading(false);
    setProfileForm(createArtistProfileForm());
    setAvatarFile(null);
  };

  const handleChange = (field) => (event) => {
    setProfileForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSaveProfile = async () => {
    if (!profileForm.name.trim() || !profileForm.email.trim()) {
      setError('Name and email are required.');
      return;
    }

    try {
      setEditLoading(true);
      const response = await artistApi.updateProfile(buildArtistProfilePayload(profileForm, avatarFile));
      const updatedArtist = response.data.artist;
      setArtist(updatedArtist);
      syncArtistSession(updatedArtist);
      setSuccess('Profile updated successfully.');
      handleCloseEdit();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update artist profile.');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <ArtistLayout title="Artist Profile">
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {loading ? (
        <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 4 }}>
            <Card elevation={0} sx={{ borderRadius: 6, border: '1px solid rgba(15,23,42,0.08)', overflow: 'hidden' }}>
              <Box sx={{ height: 140, background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 60%, #1e3a8a 100%)' }} />
              <CardContent sx={{ p: 3, mt: -6, position: 'relative' }}>
                <Avatar src={artist?.avatar} sx={{ width: 96, height: 96, border: '4px solid #fff', bgcolor: '#0ea5e9' }}>
                  {artist?.name?.charAt(0)?.toUpperCase()}
                </Avatar>
                <Typography variant="h5" fontWeight={800} sx={{ mt: 2 }}>{artist?.name || 'Artist'}</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>{artist?.email || 'No email yet'}</Typography>
                <Button fullWidth startIcon={<EditIcon />} variant="contained" sx={{ mt: 3 }} onClick={handleOpenEdit}>
                  Edit profile
                </Button>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Card elevation={0} sx={{ borderRadius: 6, border: '1px solid rgba(15,23,42,0.08)' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>Artist identity</Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  Keep your public artist profile polished so listeners can recognize your brand quickly.
                </Typography>
                <Stack divider={<Divider flexItem />}>
                  {profileFacts.map((fact) => (
                    <Box key={fact.label} sx={{ py: 2.25, display: 'flex', gap: 2 }}>
                      <Box sx={{ width: 44, height: 44, borderRadius: 3, display: 'grid', placeItems: 'center', backgroundColor: '#e0f2fe', color: '#0284c7', flexShrink: 0 }}>
                        {fact.icon}
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">{fact.label}</Typography>
                        <Typography sx={{ mt: 0.5, fontWeight: 600 }}>{fact.value}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <ArtistProfileDialog
        open={editOpen}
        onClose={handleCloseEdit}
        onSubmit={handleSaveProfile}
        loading={editLoading}
        form={profileForm}
        onFieldChange={handleChange}
        avatarFile={avatarFile}
        onAvatarFileChange={setAvatarFile}
      />
    </ArtistLayout>
  );
}

export default ArtistProfile;
