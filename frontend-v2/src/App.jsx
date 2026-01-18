import { useEffect, useState } from 'react';
import { useAuthStore, useUIStore, useCallStore } from './stores';
import { socketService } from './api/socket';
import { AuthPage } from './components/auth';
import { ChatInterface } from './components/chat/ChatInterface';
import { IncomingCallDialog, ActiveCallInterface } from './components/calls';
import toast from 'react-hot-toast';



function App() {
  const { isAuthenticated, user } = useAuthStore();
  const { setIsMobile, theme } = useUIStore();
  const { hasActiveCall, hasIncomingCall, receiveIncomingCall } = useCallStore();
  const [mediaPermissionGranted, setMediaPermissionGranted] = useState(false);


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

  // Request media permissions when user logs in
  useEffect(() => {
    if (!isAuthenticated || mediaPermissionGranted) return;

    const requestMediaPermissions = async () => {
      try {
        // Request both camera and microphone permissions upfront
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });

        // Stop the stream immediately - we just wanted to get permission
        stream.getTracks().forEach(track => track.stop());

        setMediaPermissionGranted(true);
        toast.success('Camera and microphone access granted');
        console.log('Media permissions granted successfully');
      } catch (error) {
        console.error('Media permission error:', error);

        if (error.name === 'NotAllowedError') {
          toast.error('Please allow camera and microphone access for video calls');
        } else if (error.name === 'NotFoundError') {
          // Try audio only if no camera
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStream.getTracks().forEach(track => track.stop());
            setMediaPermissionGranted(true);
            toast.success('Microphone access granted (no camera found)');
          } catch (audioError) {
            toast.error('No microphone found on your device');
          }
        } else {
          toast.error('Failed to access camera/microphone');
        }
      }
    };

    // Request permissions after a short delay to avoid overwhelming the user
    const timer = setTimeout(requestMediaPermissions, 1000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, mediaPermissionGranted]);

  // Listen for incoming call notifications via WebSocket
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let subscription = null;
    let isMounted = true;

    const setupCallListener = async () => {
      try {
        await socketService.connect();
        if (!isMounted) return;

        // Subscribe to call notifications as per API documentation
        const topic = `/user/queue/video/call-notification`;
        subscription = socketService.subscribe(topic, (callData) => {
          if (!isMounted) return;

          console.log('Received call notification:', callData);

          // Show incoming call dialog when someone calls us
          if (callData.receiverId === user.id) {
            receiveIncomingCall({
              id: callData.callId,
              callerId: callData.callerId,
              receiverId: callData.receiverId,
              type: callData.type,
              callType: callData.type?.toLowerCase(),
              conversationId: callData.conversationId,
              status: 'RINGING',
              callerName: `User ${callData.callerId}`,
            });

            // Show toast notification as well
            toast(`Incoming ${callData.type?.toLowerCase() || 'call'} from User ${callData.callerId}`, {
              icon: '📞',
              duration: 5000,
            });
          }
        });

        console.log('Call notification listener setup complete');
      } catch (error) {
        console.error('Failed to setup call listener:', error);
      }
    };

    setupCallListener();

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [isAuthenticated, user?.id, receiveIncomingCall]);


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
