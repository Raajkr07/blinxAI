import { useEffect, lazy, Suspense } from 'react';
import { useAuthStore, useUIStore, useCallStore } from './stores';
import { socketService } from './services';
import { IncomingCallDialog, ActiveCallInterface } from './components/calls';
import { usePresence } from './lib/usePresence';
import { ConnectionStatus } from './components/ConnectionStatus';

const AuthPage = lazy(() => import('./pages/AuthPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const PrivacyPolicy = lazy(() => import('./pages/verification/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/verification/TermsOfService'));
const DataDeletion = lazy(() => import('./pages/verification/DataDeletion'));

const Loading = () => (
  <div className="flex h-screen items-center justify-center bg-[var(--color-background)] text-[var(--color-foreground)]">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
      <p className="text-gray-400 text-sm animate-pulse">Initializing session...</p>
    </div>
  </div>
);

const App = () => {
  // 1. Initialize all state hooks
  const { isAuthenticated, user, checkSession, isLoading } = useAuthStore();
  const { setIsMobile, theme } = useUIStore();
  const { hasActiveCall, hasIncomingCall } = useCallStore();

  // Subscribe to real-time presence updates
  usePresence();

  // 2. Routing Logic
  const rawPath = window.location.pathname.split('?')[0].replace(/\/$/, '').toLowerCase();
  const isPrivacy = rawPath === '/privacy-policy';
  const isTerms = rawPath === '/terms';
  const isDeletion = rawPath === '/data-deletion';
  const isPublicRoute = isPrivacy || isTerms || isDeletion;

  // 3. Side Effects
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

  // Update document title for verification pages
  useEffect(() => {
    if (isPrivacy) document.title = 'Privacy Policy | Blinx AI Assistant';
    else if (isTerms) document.title = 'Terms of Service | Blinx AI Assistant';
    else if (isDeletion) document.title = 'Data Deletion | Blinx AI Assistant';
    else document.title = 'Blinx AI Assistant | Chat';
  }, [isPrivacy, isTerms, isDeletion]);

  useEffect(() => {
    if (isPublicRoute || !isAuthenticated || !user?.id) return;

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
  }, [isAuthenticated, user?.id, isPublicRoute]);

  // 4. Render Hierarchy

  return (
    <Suspense fallback={<Loading />}>
      {isPrivacy ? <PrivacyPolicy /> :
        isTerms ? <TermsOfService /> :
          isDeletion ? <DataDeletion /> :
            isLoading ? <Loading /> :
              !isAuthenticated ? <AuthPage /> :
                (
                  <>
                    <ConnectionStatus />
                    {hasIncomingCall() && <IncomingCallDialog />}
                    {hasActiveCall() && <ActiveCallInterface />}
                    {!hasActiveCall() && <ChatPage />}
                  </>
                )}
    </Suspense>
  );
};

export default App;
