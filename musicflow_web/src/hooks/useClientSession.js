import { useEffect, useState } from 'react';

const CLIENT_SESSION_EVENT = 'musicflow-client-session-changed';

const readClientSession = () => ({
  isLoggedIn: localStorage.getItem('role') === 'user',
  userName: localStorage.getItem('userName') || localStorage.getItem('name') || 'Listener',
  userAvatar: localStorage.getItem('userAvatar') || '',
  userId: localStorage.getItem('userId') || '',
});

export const notifyClientSessionChanged = () => {
  window.dispatchEvent(new Event(CLIENT_SESSION_EVENT));
};

export default function useClientSession() {
  const [session, setSession] = useState(readClientSession);

  useEffect(() => {
    const syncSession = () => setSession(readClientSession());

    window.addEventListener(CLIENT_SESSION_EVENT, syncSession);
    window.addEventListener('storage', syncSession);

    return () => {
      window.removeEventListener(CLIENT_SESSION_EVENT, syncSession);
      window.removeEventListener('storage', syncSession);
    };
  }, []);

  return session;
}
