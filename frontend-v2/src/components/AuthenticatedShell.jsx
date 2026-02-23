import { useEffect, Suspense, lazy } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useCallStore } from '../stores/callStore';
import { socketService } from '../services/socketService';
import { usePresence } from '../lib/usePresence';
import { reportErrorOnce } from '../lib/reportError';

// Calls UI can be heavy; keep it code-split so auth pages don't download it.
const IncomingCallDialog = lazy(() =>
  import('./calls').then((m) => ({ default: m.IncomingCallDialog }))
);
const ActiveCallInterface = lazy(() =>
  import('./calls').then((m) => ({ default: m.ActiveCallInterface }))
);
const ConnectionStatus = lazy(() =>
  import('./ConnectionStatus').then((m) => ({ default: m.ConnectionStatus }))
);

export function AuthenticatedShell({ Component }) {
  const { user, isAuthenticated } = useAuthStore();
  const { hasActiveCall, hasIncomingCall, initializeWebRTC } = useCallStore();

  // Presence only makes sense when authenticated.
  usePresence(isAuthenticated);

  // WebRTC + Socket initialization (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let isCancelled = false;
    let cleanup;

    socketService.connect()
      .then(() => {
        if (isCancelled) return;
        cleanup = initializeWebRTC(user.id);
      })
      .catch((error) => {
        reportErrorOnce('realtime-connection', error, 'Real-time connection failed');
      });

    return () => {
      isCancelled = true;
      if (cleanup) cleanup();
    };
  }, [isAuthenticated, user?.id, initializeWebRTC]);

  return (
    <>
      <Suspense fallback={null}>
        <ConnectionStatus />
        {hasIncomingCall() && <IncomingCallDialog />}
        {hasActiveCall() && <ActiveCallInterface />}
      </Suspense>

      {!hasActiveCall() && Component && <Component />}
    </>
  );
}
