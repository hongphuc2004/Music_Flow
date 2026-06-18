import { useMemo, useState } from 'react';
import { Alert, AlertTitle, CircularProgress, Slide, Snackbar } from '@mui/material';
import AppToastContext from './AppToastContext';

const ToastSlide = (props) => <Slide {...props} direction="left" />;
const DEFAULT_TOAST_DURATION = 3000;

const accentBySeverity = {
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#38bdf8',
  success: '#22c55e',
};

function AppToastProvider({ children }) {
  const [toast, setToast] = useState({
    id: 0,
    open: false,
    severity: 'success',
    title: '',
    message: '',
    loading: false,
    progress: null,
    duration: DEFAULT_TOAST_DURATION,
  });

  const value = useMemo(() => ({
    showToast: ({ severity = 'success', title = '', message = '', loading = false, progress = null, duration = DEFAULT_TOAST_DURATION }) => {
      setToast((prev) => ({
        id: prev.id + 1,
        open: true,
        severity,
        title,
        message,
        loading,
        progress,
        duration,
      }));
    },
    updateToast: (updates = {}) => {
      setToast((prev) => ({
        ...prev,
        open: true,
        ...updates,
      }));
    },
  }), []);

  const handleClose = () => {
    setToast((prev) => ({ ...prev, open: false }));
  };

  return (
    <AppToastContext.Provider value={value}>
      {children}
      <Snackbar
        key={toast.id}
        open={toast.open}
        autoHideDuration={toast.loading ? null : toast.duration}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        TransitionComponent={ToastSlide}
        sx={{ mt: 7 }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={handleClose}
          icon={toast.loading ? <CircularProgress size={20} thickness={5} sx={{ color: '#fff' }} /> : undefined}
          sx={{
            minWidth: { xs: 280, sm: 340 },
            position: 'relative',
            overflow: 'hidden',
            color: '#fff',
            boxShadow: '0 18px 45px rgba(15, 23, 42, 0.24)',
            borderLeft: `5px solid ${accentBySeverity[toast.severity] || accentBySeverity.success}`,
            '& .MuiAlert-icon': { color: 'rgba(255,255,255,0.9)' },
          }}
        >
          {toast.title && <AlertTitle sx={{ fontWeight: 800, mb: 0.25 }}>{toast.title}</AlertTitle>}
          {toast.message}
          {toast.loading && (
            <span
              style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                height: 3,
                width: `${Math.max(0, Math.min(Number(toast.progress) || 0, 100))}%`,
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 0 12px rgba(255,255,255,0.85)',
                transition: 'width 220ms ease',
              }}
            />
          )}
        </Alert>
      </Snackbar>
    </AppToastContext.Provider>
  );
}

export default AppToastProvider;
