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
  Paper,
} from '@mui/material';
import {
  AlternateEmailRounded as EmailIcon,
  EditRounded as EditIcon,
  MusicNoteRounded as MusicIcon,
  RadioRounded as RadioIcon,
  VerifiedRounded as VerifiedIcon,
  PeopleRounded as PeopleIcon,
  TrendingUpRounded as TrendingIcon,
} from '@mui/icons-material';
import ArtistLayout from '../../components/Layout/artist/ArtistLayout';
import ArtistProfileDialog from './ArtistProfileDialog';
import { artistApi } from '../../services/api';
import { syncArtistSession } from '../../utils/artistSession';
import { buildArtistProfilePayload, createArtistProfileForm } from '../../utils/artistProfile';
import useAppToast from '../../components/common/useAppToast';

function ArtistProfile() {
  const { showToast } = useAppToast();
  const [artist, setArtist] = useState(null);
  const [stats, setStats] = useState({ followers: 0, monthlyListeners: 0, totalSongs: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

      // Fetch public profile metadata/stats (followers, etc.)
      try {
        const profileResponse = await artistApi.getProfile({ id: currentArtist._id });
        setStats({
          followers: profileResponse.data.artist?.followers || 0,
          monthlyListeners: profileResponse.data.artist?.monthlyListeners || 0,
          totalSongs: profileResponse.data.artist?.totalSongs || 0,
        });
      } catch (err) {
        console.warn('Could not fetch artist public profile stats:', err);
      }

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
      const message = 'Name and email are required.';
      setError(message);
      showToast({ severity: 'warning', title: 'Missing information', message });
      return;
    }

    try {
      setEditLoading(true);
      const response = await artistApi.updateProfile(buildArtistProfilePayload(profileForm, avatarFile));
      const updatedArtist = response.data.artist;
      setArtist(updatedArtist);
      syncArtistSession(updatedArtist);
      showToast({ severity: 'success', title: 'Success!', message: 'Profile updated successfully.' });
      
      // Update local state metrics with new artist info
      setArtist(prev => ({
        ...prev,
        avatar: updatedArtist.avatar,
        name: updatedArtist.name,
        email: updatedArtist.email,
        bio: updatedArtist.bio,
      }));
      
      handleCloseEdit();
      
      // Triggers header/sidebar refresh events
      window.dispatchEvent(new Event('artist-profile-updated'));
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update artist profile.';
      setError(message);
      showToast({ severity: 'error', title: 'Update failed', message });
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <ArtistLayout title="Artist Profile">
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={44} sx={{ color: '#6c63ff' }} />
        </Box>
      ) : (
        <Stack spacing={4}>
          {/* Panoramic Cover Banner (Spotify style) */}
          <Card 
            elevation={0} 
            sx={{ 
              position: 'relative',
              borderRadius: 6,
              overflow: 'hidden',
              height: { xs: 260, md: 360 },
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 8px 32px rgba(0,0,0,0.05)',
            }}
          >
            {/* Blurry cover background reflection */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: artist?.avatar ? `url(${artist.avatar})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(30px) brightness(0.4)',
                transform: 'scale(1.1)',
                bgcolor: '#0f172a',
              }}
            />
            
            {/* Linear overlay for details readibility */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.4) 60%, transparent 100%)',
              }}
            />

            {/* Inner details container */}
            <Stack 
              direction={{ xs: 'column', md: 'row' }} 
              spacing={3.5} 
              alignItems={{ xs: 'flex-start', md: 'flex-end' }}
              sx={{ 
                position: 'absolute', 
                bottom: 0, 
                left: 0, 
                right: 0, 
                p: { xs: 3.5, md: 5.5 },
                zIndex: 2,
                color: '#fff'
              }}
            >
              <Avatar 
                src={artist?.avatar} 
                sx={{ 
                  width: { xs: 100, md: 140 }, 
                  height: { xs: 100, md: 140 }, 
                  border: '5px solid rgba(255,255,255,0.15)', 
                  boxShadow: '0 12px 24px rgba(0,0,0,0.4)',
                  bgcolor: '#6c63ff',
                  fontSize: { xs: 44, md: 64 },
                  fontWeight: 900,
                }}
              >
                {artist?.name?.charAt(0)?.toUpperCase()}
              </Avatar>

              <Stack spacing={1} sx={{ flexGrow: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <VerifiedIcon sx={{ color: '#00bcd4', fontSize: { xs: 20, md: 24 } }} />
                  <Typography variant="caption" sx={{ letterSpacing: 1.5, fontWeight: 900, textTransform: 'uppercase', color: '#00bcd4' }}>
                    Verified Artist
                  </Typography>
                </Stack>
                <Typography variant="h2" fontWeight={900} sx={{ letterSpacing: '-1.5px', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                  {artist?.name || 'Artist'}
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.8, fontWeight: 500 }}>
                  {artist?.email || 'No email yet'}
                </Typography>
              </Stack>

              <Button 
                startIcon={<EditIcon />} 
                variant="contained" 
                onClick={handleOpenEdit}
                sx={{ 
                  bgcolor: '#fff', 
                  color: '#0f172a',
                  fontWeight: 800,
                  px: 4,
                  py: 1.5,
                  borderRadius: 4.5,
                  alignSelf: { xs: 'stretch', md: 'flex-end' },
                  boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.9)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                Edit Profile
              </Button>
            </Stack>
          </Card>

          {/* Statistics Grid */}
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3, 
                  borderRadius: 5, 
                  border: '1px solid', 
                  borderColor: 'divider',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2.5,
                  bgcolor: 'background.paper',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.01)',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: '0 6px 20px rgba(108,99,255,0.08)',
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                <Box sx={{ p: 2, borderRadius: 3.5, bgcolor: 'rgba(108, 99, 255, 0.08)', color: 'primary.main' }}>
                  <PeopleIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>FOLLOWERS</Typography>
                  <Typography variant="h4" fontWeight={900}>{stats.followers.toLocaleString('vi-VN')}</Typography>
                </Box>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3, 
                  borderRadius: 5, 
                  border: '1px solid', 
                  borderColor: 'divider',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2.5,
                  bgcolor: 'background.paper',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.01)',
                  '&:hover': {
                    borderColor: 'secondary.main',
                    boxShadow: '0 6px 20px rgba(0,188,212,0.08)',
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                <Box sx={{ p: 2, borderRadius: 3.5, bgcolor: 'rgba(0, 188, 212, 0.08)', color: 'secondary.main' }}>
                  <TrendingIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>MONTHLY LISTENERS</Typography>
                  <Typography variant="h4" fontWeight={900}>{stats.monthlyListeners.toLocaleString('vi-VN')}</Typography>
                </Box>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3, 
                  borderRadius: 5, 
                  border: '1px solid', 
                  borderColor: 'divider',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2.5,
                  bgcolor: 'background.paper',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.01)',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: '0 6px 20px rgba(108,99,255,0.08)',
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                <Box sx={{ p: 2, borderRadius: 3.5, bgcolor: 'rgba(108, 99, 255, 0.08)', color: 'primary.main' }}>
                  <MusicIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>TOTAL SONGS</Typography>
                  <Typography variant="h4" fontWeight={900}>{stats.totalSongs}</Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Details & Public Preview Card Section */}
          <Grid container spacing={3}>
            {/* Identity Info Stack */}
            <Grid size={{ xs: 12, lg: 8 }}>
              <Card 
                elevation={0} 
                sx={{ 
                  borderRadius: 6, 
                  border: '1px solid', 
                  borderColor: 'divider', 
                  bgcolor: 'background.paper',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
                }}
              >
                <CardContent sx={{ p: 4.5 }}>
                  <Typography variant="h5" fontWeight={900} sx={{ mb: 1 }}>Artist Identity</Typography>
                  <Typography color="text.secondary" sx={{ mb: 4, fontWeight: 500 }}>
                    Keep your public credentials up-to-date. This information is shown on client discover interfaces.
                  </Typography>
                  
                  <Stack divider={<Divider flexItem sx={{ borderStyle: 'dashed' }} />} spacing={1.5}>
                    {profileFacts.map((fact) => (
                      <Box key={fact.label} sx={{ py: 2.5, display: 'flex', gap: 3, alignItems: 'flex-start' }}>
                        <Box sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 3.5,
                          display: 'grid',
                          placeItems: 'center',
                          backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(108, 99, 255, 0.15)' : '#eef2ff',
                          color: '#6c63ff',
                          flexShrink: 0,
                        }}>
                          {fact.icon}
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                            {fact.label}
                          </Typography>
                          <Typography sx={{ mt: 0.75, fontWeight: 600, fontSize: 16, lineHeight: 1.6 }}>
                            {fact.value}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Listener Mock Preview Card */}
            <Grid size={{ xs: 12, lg: 4 }}>
              <Card 
                elevation={0} 
                sx={{ 
                  borderRadius: 6, 
                  border: '1px solid', 
                  borderColor: 'divider', 
                  bgcolor: 'background.paper',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
                  height: '100%',
                }}
              >
                <CardContent sx={{ p: 4.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <Typography variant="h5" fontWeight={900} sx={{ mb: 1 }}>Client View Preview</Typography>
                  <Typography color="text.secondary" sx={{ mb: 4.5, fontWeight: 500 }}>
                    Đây là giao diện thẻ nghệ sĩ hiển thị với người nghe trên trang khám phá.
                  </Typography>
                  
                  {/* Mock UI Card representing the artist on Client discovery */}
                  <Box 
                    sx={{ 
                      flexGrow: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      p: 2,
                    }}
                  >
                    <Paper
                      elevation={4}
                      sx={{
                        width: '100%',
                        maxWidth: 260,
                        borderRadius: 5,
                        overflow: 'hidden',
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
                        border: '1px solid',
                        borderColor: 'divider',
                        textAlign: 'center',
                        p: 3,
                        boxShadow: '0 20px 40px rgba(0,0,0,0.08)'
                      }}
                    >
                      <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
                        <Avatar
                          src={artist?.avatar}
                          sx={{ 
                            width: 100, 
                            height: 100, 
                            mx: 'auto',
                            boxShadow: '0 6px 15px rgba(0,0,0,0.1)',
                            bgcolor: '#6c63ff',
                            fontSize: 36,
                            fontWeight: 900
                          }}
                        >
                          {artist?.name?.charAt(0)?.toUpperCase()}
                        </Avatar>
                        <VerifiedIcon 
                          sx={{ 
                            position: 'absolute', 
                            bottom: 2, 
                            right: 2, 
                            color: '#00bcd4', 
                            bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1e293b' : '#fff',
                            borderRadius: '50%',
                            fontSize: 22
                          }} 
                        />
                      </Box>

                      <Typography variant="subtitle1" fontWeight={800} noWrap>
                        {artist?.name || 'Artist'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 2.5 }}>
                        Nghệ sĩ
                      </Typography>
                      
                      <Divider sx={{ mb: 2.5 }} />

                      <Stack direction="row" justifyContent="space-around" spacing={1}>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={800}>
                            {stats.followers.toLocaleString('vi-VN')}
                          </Typography>
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', fontWeight: 700 }}>
                            FOLLOWERS
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={800}>
                            {stats.totalSongs}
                          </Typography>
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', fontWeight: 700 }}>
                            TRACKS
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Stack>
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
