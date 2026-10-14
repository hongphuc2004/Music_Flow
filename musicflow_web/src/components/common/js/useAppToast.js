import { useContext } from 'react';
import AppToastContext from './AppToastContext';

const useAppToast = () => useContext(AppToastContext);

export default useAppToast;
