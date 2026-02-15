import { useEffect } from 'react';
import { useAuthStore, useUIStore, useCallStore } from './stores';
import { socketService } from './services';
import { AuthPage, ChatPage, PrivacyPolicy, TermsOfService, DataDeletion } from './pages';
import { IncomingCallDialog, ActiveCallInterface } from './components/calls';

const App = () => {
  const { isAuthenticated, user, checkSession, isLoading } = useAuthStore();
  const { setIsMobile, theme } = useUIStore();
  const { hasActiveCall, hasIncomingCall } = useCallStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

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

  // Handle public verification routes
  const rawPath = window.location.pathname.split('?')[0].replace(/\/$/, '').toLowerCase();

  if (rawPath === '/privacy-policy') {
    document.title = 'Privacy Policy | Blink';
    return <PrivacyPolicy />;
  }
  if (rawPath === '/terms') {
    document.title = 'Terms of Service | Blink';
    return <TermsOfService />;
  }
  if (rawPath === '/data-deletion') {
    document.title = 'Data Deletion | Blink';
    return <DataDeletion />;
  }

  // Restore default title for app pages
  if (typeof document !== 'undefined' && document.title !== 'Blink | Chat') {
    document.title = 'Blink | Chat';
  }

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let isCancelled = false;
    let cleanup;
    const { initializeWebRTC } = useCallStore.getState();

    socketService.connect()
      .then(() => {
        if (isCancelled) return;
        cleanup = initializeWebRTC(user.id);
      });

    return () => {
      isCancelled = true;
      if (cleanup) {
        cleanup();
      }
    };
  }, [isAuthenticated, user?.id]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-background)] text-[var(--color-foreground)]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
          <p className="text-gray-400 text-sm animate-pulse">Initializing session...</p>
        </div>
      </div>
    );
  }

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
