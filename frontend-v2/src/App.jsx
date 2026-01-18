import { useEffect } from 'react';
import { useAuthStore, useUIStore, useCallStore } from './stores';
import { AuthPage } from './components/auth';
import { ChatInterface } from './components/chat/ChatInterface';
import { IncomingCallDialog, ActiveCallInterface } from './components/calls';



function App() {
  const { isAuthenticated } = useAuthStore();
  const { setIsMobile, theme } = useUIStore();
  const { hasActiveCall, hasIncomingCall } = useCallStore();


  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setIsMobile(isMobile);
    };


    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsMobile]);


  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);


  if (!isAuthenticated) {
    return <AuthPage />;
  }


  return (
    <>

      {hasActiveCall() && <ActiveCallInterface />}


      {!hasActiveCall() && <ChatInterface />}


      {hasIncomingCall() && <IncomingCallDialog />}
    </>
  );
}

export default App;

