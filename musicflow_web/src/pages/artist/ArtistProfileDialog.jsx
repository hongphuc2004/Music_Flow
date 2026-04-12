import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';

function ArtistProfileDialog({
  open,
  onClose,
  onSubmit,
  loading,
  form,
  onFieldChange,
  avatarFile,
  onAvatarFileChange,
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit Artist Profile</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gap: 2, pt: 1 }}>
          <TextField label="Artist name" value={form.name} onChange={onFieldChange('name')} fullWidth />
          <TextField label="Email" type="email" value={form.email} onChange={onFieldChange('email')} fullWidth />
          <Button variant="outlined" component="label" fullWidth>
            {avatarFile ? `Avatar file: ${avatarFile.name}` : 'Upload avatar file (optional)'}
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={(event) => onAvatarFileChange(event.target.files?.[0] || null)}
            />
          </Button>
          <TextField
            label="Avatar URL"
            value={form.avatarUrl}
            onChange={onFieldChange('avatarUrl')}
            fullWidth
            helperText="You can upload a file or paste an image URL. If both are provided, the uploaded file is used first."
          />
          <TextField
            label="Bio"
            value={form.bio}
            onChange={onFieldChange('bio')}
            multiline
            minRows={4}
            fullWidth
            helperText="A short artist story, your sound direction, or what fans should expect next."
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit} disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Save profile'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ArtistProfileDialog;
