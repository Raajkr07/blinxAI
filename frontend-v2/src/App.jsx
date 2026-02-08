import { useEffect } from 'react';
import { useAuthStore, useUIStore, useCallStore } from './stores';
import { socketService } from './services';
import { AuthPage, ChatPage } from './pages';
import { IncomingCallDialog, ActiveCallInterface } from './components/calls';

const App = () => {
  const { isAuthenticated, user } = useAuthStore();
  const { setIsMobile, theme } = useUIStore();
  const { hasActiveCall, hasIncomingCall } = useCallStore();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsMobile]);

  useEffect(() => {
    theme === 'light'
      ? document.documentElement.classList.add('light')
      : document.documentElement.classList.remove('light');
  }, [theme]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let cleanup;
    const { initializeWebRTC } = useCallStore.getState();

    socketService.connect()
      .then(() => {
        cleanup = initializeWebRTC(user.id);
      });

    return () => cleanup?.();
  }, [isAuthenticated, user?.id]);

  if (!isAuthenticated) return <AuthPage />;

  return (
    <>
      {hasIncomingCall() && <IncomingCallDialog />}
      {hasActiveCall() && <ActiveCallInterface />}
      {!hasActiveCall() && <ChatPage />}
    </>
  );
};

export default App;
