import { createContext } from 'react';

const AppToastContext = createContext({
  showToast: () => {},
});

export default AppToastContext;
