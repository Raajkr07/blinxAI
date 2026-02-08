import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { useUIStore } from './store/uiStore';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import ProtectedLayout from './components/layout/ProtectedLayout';
import Toast from './components/common/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import './index.css';

export default function App() {
  const { token, user, loading, initialize, logout } = useAuthStore();
  const { toast, hideToast } = useUIStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!token || !user) {
    return <LoginPage />;
  }

  return (
    <ErrorBoundary>
      <div className="app-container">
        <ProtectedLayout user={user} onLogout={logout}>
          <ChatPage />
        </ProtectedLayout>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={hideToast}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
