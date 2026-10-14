import { createContext } from 'react';

const AppToastContext = createContext({
  showToast: () => {},
  updateToast: () => {},
});

export default AppToastContext;
