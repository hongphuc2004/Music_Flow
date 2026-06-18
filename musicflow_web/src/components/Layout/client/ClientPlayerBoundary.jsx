import { ClientPlayerProvider } from './ClientPlayerProvider';

function ClientPlayerBoundary({ children }) {
  return <ClientPlayerProvider>{children}</ClientPlayerProvider>;
}

export default ClientPlayerBoundary;
