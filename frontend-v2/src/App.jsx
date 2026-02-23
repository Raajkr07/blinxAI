import { useEffect, Suspense, useRef, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { useUIStore } from './stores/uiStore';
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
        .catch(() => {});
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

  // Auth page should not show real-time failure toasts or keep reconnect loops alive.
  useEffect(() => {
    if (location.pathname.toLowerCase().startsWith('/auth')) {
      clearReportedError('realtime-connection');
      if (!isAuthenticated) {
        import('./services/socketService')
          .then((m) => m.socketService.disconnect())
          .catch(() => {});
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
