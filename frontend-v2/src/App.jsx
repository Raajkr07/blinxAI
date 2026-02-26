import { useEffect, Suspense, useRef, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { useUIStore } from './stores/uiStore';
import { useSocketStore } from './stores/socketStore';
import { useChatStore } from './stores/chatStore';
import {
  publicRoutes,
  protectedRoutes,
  notFoundRoute,
} from './config/routes';
import { PUBLIC_PATHS, TITLE_MAP } from './config/routeHelpers';
import { clearReportedError, reportSuccess } from './lib/reportError';

const AuthenticatedShell = lazy(() => import('./components/AuthenticatedShell').then(m => ({ default: m.AuthenticatedShell })));
const AnimatedAppRoutes = lazy(() => import('./components/AnimatedAppRoutes').then(m => ({ default: m.AnimatedAppRoutes })));

const Loading = () => (
  <div className="flex h-screen items-center justify-center bg-background text-foreground">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
      <p className="text-gray-400 text-sm animate-pulse">just a sec...</p>
    </div>
  </div>
);

// Guard: renders AuthPage for unauthenticated users
const ProtectedRoute = ({ element: Component }) => {
  const { isAuthenticated, isLoading, hasCheckedSession } = useAuthStore();

  if (isLoading || !hasCheckedSession) return <Loading />;

  if (!isAuthenticated) {
    // Dynamically import AuthPage (already lazy via routes config)
    const AuthPage = publicRoutes.find(r => r.path === '/auth').element;
    return <AuthPage />;
  }

  return (
    <Suspense fallback={<Loading />}>
      <AuthenticatedShell Component={Component} />
    </Suspense>
  );
};

const App = () => {
  const { isAuthenticated, checkSession } = useAuthStore();
  const { setIsMobile, theme } = useUIStore();
  const location = useLocation();
  const queryClient = useQueryClient();
  const prevAuthRef = useRef(isAuthenticated);
  const socketConnected = useSocketStore(state => state.connected);

  const isPublicRoute = PUBLIC_PATHS.some(p => location.pathname.toLowerCase().startsWith(p));

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
      import('./services/socketService')
        .then((m) => m.socketService.disconnect())
        .catch(() => { });
      return;
    }

    // Login: ensure we don't show stale/unauthorized cached results.
    if (isAuthenticated && !wasAuthenticated) {
      queryClient.clear();
      // Refetch any queries that are currently mounted/active.
      queryClient.refetchQueries({ type: 'active' });

      // Google login redirects back into the app without a component-level success toast.
      // Show it once here when auth becomes true.
      try {
        const flag = sessionStorage.getItem('post-login-toast');
        if (flag === 'google' && !isPublicRoute) {
          reportSuccess('login-success', 'Welcome back');
        }
        sessionStorage.removeItem('post-login-toast');
      } catch {
        // ignore storage failures
      }
    }
  }, [isAuthenticated, queryClient, isPublicRoute]);

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

  // Cleanup stale "Sending..." messages older than 1 day on every auth/mount
  useEffect(() => {
    if (isAuthenticated) {
      useChatStore.getState().cleanupStaleMessages();
    }
  }, [isAuthenticated]);

  // Offline Sync: Send pending messages when socket reconnects
  useEffect(() => {
    if (!socketConnected || !isAuthenticated) return;

    const flushOutbox = () => {
      const state = useChatStore.getState();
      const outbox = state.pendingOutbox || {};
      const pendingKeys = Object.keys(outbox);
      if (pendingKeys.length === 0) return;

      const flushedConversationIds = new Set();

      import('./services/socketService').then(({ socketService }) => {
        pendingKeys.forEach(tempId => {
          const msg = outbox[tempId];
          if (msg && msg.destination && msg.payload) {
            try {
              const sent = socketService.send(msg.destination, msg.payload);
              if (sent) {
                const currentState = useChatStore.getState();
                const newOutbox = { ...currentState.pendingOutbox };
                delete newOutbox[tempId];
                useChatStore.setState({ pendingOutbox: newOutbox });

                // Track which conversations had messages flushed
                const convId = msg.payload?.conversationId;
                if (convId) flushedConversationIds.add(convId);

                // Schedule removal of the optimistic message after a delay
                // (gives WebSocket echo time to arrive; if it already removed it, this is a no-op)
                setTimeout(() => {
                  useChatStore.getState().removeOptimisticMessage(tempId);
                }, 8000);
              }
              // If not sent, stays in outbox for next retry
            } catch (e) {
              console.warn('Sync failed for message', tempId, e);
            }
          }
        });

        // Refetch message queries for flushed conversations so the UI
        // transitions from "Sending..." to "Sent" without a manual refresh
        if (flushedConversationIds.size > 0) {
          setTimeout(() => {
            flushedConversationIds.forEach(convId => {
              queryClient.invalidateQueries({ queryKey: ['messages', convId] });
            });
          }, 3000);
        }
      }).catch(err => console.error('Failed to load socket service for sync', err));
    };

    // Delay initial flush so WebSocket subscriptions can re-establish first
    const initialTimer = setTimeout(flushOutbox, 1500);
    // Periodic retry for any items that failed to send
    const retryTimer = setInterval(flushOutbox, 15000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(retryTimer);
    };
  }, [socketConnected, isAuthenticated, queryClient]);

  // Auth page should not show real-time failure toasts or keep reconnect loops alive.
  useEffect(() => {
    if (location.pathname.toLowerCase().startsWith('/auth')) {
      clearReportedError('realtime-connection');
      if (!isAuthenticated) {
        import('./services/socketService')
          .then((m) => m.socketService.disconnect())
          .catch(() => { });
      }
    }
  }, [location.pathname, isAuthenticated]);

  // Routes
  const NotFoundEl = notFoundRoute.element;

  return (
    <Suspense fallback={<Loading />}>
      {isPublicRoute ? (
        <Routes location={location}>
          {publicRoutes.map(({ path, element: Element }) => (
            <Route key={path} path={path} element={Element ? <Element /> : null} />
          ))}
          {protectedRoutes.map(({ path, element }) => (
            <Route key={path} path={path} element={<ProtectedRoute element={element} />} />
          ))}
          <Route path="*" element={<NotFoundEl />} />
        </Routes>
      ) : (
        <Suspense fallback={<Loading />}>
          <AnimatedAppRoutes
            location={location}
            publicRoutes={publicRoutes}
            protectedRoutes={protectedRoutes}
            NotFoundEl={NotFoundEl}
            ProtectedRoute={ProtectedRoute}
          />
        </Suspense>
      )}
    </Suspense>
  );
};

export default App;
