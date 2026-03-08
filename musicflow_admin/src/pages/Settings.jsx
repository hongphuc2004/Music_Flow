import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Grid,
  Alert,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { Layout } from '../components/Layout';

function Settings() {
  const [settings, setSettings] = useState({
    siteName: 'MusicFlow',
    siteDescription: 'Your favorite music streaming platform',
    adminEmail: 'admin@musicflow.com',
    maxUploadSize: '50',
    enableRegistration: true,
    enableComments: true,
    maintenanceMode: false,
    analyticsEnabled: true,
  });
  const [saved, setSaved] = useState(false);

  const handleChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setSettings({ ...settings, [field]: value });
  };

  const handleSave = () => {
    // Note: Settings are not persisted to backend yet
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Layout title="Settings">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600}>
          Application Settings
        </Typography>
        <Typography color="text.secondary">
          Configure your MusicFlow admin settings
        </Typography>
      </Box>

      {saved && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Settings saved successfully!
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* General Settings */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              General Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <TextField
              fullWidth
              label="Site Name"
              value={settings.siteName}
              onChange={handleChange('siteName')}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Site Description"
              value={settings.siteDescription}
              onChange={handleChange('siteDescription')}
              multiline
              rows={2}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Admin Email"
              type="email"
              value={settings.adminEmail}
              onChange={handleChange('adminEmail')}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Max Upload Size (MB)"
              type="number"
              value={settings.maxUploadSize}
              onChange={handleChange('maxUploadSize')}
            />
          </Paper>
        </Grid>

        {/* Feature Toggles */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Features
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enableRegistration}
                  onChange={handleChange('enableRegistration')}
                  color="primary"
                />
              }
              label="Enable User Registration"
              sx={{ display: 'block', mb: 2 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enableComments}
                  onChange={handleChange('enableComments')}
                  color="primary"
                />
              }
              label="Enable Comments"
              sx={{ display: 'block', mb: 2 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.analyticsEnabled}
                  onChange={handleChange('analyticsEnabled')}
                  color="primary"
                />
              }
              label="Enable Analytics"
              sx={{ display: 'block', mb: 2 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.maintenanceMode}
                  onChange={handleChange('maintenanceMode')}
                  color="warning"
                />
              }
              label="Maintenance Mode"
              sx={{ display: 'block' }}
            />
          </Paper>
        </Grid>

        {/* Save Button */}
        <Grid size={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              sx={{ bgcolor: '#6c63ff', '&:hover': { bgcolor: '#5a52d5' } }}
            >
              Save Settings
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Layout>
  );
}

export default Settings;
