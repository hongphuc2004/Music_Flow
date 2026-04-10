import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import {
  Edit as EditIcon,
  FavoriteRounded as FavoriteIcon,
  HeadphonesRounded as HeadphonesIcon,
  MusicNoteRounded as MusicNoteIcon,
  PersonAddAlt1Rounded as FollowersIcon,
  TrendingUpRounded as TrendingIcon,
  RadioRounded as RadioIcon,
} from '@mui/icons-material';
import ArtistLayout from '../../components/Layout/artist/ArtistLayout';
import ArtistProfileDialog from '../../components/artist/ArtistProfileDialog';
import { artistApi } from '../../services/api';
import { syncArtistSession } from '../../utils/artistSession';
import {
  buildArtistProfilePayload,
  calculateArtistAnalytics,
  createArtistProfileForm,
} from '../../utils/artistProfile';

function ArtistDashboard() {
  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [profileForm, setProfileForm] = useState(createArtistProfileForm());
  const [avatarFile, setAvatarFile] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const currentArtistResponse = await artistApi.getMe();
      const currentArtist = currentArtistResponse.data.artist;
      syncArtistSession(currentArtist);

      const profileResponse = await artistApi.getProfile({ id: currentArtist._id });
      const artistProfile = profileResponse.data.artist || {};

      setArtist({
        _id: currentArtist._id,
        name: currentArtist.name || artistProfile.name || 'Artist',
        email: currentArtist.email || '',
        avatar: currentArtist.avatar || artistProfile.avatar || '',
        bio: currentArtist.bio || artistProfile.bio || '',
        totalSongs: artistProfile.totalSongs || 0,
        totalLikes: artistProfile.totalLikes || 0,
        followers: artistProfile.followers || 0,
        monthlyListeners: artistProfile.monthlyListeners || 0,
        latestReleaseLabel: artistProfile.latestReleaseLabel || 'No release yet',
      });
      setSongs(artistProfile.songs || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load artist dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

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

  const handleProfileChange = (field) => (event) => {
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

      setArtist((prev) => ({
        ...prev,
        name: updatedArtist.name || prev?.name || '',
        email: updatedArtist.email || prev?.email || '',
        bio: updatedArtist.bio || '',
        avatar: updatedArtist.avatar || '',
      }));
      syncArtistSession(updatedArtist);
      setSuccess('Profile updated successfully.');
      handleCloseEdit();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setEditLoading(false);
    }
  };

  const analytics = useMemo(() => calculateArtistAnalytics(artist, songs), [artist, songs]);

  const stats = useMemo(() => ([
    {
      label: 'Released songs',
      value: analytics.totalSongs,
      icon: <MusicNoteIcon />,
      accent: '#0ea5e9',
      helper: 'Tracks live in your catalog',
    },
    {
      label: 'Total likes',
      value: analytics.totalLikes,
      icon: <FavoriteIcon />,
      accent: '#ef4444',
      helper: 'Hearts collected from listeners',
    },
    {
      label: 'Followers',
      value: analytics.followers,
      icon: <FollowersIcon />,
      accent: '#8b5cf6',
      helper: 'Fans tracking your next release',
    },
    {
      label: 'Monthly listeners',
      value: analytics.monthlyListeners,
      icon: <HeadphonesIcon />,
      accent: '#10b981',
      helper: 'Estimated audience this month',
    },
  ]), [analytics]);

  return (
    <ArtistLayout title="Artist Dashboard">
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 3 }}>
          <Card
            elevation={0}
            sx={{
              overflow: 'hidden',
              borderRadius: 6,
              border: '1px solid rgba(15, 23, 42, 0.08)',
              background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 48%, #38bdf8 100%)',
              color: '#fff',
            }}
          >
            <Box
              sx={{
                p: { xs: 3, md: 4 },
                background:
                  'radial-gradient(circle at top right, rgba(255,255,255,0.24), transparent 22%), radial-gradient(circle at left bottom, rgba(255,255,255,0.12), transparent 24%)',
              }}
            >
              <Grid container spacing={3} alignItems="center">
                <Grid size={{ xs: 12, md: 8 }}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                    <Avatar src={artist?.avatar} sx={{ width: 84, height: 84, bgcolor: 'rgba(255,255,255,0.18)' }}>
                      {artist?.name?.charAt(0)?.toUpperCase()}
                    </Avatar>
                    <Box>
                      <Chip
                        icon={<RadioIcon sx={{ color: '#fff !important' }} />}
                        label="Artist profile"
                        sx={{
                          mb: 1.25,
                          color: '#fff',
                          backgroundColor: 'rgba(255,255,255,0.16)',
                          border: '1px solid rgba(255,255,255,0.18)',
                        }}
                      />
                      <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.2 }}>
                        {artist?.name || 'Artist'}
                      </Typography>
                      <Typography sx={{ mt: 1, maxWidth: 620, color: 'rgba(255,255,255,0.82)' }}>
                        {artist?.bio || 'Tell listeners who you are, what you create, and what they should expect from your next release.'}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                    <Chip label={artist?.email || 'No email'} sx={{ color: '#fff', backgroundColor: 'rgba(255,255,255,0.14)' }} />
                    <Chip label={`Latest release: ${artist?.latestReleaseLabel || 'No release yet'}`} sx={{ color: '#fff', backgroundColor: 'rgba(255,255,255,0.14)' }} />
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card
                    elevation={0}
                    sx={{
                      borderRadius: 5,
                      backgroundColor: 'rgba(255,255,255,0.12)',
                      border: '1px solid rgba(255,255,255,0.14)',
                      color: '#fff',
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Typography variant="overline" sx={{ opacity: 0.8, letterSpacing: 1.2 }}>
                        Growth snapshot
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>
                        {analytics.monthlyListeners}
                      </Typography>
                      <Typography sx={{ opacity: 0.82, mb: 2.5 }}>
                        estimated monthly listeners across your public releases.
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<EditIcon />}
                        onClick={handleOpenEdit}
                        sx={{ bgcolor: '#fff', color: '#0f172a', fontWeight: 700, '&:hover': { bgcolor: '#e2e8f0' } }}
                      >
                        Edit profile
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </Card>

          <Grid container spacing={3}>
            {stats.map((item) => (
              <Grid key={item.label} size={{ xs: 12, sm: 6, xl: 3 }}>
                <Card elevation={0} sx={{ height: '100%', borderRadius: 5, border: '1px solid rgba(15, 23, 42, 0.08)', backgroundColor: '#ffffffcc', backdropFilter: 'blur(10px)' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 800, mt: 1 }}>{item.value}</Typography>
                      </Box>
                      <Box sx={{ width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: 3, color: item.accent, backgroundColor: `${item.accent}18` }}>
                        {item.icon}
                      </Box>
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 2.5, color: 'text.secondary' }}>{item.helper}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(15, 23, 42, 0.08)' }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Box>
                      <Typography variant="h6" fontWeight={800}>Recent releases</Typography>
                      <Typography color="text.secondary">The latest public songs attached to your artist profile.</Typography>
                    </Box>
                    <Chip icon={<TrendingIcon />} label="Live overview" color="primary" variant="outlined" />
                  </Stack>

                  {songs.length === 0 ? (
                    <Box sx={{ p: 3, borderRadius: 4, backgroundColor: '#f8fafc', border: '1px dashed rgba(15, 23, 42, 0.12)' }}>
                      <Typography fontWeight={700}>No songs yet</Typography>
                      <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                        Start uploading tracks and your dashboard will show release momentum here.
                      </Typography>
                    </Box>
                  ) : (
                    <Stack divider={<Divider flexItem />}>
                      {songs.slice(0, 5).map((song, index) => (
                        <Box key={song._id || `${song.title}-${index}`} sx={{ py: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                          <Avatar src={song.imageUrl} variant="rounded" sx={{ width: 56, height: 56, bgcolor: '#e0f2fe', color: '#0284c7' }}>
                            <MusicNoteIcon />
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography fontWeight={700} noWrap>{song.title}</Typography>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {Array.isArray(song.artists) && song.artists.length > 0
                                ? song.artists.map((item) => item.name).filter(Boolean).join(', ')
                                : artist?.name || 'Unknown artist'}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography fontWeight={700}>{song.likeCount || 0}</Typography>
                            <Typography variant="caption" color="text.secondary">likes</Typography>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, lg: 4 }}>
              <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(15, 23, 42, 0.08)', height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight={800}>Profile readiness</Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.75, mb: 2.5 }}>
                    Small touches make the artist page feel more alive to listeners.
                  </Typography>
                  <Stack spacing={1.5}>
                    <Chip label={artist?.bio ? 'Bio added' : 'Add a bio'} color={artist?.bio ? 'success' : 'default'} variant={artist?.bio ? 'filled' : 'outlined'} />
                    <Chip label={artist?.avatar ? 'Avatar added' : 'Add avatar URL or file'} color={artist?.avatar ? 'success' : 'default'} variant={artist?.avatar ? 'filled' : 'outlined'} />
                    <Chip label={analytics.totalSongs ? 'Songs published' : 'Upload your first release'} color={analytics.totalSongs ? 'success' : 'default'} variant={analytics.totalSongs ? 'filled' : 'outlined'} />
                  </Stack>
                  <Button fullWidth sx={{ mt: 3 }} variant="outlined" onClick={handleOpenEdit}>
                    Update artist profile
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      <ArtistProfileDialog
        open={editOpen}
        onClose={handleCloseEdit}
        onSubmit={handleSaveProfile}
        loading={editLoading}
        form={profileForm}
        onFieldChange={handleProfileChange}
        avatarFile={avatarFile}
        onAvatarFileChange={setAvatarFile}
      />
    </ArtistLayout>
  );
}

export default ArtistDashboard;
