import { useMemo, useState } from 'react';
import { Alert, AlertTitle, Slide, Snackbar } from '@mui/material';
import AppToastContext from './AppToastContext';

const ToastSlide = (props) => <Slide {...props} direction="left" />;

const accentBySeverity = {
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#38bdf8',
  success: '#22c55e',
};

function AppToastProvider({ children }) {
  const [toast, setToast] = useState({
    open: false,
    severity: 'success',
    title: '',
    message: '',
  });

  const value = useMemo(() => ({
    showToast: ({ severity = 'success', title = '', message = '' }) => {
      setToast({ open: true, severity, title, message });
    },
  }), []);

  const handleClose = () => {
    setToast((prev) => ({ ...prev, open: false }));
  };

  return (
    <AppToastContext.Provider value={value}>
      {children}
      <Snackbar
        open={toast.open}
        autoHideDuration={2800}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        TransitionComponent={ToastSlide}
        sx={{ mt: 7 }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={handleClose}
          sx={{
            minWidth: { xs: 280, sm: 340 },
            color: '#fff',
            boxShadow: '0 18px 45px rgba(15, 23, 42, 0.24)',
            borderLeft: `5px solid ${accentBySeverity[toast.severity] || accentBySeverity.success}`,
            '& .MuiAlert-icon': { color: 'rgba(255,255,255,0.9)' },
          }}
        >
          {toast.title && <AlertTitle sx={{ fontWeight: 800, mb: 0.25 }}>{toast.title}</AlertTitle>}
          {toast.message}
        </Alert>
      </Snackbar>
    </AppToastContext.Provider>
  );
}

export default AppToastProvider;
