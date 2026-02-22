import { useEffect, Suspense, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore, useUIStore, useCallStore } from './stores';
import { socketService } from './services';
import { IncomingCallDialog, ActiveCallInterface } from './components/calls';
import { usePresence } from './lib/usePresence';
import { ConnectionStatus } from './components/ConnectionStatus';
import {
  publicRoutes,
  protectedRoutes,
  notFoundRoute,
} from './config/routes';
import { PUBLIC_PATHS, TITLE_MAP } from './config/routeHelpers';

const Loading = () => (
  <div className="flex h-screen items-center justify-center bg-background text-foreground">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
      <p className="text-gray-400 text-sm animate-pulse">just a sec...</p>
    </div>
  </div>
);

// Page transition wrapper
const PageTransition = ({ children }) => (
  <Motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2, ease: 'easeInOut' }}
  >
    {children}
  </Motion.div>
);

// Guard: renders AuthPage for unauthenticated users
const ProtectedRoute = ({ element: Component }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { hasActiveCall, hasIncomingCall } = useCallStore();

  if (isLoading) return <Loading />;

  if (!isAuthenticated) {
    // Dynamically import AuthPage (already lazy via routes config)
    const AuthPage = publicRoutes.find(r => r.path === '/auth').element;
    return <AuthPage />;
  }

  return (
    <>
      <ConnectionStatus />
      {hasIncomingCall() && <IncomingCallDialog />}
      {hasActiveCall() && <ActiveCallInterface />}
      {!hasActiveCall() && Component && <Component />}
    </>
  );
};

const App = () => {
  const { user, isAuthenticated, checkSession } = useAuthStore();
  const { setIsMobile, theme } = useUIStore();
  const location = useLocation();
  const queryClient = useQueryClient();
  const prevAuthRef = useRef(isAuthenticated);

  const isPublicRoute = PUBLIC_PATHS.some(p => location.pathname.toLowerCase().startsWith(p));

  // Presence only makes sense when authenticated and on app routes.
  usePresence(!isPublicRoute && isAuthenticated);

  // --- Side Effects ---
  useEffect(() => { checkSession(); }, [checkSession]);

  // When auth flips, ensure all required data is fetched immediately.
  // This prevents the "login then refresh" issue caused by stale query caches and
  // ensures mounted queries refetch with the new auth context.
  useEffect(() => {
    const wasAuthenticated = prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    // Logout: drop app data and stop socket reconnect loops.
    if (!isAuthenticated && wasAuthenticated) {
      queryClient.clear();
      socketService.disconnect();
      return;
    }

    // Login: ensure we don't show stale/unauthorized cached results.
    if (isAuthenticated && !wasAuthenticated) {
      queryClient.clear();
      // Refetch any queries that are currently mounted/active.
      queryClient.refetchQueries({ type: 'active' });
    }
  }, [isAuthenticated, queryClient]);

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

  // Dynamic document titles
  useEffect(() => {
    document.title = TITLE_MAP[location.pathname.toLowerCase()] || 'Blinx AI Assistant | Chat';
  }, [location.pathname]);

  // WebRTC + Socket initialisation (only for authenticated non-public routes)
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
      if (cleanup) cleanup();
    };
  }, [isAuthenticated, user?.id, isPublicRoute]);

  // Routes
  const NotFoundEl = notFoundRoute.element;

  return (
    <Suspense fallback={<Loading />}>
      <AnimatePresence mode="wait">
        <PageTransition key={location.pathname}>
          <Routes location={location}>
            {/* Public routes */}
            {publicRoutes.map(({ path, element: Element }) => (
              <Route key={path} path={path} element={Element ? <Element /> : null} />
            ))}

            {/* Protected routes */}
            {protectedRoutes.map(({ path, element }) => (
              <Route key={path} path={path} element={<ProtectedRoute element={element} />} />
            ))}

            {/* 404 catch-all */}
            <Route path="*" element={<NotFoundEl />} />
          </Routes>
        </PageTransition>
      </AnimatePresence>
    </Suspense>
  );
};

export default App;
